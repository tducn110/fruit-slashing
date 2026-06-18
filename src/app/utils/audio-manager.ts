/**
 * Audio Manager — Web Audio API singleton.
 * Manages BGM (loop), SFX slice (polyphonic), SFX bomb.
 * All buffers are preloaded before game starts.
 */

type SfxName = "bgm" | "slice" | "bomb";

interface AudioBuffers {
  bgm: AudioBuffer | null;
  slice: AudioBuffer | null;
  bomb: AudioBuffer | null;
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private buffers: AudioBuffers = { bgm: null, slice: null, bomb: null };
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmGain: GainNode | null = null;
  private _muted = false;
  private _loaded = false;
  private _bgmPlaying = false;

  /** Unlock AudioContext (must be called from user gesture) */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  get muted() { return this._muted; }
  get loaded() { return this._loaded; }
  get bgmPlaying() { return this._bgmPlaying; }

  /**
   * Preload all audio buffers. Returns progress 0-1 via onProgress.
   * `basePath` should point to the folder containing audio files, e.g. "/assets/".
   */
  async preloadAll(
    basePath: string,
    onProgress?: (ratio: number) => void
  ): Promise<void> {
    // Ensure context exists
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }

    const files: { name: SfxName; url: string }[] = [
      { name: "bgm", url: `${basePath}moavii-we-are.mp3` },
      { name: "slice", url: `${basePath}666herohero-slash-21834.mp3` },
      { name: "bomb", url: `${basePath}bomb.mp3` },
    ];

    let loaded = 0;
    const total = files.length;

    const loadOne = async (name: SfxName, url: string): Promise<void> => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuf = await resp.arrayBuffer();
        const audioBuf = await this.ctx!.decodeAudioData(arrayBuf);
        this.buffers[name] = audioBuf;
      } catch (err) {
        console.warn(`[AudioManager] Failed to load ${name}:`, err);
        // Continue without this sound
      }
      loaded++;
      onProgress?.(loaded / total);
    };

    await Promise.all(files.map((f) => loadOne(f.name, f.url)));
    this._loaded = true;
  }

  /**
   * Preload only the BGM file (for landing page auto-play).
   * Returns true if loaded successfully.
   */
  async preloadBgmOnly(basePath: string): Promise<boolean> {
    if (!this.ctx) this.ctx = new AudioContext();
    try {
      const resp = await fetch(`${basePath}moavii-we-are.mp3`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const arrayBuf = await resp.arrayBuffer();
      this.buffers.bgm = await this.ctx!.decodeAudioData(arrayBuf);
      return true;
    } catch (err) {
      console.warn("[AudioManager] Failed to preload BGM:", err);
      return false;
    }
  }

  /**
   * Try to auto-play BGM on page load. If browser blocks AudioContext
   * (autoplay policy), waits for first user interaction then plays.
   * Call this when landing page mounts — no extra click needed.
   */
  tryAutoPlayBgm(basePath: string): void {
    const doPlay = async () => {
      if (this._bgmPlaying) return;
      if (!this.ctx) this.ctx = new AudioContext();

      if (this.ctx.state === "suspended") {
        try { await this.ctx.resume(); } catch {}
      }

      if (!this.buffers.bgm) {
        const ok = await this.preloadBgmOnly(basePath);
        if (!ok) return;
      }

      if (this.ctx.state === "running") {
        this.playBgm(0.7);
      }
    };

    // Try immediately (may work if user already interacted with site before)
    doPlay();

    // If blocked by autoplay policy, wait for first user interaction
    const resumeOnInteraction = async () => {
      if (this._bgmPlaying) { cleanup(); return; }
      if (!this.ctx) this.ctx = new AudioContext();
      if (this.ctx.state === "suspended") {
        try { await this.ctx.resume(); } catch {}
      }
      if (!this.buffers.bgm) {
        await this.preloadBgmOnly(basePath);
      }
      if (this.ctx.state === "running" && !this._bgmPlaying) {
        this.playBgm(0.7);
      }
      cleanup();
    };

    const cleanup = () => {
      document.removeEventListener("click", resumeOnInteraction);
      document.removeEventListener("touchstart", resumeOnInteraction);
      document.removeEventListener("keydown", resumeOnInteraction);
    };

    document.addEventListener("click", resumeOnInteraction, { once: true });
    document.addEventListener("touchstart", resumeOnInteraction, { once: true });
    document.addEventListener("keydown", resumeOnInteraction, { once: true });
  }

  /** Play BGM in a loop at given volume (0-1). */
  playBgm(volume = 0.3): void {
    if (!this.ctx || !this.buffers.bgm) return;
    this.stopBgm();

    const source = this.ctx.createBufferSource();
    source.buffer = this.buffers.bgm;
    source.loop = true;

    const gain = this.ctx.createGain();
    gain.gain.value = this._muted ? 0 : Math.max(0, Math.min(1, volume));

    source.connect(gain).connect(this.ctx.destination);
    source.start(0);

    this.bgmSource = source;
    this.bgmGain = gain;
    this._bgmPlaying = true;
  }

  stopBgm(): void {
    if (this.bgmSource) {
      try { this.bgmSource.stop(); } catch {}
      this.bgmSource.disconnect();
      this.bgmSource = null;
    }
    if (this.bgmGain) {
      this.bgmGain.disconnect();
      this.bgmGain = null;
    }
    this._bgmPlaying = false;
  }

  /**
   * Play a one-shot SFX. Uses pool of up to `maxVoices` simultaneous sources.
   */
  private voicePools: Map<SfxName, AudioBufferSourceNode[]> = new Map();

  playSfx(name: SfxName, volume = 0.6, maxVoices = 5): void {
    if (!this.ctx || !this.buffers[name]) return;
    if (this._muted && name !== "bomb") return;
    // Bomb still plays even when muted? No — respect mute
    if (this._muted) return;

    const buf = this.buffers[name]!;
    const source = this.ctx.createBufferSource();
    source.buffer = buf;

    const gain = this.ctx.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));

    source.connect(gain).connect(this.ctx.destination);

    // Manage voice pool
    let pool = this.voicePools.get(name);
    if (!pool) {
      pool = [];
      this.voicePools.set(name, pool);
    }
    const alive = [...pool];
    // Limit voices
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

  /** Toggle mute on/off */
  setMuted(m: boolean): void {
    this._muted = m;
    if (this.bgmGain) {
      this.bgmGain.gain.value = m ? 0 : 0.7;
    }
  }

  /** Change BGM volume dynamically (0-1). Does not restart the track. */
  setBgmVolume(volume: number): void {
    if (this.bgmGain) {
      this.bgmGain.gain.value = this._muted ? 0 : Math.max(0, Math.min(1, volume));
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
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.buffers = { bgm: null, slice: null, bomb: null };
    this._loaded = false;
  }
}

/** Global singleton */
export const audioManager = new AudioManager();
