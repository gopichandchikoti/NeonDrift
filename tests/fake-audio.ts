/** A tiny stand-in for the Web Audio API: records what was built and lets tests drive the clock. */
export class FakeParam {
  value = 0;
  calls: string[] = [];
  setValueAtTime(v: number): void {
    this.value = v;
    this.calls.push('set');
  }
  linearRampToValueAtTime(v: number): void {
    this.value = v;
    this.calls.push('linear');
  }
  exponentialRampToValueAtTime(v: number): void {
    this.value = v;
    this.calls.push('exp');
  }
  setTargetAtTime(v: number): void {
    this.value = v;
    this.calls.push('target');
  }
}

export class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  type = '';
  buffer: unknown = null;
  loop = false;
  started = false;
  stopped = false;
  connected: unknown[] = [];
  connect(node: unknown): unknown {
    this.connected.push(node);
    return node;
  }
  disconnect(): void {
    this.connected = [];
  }
  start(): void {
    this.started = true;
  }
  stop(): void {
    if (this.stopped) throw new Error('already stopped');
    this.stopped = true;
  }
}

export class FakeContext {
  currentTime = 0;
  sampleRate = 8000;
  state: 'running' | 'suspended' = 'suspended';
  destination = new FakeNode();
  nodes: FakeNode[] = [];
  resumed = 0;
  suspended = 0;
  private make(): FakeNode {
    const node = new FakeNode();
    this.nodes.push(node);
    return node;
  }
  createGain = (): FakeNode => this.make();
  createOscillator = (): FakeNode => this.make();
  createBiquadFilter = (): FakeNode => this.make();
  createBufferSource = (): FakeNode => this.make();
  createBuffer(_channels: number, length: number): { getChannelData: () => Float32Array } {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  resume(): Promise<void> {
    this.resumed += 1;
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.suspended += 1;
    this.state = 'suspended';
    return Promise.resolve();
  }
}

export const asContext = (c: FakeContext): AudioContext => c as unknown as AudioContext;
