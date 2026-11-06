// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Controls, type ControlHooks } from '../src/app/controls';
import { Layout } from '../src/app/layout';
import { Session } from '../src/game/session';
import { VIEW } from '../src/game/scenes/camera';
import { build } from './helpers';

type Hooks = { [K in keyof ControlHooks]: ReturnType<typeof vi.fn> };

function setup(scheme: 'thumb' | 'buttons' = 'thumb'): { controls: Controls; session: Session; host: HTMLElement; hooks: Hooks } {
  document.body.innerHTML = '<div id="host"></div><button id="btn">b</button>';
  const host = document.getElementById('host') as HTMLElement;
  const session = new Session({ world: build('S4000').world, mode: 'endless' });
  const hooks = {
    session: vi.fn(() => session), scheme: vi.fn(() => scheme), gesture: vi.fn(), togglePause: vi.fn(),
    restart: vi.fn(), toggleMute: vi.fn(),
  };
  const controls = new Controls(host, hooks as unknown as ControlHooks);
  controls.attach();
  return { controls, session, host, hooks };
}

const pointer = (type: string, id: number): Event =>
  Object.assign(new Event(type, { bubbles: true }), { pointerId: id });
const key = (type: string, code: string, init: KeyboardEventInit = {}): KeyboardEvent =>
  new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...init });

describe('touch', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('holds while any finger is down and unlocks audio on the first touch', () => {
    const { host, session, hooks } = setup();
    host.dispatchEvent(pointer('pointerdown', 1));
    host.dispatchEvent(pointer('pointerdown', 2));
    expect(session.holding).toBe(true);
    expect(hooks.gesture).toHaveBeenCalled();
    window.dispatchEvent(pointer('pointerup', 1));
    expect(session.holding).toBe(true);
    window.dispatchEvent(pointer('pointercancel', 2));
    expect(session.holding).toBe(false);
    window.dispatchEvent(pointer('pointerup', 9));
  });

  it('ignores the screen when steering buttons are the chosen scheme, and while paused', () => {
    const buttons = setup('buttons');
    buttons.host.dispatchEvent(pointer('pointerdown', 1));
    expect(buttons.session.holding).toBe(false);
    const paused = setup();
    paused.session.paused = true;
    paused.host.dispatchEvent(pointer('pointerdown', 1));
    expect(paused.session.holding).toBe(false);
  });

  it('lets go of everything when the window loses focus, and can be detached', () => {
    const { host, session, controls } = setup();
    host.dispatchEvent(pointer('pointerdown', 1));
    window.dispatchEvent(new Event('blur'));
    expect(session.holding).toBe(false);
    host.dispatchEvent(pointer('pointerdown', 2));
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    expect(session.holding).toBe(false);
    controls.detach();
    host.dispatchEvent(pointer('pointerdown', 3));
    expect(session.holding).toBe(false);
  });
});

describe('keyboard', () => {
  it('holds with space and the arrows, steers explicitly with A and D, and boosts once per press', () => {
    const { session } = setup();
    window.dispatchEvent(key('keydown', 'Space'));
    expect(session.holding).toBe(true);
    window.dispatchEvent(key('keyup', 'Space'));
    expect(session.holding).toBe(false);
    window.dispatchEvent(key('keydown', 'ArrowLeft'));
    session.world.boostMeter = 1;
    window.dispatchEvent(key('keydown', 'ShiftLeft'));
    window.dispatchEvent(key('keydown', 'ShiftLeft', { repeat: true }));
    session.advance(50);
    expect(session.world.stats.boosts).toBe(1);
    expect(session.world.car.heading).toBeLessThan(-Math.PI / 2);
    window.dispatchEvent(key('keyup', 'ArrowLeft'));
    window.dispatchEvent(key('keydown', 'KeyD'));
    window.dispatchEvent(key('keyup', 'KeyD'));
  });

  it('pauses, restarts and mutes from anywhere, but not with a modifier key held', () => {
    const { hooks } = setup();
    window.dispatchEvent(key('keydown', 'Escape'));
    window.dispatchEvent(key('keydown', 'KeyP'));
    window.dispatchEvent(key('keydown', 'KeyR'));
    window.dispatchEvent(key('keydown', 'KeyM'));
    expect(hooks.togglePause).toHaveBeenCalledTimes(2);
    expect(hooks.restart).toHaveBeenCalledTimes(1);
    expect(hooks.toggleMute).toHaveBeenCalledTimes(1);
    window.dispatchEvent(key('keydown', 'KeyR', { ctrlKey: true }));
    window.dispatchEvent(key('keydown', 'KeyR', { repeat: true }));
    expect(hooks.restart).toHaveBeenCalledTimes(1);
  });

  it('leaves keys alone when a button or dialog has focus, so Space still presses the button', () => {
    const { session } = setup();
    const button = document.getElementById('btn') as HTMLElement;
    const space = key('keydown', 'Space');
    button.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(false);
    expect(session.holding).toBe(false);
    const escape = key('keydown', 'Escape');
    button.dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    const r = key('keydown', 'KeyR');
    button.dispatchEvent(r);
    expect(r.defaultPrevented).toBe(false);
  });

  it('does nothing without a session', () => {
    const { hooks } = setup();
    hooks.session.mockReturnValue(null);
    window.dispatchEvent(key('keydown', 'Space'));
    window.dispatchEvent(key('keydown', 'KeyR'));
    expect(hooks.restart).not.toHaveBeenCalled();
  });
});

describe('layout', () => {
  it('sizes the play field to the window and lays the interface exactly over the canvas', () => {
    document.body.innerHTML = '<div id="host"><canvas></canvas></div><div id="ui"></div>';
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    canvas.getBoundingClientRect = () => ({ left: 10, top: 20, width: 390, height: 800 }) as DOMRect;
    const game = { scale: { setGameSize: vi.fn(), refresh: vi.fn() } };
    const ui = document.getElementById('ui') as HTMLElement;
    let scale = 1;
    const layout = new Layout(game, ui, document.getElementById('host') as HTMLElement, () => scale);
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    layout.apply();
    expect(VIEW.height).toBe(1108);
    expect(game.scale.setGameSize).toHaveBeenCalledWith(540, 1108);
    expect(ui.style.left).toBe('10px');
    expect(ui.style.width).toBe('390px');
    expect(parseFloat(ui.style.fontSize)).toBeCloseTo(16, 1);
    scale = 1.3;
    layout.apply();
    expect(game.scale.setGameSize).toHaveBeenCalledTimes(1);
    expect(parseFloat(ui.style.fontSize)).toBeCloseTo(20.8, 1);
    canvas.remove();
    layout.place();
    expect(parseFloat(ui.style.fontSize)).toBeCloseTo(20.8, 1);
  });
});
