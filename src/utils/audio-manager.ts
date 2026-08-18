/**
 * Audio Manager — Web Audio API singleton.
 * Manages BGM (loop), SFX slice (polyphonic), SFX bomb.
 * SFX preloads eagerly; BGM preloads on idle or on first play.
 */

type SfxName = "bgm" | "slice" | "bomb";

const LANDING_BGM_VOLUME = 0.24;
const GAME_BGM_VOLUME = 0.16;
const BUTTON_SFX_VOLUME = 0.58;

interface AudioBuffers {
  slice: AudioBuffer | null;
  bomb: AudioBuffer | null;
  bgm: AudioBuffer | null;
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private buffers: AudioBuffers = { slice: null, bomb: null, bgm: null };
  
  private bgmSourceNode: AudioBufferSourceNode | null = null;
  private bgmLocalGain: GainNode | null = null;
  private bgmOffset = 0;
  private bgmStartedAt = 0;
  private bgmRequested = false;

  private _musicMuted = false;
  private _sfxMuted = false;
  private _parentMuted = false;
  private _bgmPlaying = false;
  private currentBgmVolume = LANDING_BGM_VOLUME;

  private ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      this.bgmGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      
      this.bgmGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
      
      this.bgmGain.gain.value = this._parentMuted || this._musicMuted ? 0 : 1;
      this.sfxGain.gain.value = this._parentMuted || this._sfxMuted ? 0 : 1;
    }
  }

  /** Unlock AudioContext (must be called from user gesture) */
  async unlock(): Promise<void> {
    this.ensureContext();
    if (this.ctx!.state === "suspended") {
      await this.ctx!.resume();
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

  private bgmLoadPromise: Promise<void> | null = null;

  /**
   * Preload the BGM file. Idempotent — concurrent calls share the same promise,
   * so the file is never fetched twice. Safe to fire from idle and from playBgm.
   */
  async preloadBgm(basePath = "/assets/"): Promise<void> {
    if (this.buffers.bgm) return;
    if (this.bgmLoadPromise) return this.bgmLoadPromise;
    this.bgmLoadPromise = (async () => {
      this.ensureContext();
      const resp = await fetch(`${basePath}moavii-we-are.mp3`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const arrayBuf = await resp.arrayBuffer();
      this.buffers.bgm = await this.ctx!.decodeAudioData(arrayBuf);
    })().catch((err) => {
      this.bgmLoadPromise = null;
      console.warn("[AudioManager] Failed to preload BGM", err);
    });
    return this.bgmLoadPromise;
  }

  /** Play BGM in a loop at given volume (0-1). If still loading, waits on the shared
   *  preload promise and starts as soon as the buffer is ready. */
  playBgm(volume = 0.3): void {
    if (!this.ctx || this._musicMuted) return;
    if (!this.buffers.bgm) {
      void this.preloadBgm().then(() => this.playBgm(volume));
      return;
    }
    this.currentBgmVolume = this.clampVolume(volume);
    this.bgmRequested = true;
    
    if (this.bgmLocalGain) {
      this.bgmLocalGain.gain.value = this.currentBgmVolume;
    }
    
    if (this._bgmPlaying && this.bgmSourceNode) {
      return; // Already playing
    }
    
    if (this.bgmSourceNode) {
      try { this.bgmSourceNode.stop(); } catch {}
      this.bgmSourceNode.disconnect();
    }
    
    if (!this.bgmLocalGain) {
      this.bgmLocalGain = this.ctx.createGain();
      this.bgmLocalGain.gain.value = this.currentBgmVolume;
      this.bgmLocalGain.connect(this.bgmGain!);
    }
    
    this.bgmSourceNode = this.ctx.createBufferSource();
    this.bgmSourceNode.buffer = this.buffers.bgm;
    this.bgmSourceNode.loop = true;
    this.bgmSourceNode.connect(this.bgmLocalGain);
    const offset = this.buffers.bgm.duration > 0
      ? this.bgmOffset % this.buffers.bgm.duration
      : 0;
    this.bgmSourceNode.start(0, offset);
    this.bgmStartedAt = this.ctx.currentTime;
    this._bgmPlaying = true;
  }

  pauseBgm(): void {
    if (!this.bgmSourceNode || !this.ctx || !this.buffers.bgm) return;
    const elapsed = Math.max(0, this.ctx.currentTime - this.bgmStartedAt);
    this.bgmOffset = (this.bgmOffset + elapsed) % this.buffers.bgm.duration;
    try { this.bgmSourceNode.stop(); } catch {}
    this.bgmSourceNode.disconnect();
    this.bgmSourceNode = null;
    this._bgmPlaying = false;
  }

  resumeBgm(): void {
    if (!this.ctx || !this.bgmRequested || this._musicMuted) return;
    this.playBgm(this.currentBgmVolume);
  }

  stopBgm(): void {
    if (this.bgmSourceNode) {
      try { this.bgmSourceNode.stop(); } catch {}
      this.bgmSourceNode.disconnect();
      this.bgmSourceNode = null;
    }
    this._bgmPlaying = false;
    this.bgmOffset = 0;
    this.bgmStartedAt = 0;
    this.bgmRequested = false;
  }

  /**
   * Play a one-shot SFX. Uses pool of up to `maxVoices` simultaneous sources.
   */
  private voicePools: Map<SfxName, AudioBufferSourceNode[]> = new Map();

  playSfx(name: SfxName, volume = 0.6, maxVoices = 5): void {
    if (!this.ctx || !this.buffers[name]) return;
    
    const buf = this.buffers[name]!;
    const source = this.ctx.createBufferSource();
    source.buffer = buf;

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

  playButtonSfx(volume = BUTTON_SFX_VOLUME): void {
    this.ensureContext();
    if (this.ctx!.state === "suspended") {
      void this.ctx!.resume().catch(() => {});
    }

    const now = this.ctx!.currentTime;
    const gain = this.ctx!.createGain();
    const click = this.ctx!.createOscillator();
    const pop = this.ctx!.createOscillator();
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
    if (this.bgmGain) {
      this.bgmGain.gain.value = this._parentMuted || this._musicMuted ? 0 : 1;
    }
    if (this.sfxGain) {
      this.sfxGain.gain.value = this._parentMuted || this._sfxMuted ? 0 : 1;
    }
  }

  /** Change BGM volume dynamically (0-1). Does not restart the track. */
  setBgmVolume(volume: number): void {
    this.currentBgmVolume = this.clampVolume(volume);
    if (this.bgmLocalGain) {
      this.bgmLocalGain.gain.value = this.currentBgmVolume;
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
    
    if (this.bgmLocalGain) {
      this.bgmLocalGain.disconnect();
      this.bgmLocalGain = null;
    }
    if (this.bgmGain) {
      this.bgmGain.disconnect();
      this.bgmGain = null;
    }
    if (this.sfxGain) {
      this.sfxGain.disconnect();
      this.sfxGain = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.buffers = { slice: null, bomb: null, bgm: null };
    this.bgmLoadPromise = null;
    this.bgmOffset = 0;
    this.bgmStartedAt = 0;
    this.bgmRequested = false;
  }

  private clampVolume(volume: number): number {
    return Math.max(0, Math.min(1, volume));
  }
}

/** Global singleton */
export const audioManager = new AudioManager();
