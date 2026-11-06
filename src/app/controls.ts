import type { InputSource, Session } from '../game/session';
import type { ControlScheme } from '../services/settings';

export interface ControlHooks {
  session: () => Session | null;
  scheme: () => ControlScheme;
  /** A user gesture happened: unlock audio. */
  gesture: () => void;
  togglePause: () => void;
  restart: () => void;
  toggleMute: () => void;
}

const HOLD_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);
const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD']);
const BOOST_KEYS = new Set(['ShiftLeft', 'ShiftRight', 'KeyB', 'ArrowDown']);

function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.closest('button, input, select, textarea, a, [role="dialog"]') !== null;
}

/**
 * Turns pointers and keys into the session's input sources. One thumb anywhere on the play field holds; the optional
 * on-screen buttons and the keyboard offer explicit left/right and boost. Nothing here needs a hidden gesture.
 */
export class Controls {
  private readonly pointers = new Set<number>();
  private readonly cleanups: Array<() => void> = [];

  constructor(
    private readonly host: HTMLElement,
    private readonly hooks: ControlHooks,
  ) {}

  attach(): void {
    this.listen(this.host, 'pointerdown', (e) => this.onPointerDown(e as PointerEvent));
    this.listen(window, 'pointerup', (e) => this.onPointerEnd(e as PointerEvent));
    this.listen(window, 'pointercancel', (e) => this.onPointerEnd(e as PointerEvent));
    this.listen(window, 'blur', () => this.releaseAll());
    this.listen(document, 'visibilitychange', () => document.hidden && this.releaseAll());
    this.listen(window, 'keydown', (e) => this.onKey(e as KeyboardEvent, true));
    this.listen(window, 'keyup', (e) => this.onKey(e as KeyboardEvent, false));
  }

  detach(): void {
    for (const off of this.cleanups.splice(0)) off();
  }

  private listen(target: EventTarget, type: string, handler: (event: Event) => void): void {
    target.addEventListener(type, handler);
    this.cleanups.push(() => target.removeEventListener(type, handler));
  }

  releaseAll(): void {
    this.pointers.clear();
    this.hooks.session()?.clearInput();
  }

  private onPointerDown(event: PointerEvent): void {
    this.hooks.gesture();
    if (this.hooks.scheme() !== 'thumb') return;
    const session = this.hooks.session();
    if (!session || session.paused) return;
    this.pointers.add(event.pointerId);
    session.setSource('pointer', true);
  }

  private onPointerEnd(event: PointerEvent): void {
    if (!this.pointers.delete(event.pointerId)) return;
    if (this.pointers.size === 0) this.hooks.session()?.setSource('pointer', false);
  }

  private onKey(event: KeyboardEvent, down: boolean): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (down) this.hooks.gesture();
    if (down && !event.repeat && this.globalKey(event.code, event)) return;
    const session = this.hooks.session();
    if (session && !isInteractive(event.target)) this.driveKey(session, event, down);
  }

  private driveKey(session: Session, event: KeyboardEvent, down: boolean): void {
    const source = this.sourceFor(event.code);
    if (source) {
      event.preventDefault();
      session.setSource(source, down && !session.paused);
    } else if (down && !event.repeat && BOOST_KEYS.has(event.code)) {
      event.preventDefault();
      session.queueBoost();
    }
  }

  private sourceFor(code: string): InputSource | null {
    if (HOLD_KEYS.has(code)) return 'key';
    if (LEFT_KEYS.has(code)) return 'key-left';
    return RIGHT_KEYS.has(code) ? 'key-right' : null;
  }

  /** Keys that always work: pause, restart, mute. Returns true when the key was used. */
  private globalKey(code: string, event: KeyboardEvent): boolean {
    if (isInteractive(event.target) && code !== 'Escape') return false;
    if (code === 'Escape' || code === 'KeyP') this.hooks.togglePause();
    else if (code === 'KeyR' && this.hooks.session()) this.hooks.restart();
    else if (code === 'KeyM') this.hooks.toggleMute();
    else return false;
    event.preventDefault();
    return true;
  }
}
