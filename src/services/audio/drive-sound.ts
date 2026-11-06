import type { AudioEngine } from './engine';

/**
 * The continuous sounds while driving: an engine hum whose pitch follows speed, and a tire hiss that swells with
 * the drift angle. Both are built once per run and torn down at the end.
 */
export class DriveSound {
  private nodes: {
    osc: OscillatorNode;
    sub: OscillatorNode;
    filter: BiquadFilterNode;
    engine: GainNode;
    hiss: GainNode;
    hissFilter: BiquadFilterNode;
    source: AudioBufferSourceNode;
  } | null = null;

  constructor(private readonly engine: AudioEngine) {}

  start(): void {
    const ctx = this.engine.context;
    const out = this.engine.sfxOut;
    if (!ctx || !out || this.nodes) return;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const engine = ctx.createGain();
    osc.type = 'sawtooth';
    sub.type = 'square';
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    engine.gain.value = 0;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(engine);
    engine.connect(out);
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'bandpass';
    hissFilter.frequency.value = 2400;
    hissFilter.Q.value = 0.8;
    const hiss = ctx.createGain();
    hiss.gain.value = 0;
    source.connect(hissFilter);
    hissFilter.connect(hiss);
    hiss.connect(out);
    osc.start();
    sub.start();
    source.start();
    this.nodes = { osc, sub, filter, engine, hiss, hissFilter, source };
  }

  /** `speed` in units per second, `slip` as an absolute angle in radians. */
  update(speed: number, slip: number, boosting: boolean, running: boolean): void {
    const ctx = this.engine.context;
    const n = this.nodes;
    if (!ctx || !n) return;
    const t = ctx.currentTime;
    const base = 52 + speed * 0.22 + (boosting ? 40 : 0);
    n.osc.frequency.setTargetAtTime(base, t, 0.05);
    n.sub.frequency.setTargetAtTime(base / 2, t, 0.05);
    n.filter.frequency.setTargetAtTime(380 + speed * 1.6, t, 0.08);
    n.engine.gain.setTargetAtTime(running ? 0.035 + Math.min(0.03, speed / 12000) : 0, t, 0.08);
    const hiss = running ? Math.min(1, Math.max(0, (slip - 0.1) / 0.5)) : 0;
    n.hiss.gain.setTargetAtTime(hiss * 0.16, t, 0.04);
    n.hissFilter.frequency.setTargetAtTime(1800 + hiss * 1800, t, 0.05);
  }

  stop(): void {
    const n = this.nodes;
    if (!n) return;
    this.nodes = null;
    for (const node of [n.osc, n.sub, n.source]) {
      try {
        node.stop();
      } catch {
        // Already stopped: nothing to do.
      }
    }
    for (const node of [n.engine, n.hiss, n.filter, n.hissFilter]) node.disconnect();
  }
}
