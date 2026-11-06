import { App } from '../src/app/app';
import type { DriveScene, SceneBridge, Attach } from '../src/game/scenes/drive-scene';
import type { Session } from '../src/game/session';
import { vi } from 'vitest';

/** Stands in for the Phaser scene: remembers what the app attached and lets a test play frames by hand. */
export class FakeScene {
  bridge: SceneBridge | null = null;
  attached: Attach | null = null;
  session: Session | null = null;
  attaches = 0;
  setBridge(bridge: SceneBridge): void {
    this.bridge = bridge;
  }
  attach(a: Attach): void {
    this.attached = a;
    this.session = a.session;
    this.attaches += 1;
  }
  detach(): void {
    this.session = null;
  }
}

export interface Harness {
  app: App;
  scene: FakeScene;
  ui: HTMLElement;
  live: HTMLElement;
  /** Plays `ms` of real time through the current session, as the scene's update would. */
  frame(ms: number): void;
  /** Plays frames until `done` or `limit` ms, 16 ms at a time. */
  until(done: () => boolean, limit?: number): void;
  click(name: RegExp | string): void;
  has(name: RegExp | string): boolean;
  button(name: RegExp | string): HTMLElement;
}

export function mount(options: { progress?: unknown; settings?: unknown; tutorialDone?: boolean } = {}): Harness {
  localStorage.clear();
  const data = { tutorialDone: options.tutorialDone ?? true, ...(options.progress as object | undefined) };
  localStorage.setItem('neon-drift.progress', JSON.stringify({ version: 1, data }));
  if (options.settings) localStorage.setItem('neon-drift.settings', JSON.stringify({ version: 1, data: options.settings }));
  document.body.innerHTML = '<div id="app"><div id="game"></div><div id="ui"></div><div id="live"></div></div>';
  const ui = document.getElementById('ui') as HTMLElement;
  const live = document.getElementById('live') as HTMLElement;
  const scene = new FakeScene();
  const app = new App({ ui, live, scene: scene as unknown as DriveScene, relayout: () => undefined });
  const button = (name: RegExp | string): HTMLElement => {
    const matches = (text: string): boolean => (typeof name === 'string' ? text === name : name.test(text));
    const found = Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) => {
      const label = (b.getAttribute('aria-label') ?? b.textContent ?? '').replace(/\s+/g, ' ').trim();
      return matches(label);
    });
    if (!found) throw new Error(`no button ${String(name)}. Buttons: ${Array.from(document.querySelectorAll('button')).map((b) => b.textContent).join(' | ')}`);
    return found;
  };
  const frame = (ms: number): void => {
    // The session ignores more than 100 ms in one go (a tab that was asleep), so play long spans as 16 ms frames.
    for (let left = ms; left > 0; left -= 16) {
      const session = scene.session;
      if (!session || !scene.bridge) return;
      const events = session.advance(Math.min(16, left));
      scene.bridge.onEvents(events, session);
      scene.bridge.onFrame(session);
    }
  };
  return {
    app, scene, ui, live, frame,
    until: (done, limit = 120000) => {
      for (let t = 0; t < limit && !done(); t += 16) frame(16);
    },
    click: (name) => button(name).click(),
    has: (name) => {
      try {
        button(name);
        return true;
      } catch {
        return false;
      }
    },
    button,
  };
}

export function stubBrowser(): void {
  window.matchMedia = vi.fn((query: string) => ({
    matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
