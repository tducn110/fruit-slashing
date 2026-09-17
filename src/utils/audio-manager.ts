/**
 * Audio Manager — Web Audio API singleton.
 * Manages BGM (loop), SFX slice (polyphonic), SFX bomb.
 * SFX preloads eagerly; BGM preloads on idle or on first play.
 */

type SfxName = "slice" | "bomb";

const LANDING_BGM_VOLUME = 0.30;
const GAME_BGM_VOLUME = 0.22;
const BUTTON_SFX_VOLUME = 0.65;

interface AudioBuffers {
  slice: AudioBuffer | null;
  bomb: AudioBuffer | null;
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;

  private buffers: AudioBuffers = { slice: null, bomb: null };

  // ponytail: dual-engine architecture. HTML5 Audio streams BGM (saving 20-30MB RAM on mobile),
  // while Web Audio API handles polyphonic SFX with sample-accurate dynamics limiting.
  private bgm: HTMLAudioElement | null = null;
  private bgmRequested = false;

  private _musicMuted = false;
  private _sfxMuted = false;
  private _parentMuted = false;
  private _bgmPlaying = false;
  private _bgmPaused = false;
  private currentBgmVolume = LANDING_BGM_VOLUME;

  private ensureContext() {
    if (!this.ctx) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        
        this.bgmGain = this.ctx.createGain();
        this.sfxGain = this.ctx.createGain();
        this.masterGain = this.ctx.createGain();
        
        const isSafari =
          typeof navigator !== "undefined" &&
          (/^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
            /iPad|iPhone|iPod/.test(navigator.userAgent));

        this.bgmGain.gain.value = this._parentMuted || this._musicMuted ? 0 : 1;
        this.sfxGain.gain.value = this._parentMuted || this._sfxMuted ? 0 : 1;
        this.masterGain.gain.value = isSafari ? 1.4 : 1;

        this.bgmGain.connect(this.masterGain);
        this.sfxGain.connect(this.masterGain);

        if (typeof navigator !== "undefined" && "audioSession" in navigator) {
          try {
            (navigator as unknown as { audioSession: { type: string } }).audioSession.type = "playback";
          } catch {}
        }

        // Native Master Limiter: prevents digital clipping when multiple slice voices overlap
        if (typeof this.ctx.createDynamicsCompressor === "function") {
          const limiter = this.ctx.createDynamicsCompressor();
          limiter.threshold.setValueAtTime(-3.0, this.ctx.currentTime);
          limiter.knee.setValueAtTime(4.0, this.ctx.currentTime);
          limiter.ratio.setValueAtTime(20.0, this.ctx.currentTime);
          limiter.attack.setValueAtTime(0.003, this.ctx.currentTime);
          limiter.release.setValueAtTime(0.12, this.ctx.currentTime);

          this.masterGain.connect(limiter);
          limiter.connect(this.ctx.destination);
          this.limiter = limiter;
        } else {
          this.masterGain.connect(this.ctx.destination);
        }
      } catch (err) {
        console.warn("[AudioManager] AudioContext not supported or failed to init", err);
      }
    }
  }

  /** Unlock AudioContext (must be called from user gesture) */
  async unlock(): Promise<void> {
    this.ensureContext();
    if (this.ctx && this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    this.initBgm();
    if (this.bgm && this.bgmRequested && !this._bgmPaused && !this._musicMuted && !this._parentMuted) {
      void this.bgm.play().catch(() => {});
    }
    if (this.ctx) {
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + 0.001);
      } catch {}
    }
    if (!this.buffers.slice || !this.buffers.bomb) {
      void this.preloadEssentialAudio("/assets/");
    }
  }

  get muted() { return this._musicMuted && this._sfxMuted; }
  get musicMuted() { return this._musicMuted; }
  get sfxMuted() { return this._sfxMuted; }
  get parentMuted() { return this._parentMuted; }
  get bgmPlaying() { return this._bgmPlaying; }
  get landingBgmVolume() { return LANDING_BGM_VOLUME; }
  get gameBgmVolume() { return GAME_BGM_VOLUME; }

  /**
   * Preload gameplay SFX (tiny). BGM is loaded separately on idle — see preloadBgm.
   * `basePath` should point to the folder containing audio files, e.g. "/assets/".
   */
  async preloadEssentialAudio(basePath: string): Promise<void> {
    this.ensureContext();
    if (!this.ctx) return;

    const files: { name: keyof AudioBuffers; url: string }[] = [
      { name: "slice", url: `${basePath}666herohero-slash-21834.mp3` },
      { name: "bomb", url: `${basePath}bomb.mp3` },
    ];

    const loadOne = async (name: keyof AudioBuffers, url: string): Promise<void> => {
      if (this.buffers[name]) return;
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuf = await resp.arrayBuffer();
        const audioBuf = await this.ctx!.decodeAudioData(arrayBuf);
        this.buffers[name] = audioBuf;
      } catch (err) {
        console.warn(`[AudioManager] Failed to load ${name}:`, err);
      }
    };

    await Promise.all(files.map((f) => loadOne(f.name, f.url)));
  }

  private initBgm(basePath = "/assets/"): void {
    if (this.bgm || typeof Audio === "undefined") return;
    this.bgm = new Audio(`${basePath}moavii-we-are.mp3`);
    this.bgm.loop = true;
    this.bgm.preload = "metadata";
    this.bgm.setAttribute("playsinline", "true");
  }

  /**
   * Preload the BGM stream. Safe to fire from idle or loader.
   */
  async preloadBgm(basePath = "/assets/"): Promise<void> {
    this.initBgm(basePath);
    this.bgm?.load();
  }

  /** Play BGM in a loop at given volume (0-1). */
  playBgm(volume = LANDING_BGM_VOLUME): void {
    this.ensureContext();
    this.initBgm();
    this.currentBgmVolume = this.clampVolume(volume);
    this.bgmRequested = true;
    this._bgmPaused = false;

    if (!this.bgm) return;
    this.bgm.volume = this.currentBgmVolume;

    if (this._musicMuted || this._parentMuted) return;

    void this.bgm.play().catch(() => {
      // Autoplay blocked fallback: unlocked on user gesture
    });
    this._bgmPlaying = true;
  }

  pauseBgm(): void {
    this._bgmPaused = true;
    this._bgmPlaying = false;
    if (this.bgm) {
      this.bgm.pause();
    }
  }

  resumeBgm(): void {
    if (!this.bgmRequested || this._musicMuted || this._parentMuted) return;
    this._bgmPaused = false;
    this.playBgm(this.currentBgmVolume);
  }

  stopBgm(): void {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm.currentTime = 0;
    }
    this._bgmPlaying = false;
    this._bgmPaused = false;
    this.bgmRequested = false;
  }

  /**
   * Play a one-shot SFX. Uses pool of up to `maxVoices` simultaneous sources.
   */
  private voicePools: Map<SfxName, AudioBufferSourceNode[]> = new Map();

  playSfx(name: SfxName, options: { volume?: number; playbackRate?: number; maxVoices?: number } = {}): void {
    if (!this.ctx) return;
    if (!this.buffers[name]) {
      void this.preloadEssentialAudio("/assets/");
      return;
    }
    
    const { volume = 0.6, playbackRate = 1.0, maxVoices = 5 } = options;

    const buf = this.buffers[name]!;
    const source = this.ctx.createBufferSource();
    source.buffer = buf;
    source.playbackRate.value = playbackRate;

    const gain = this.ctx.createGain();
    gain.gain.value = this.clampVolume(volume);

    // IMPORTANT: Connect to sfxGain, not ctx.destination directly
    source.connect(gain).connect(this.sfxGain!);

    let pool = this.voicePools.get(name);
    if (!pool) {
      pool = [];
      this.voicePools.set(name, pool);
    }
    const alive = [...pool];
    if (alive.length >= maxVoices) {
      try { alive[0].stop(); } catch {}
      alive.shift();
    }
    alive.push(source);
    this.voicePools.set(name, alive);

    source.onended = () => {
      const currentPool = this.voicePools.get(name);
      if (currentPool) this.voicePools.set(name, currentPool.filter((item) => item !== source));
      source.disconnect();
      gain.disconnect();
    };

    source.start(0);
  }


  getActiveVoiceCount(name: SfxName): number {
    return this.voicePools.get(name)?.length ?? 0;
  }

  playButtonSfx(volume = BUTTON_SFX_VOLUME): void {
    this.ensureContext();
    if (!this.ctx) return;
    
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }

    const now = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    const click = this.ctx.createOscillator();
    const pop = this.ctx.createOscillator();
    const finalVolume = this.clampVolume(volume);

    click.type = "triangle";
    click.frequency.setValueAtTime(920, now);
    click.frequency.exponentialRampToValueAtTime(520, now + 0.055);

    pop.type = "sine";
    pop.frequency.setValueAtTime(210, now);
    pop.frequency.exponentialRampToValueAtTime(130, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(finalVolume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    click.connect(gain);
    pop.connect(gain);
    
    // IMPORTANT: Connect to sfxGain, not ctx.destination directly
    gain.connect(this.sfxGain!);

    click.start(now);
    pop.start(now);
    click.stop(now + 0.09);
    pop.stop(now + 0.09);

    const cleanup = () => {
      click.disconnect();
      pop.disconnect();
      gain.disconnect();
    };
    click.onended = cleanup;
  }

  /** Toggle mute on/off */
  setMuted(m: boolean): void {
    this._musicMuted = m;
    this._sfxMuted = m;
    this.applyMuteState();
  }

  setMusicMuted(m: boolean): void {
    this._musicMuted = m;
    if (m) this.pauseBgm();
    else this.resumeBgm();
    this.applyMuteState();
  }

  setSfxMuted(m: boolean): void {
    this._sfxMuted = m;
    this.applyMuteState();
  }

  setParentMuted(m: boolean): void {
    this._parentMuted = m;
    this.applyMuteState();
  }

  private applyMuteState(): void {
    const bgmShouldMute = this._parentMuted || this._musicMuted;
    if (this.bgmGain) {
      this.bgmGain.gain.value = bgmShouldMute ? 0 : 1;
    }
    if (this.bgm) {
      this.bgm.muted = bgmShouldMute;
      if (bgmShouldMute) {
        this.bgm.pause();
        this._bgmPlaying = false;
      } else if (this.bgmRequested && !this._bgmPaused) {
        void this.bgm.play().catch(() => {});
        this._bgmPlaying = true;
      }
    }
    if (this.sfxGain) {
      this.sfxGain.gain.value = this._parentMuted || this._sfxMuted ? 0 : 1;
    }
  }

  /** Change BGM volume dynamically (0-1). Does not restart the track. */
  setBgmVolume(volume: number): void {
    this.currentBgmVolume = this.clampVolume(volume);
    if (this.bgm) {
      this.bgm.volume = this.currentBgmVolume;
    }
  }

  /** Destroy all audio resources */
  destroy(): void {
    this.stopBgm();
    this.voicePools.forEach((pool) =>
      pool.forEach((s) => {
        try { s.stop(); } catch {}
        s.disconnect();
      })
    );
    this.voicePools.clear();
    
    if (this.bgmGain) {
      this.bgmGain.disconnect();
      this.bgmGain = null;
    }
    if (this.sfxGain) {
      this.sfxGain.disconnect();
      this.sfxGain = null;
    }
    if (this.limiter) {
      this.limiter.disconnect();
      this.limiter = null;
    }
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    if (this.bgm) {
      try {
        this.bgm.pause();
        this.bgm.removeAttribute("src");
        this.bgm.load();
      } catch {}
      this.bgm = null;
    }
    this.buffers = { slice: null, bomb: null };
    this.bgmRequested = false;
  }

  private clampVolume(volume: number): number {
    return Math.max(0, Math.min(1, volume));
  }
}

/** Global singleton */
export const audioManager = new AudioManager();
