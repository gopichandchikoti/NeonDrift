import { VIEW, viewHeightFor } from '../game/scenes/camera';

export interface GameLike {
  scale: { setGameSize(width: number, height: number): void; refresh(): void };
}

/**
 * Keeps the play field and the interface layer in step with the window. The play field is 540 units wide and as tall
 * as the screen allows (taller phones see more road); the interface layer is sized to sit exactly over the canvas,
 * and its font size scales with the canvas width so every rem in the stylesheet means the same share of the screen.
 */
export class Layout {
  constructor(
    private readonly game: GameLike,
    private readonly ui: HTMLElement,
    private readonly canvasHost: HTMLElement,
    private uiScale: () => number,
  ) {}

  apply(): void {
    const height = viewHeightFor(window.innerWidth, window.innerHeight);
    if (height !== VIEW.height) {
      VIEW.height = height;
      this.game.scale.setGameSize(VIEW.width, height);
    }
    this.game.scale.refresh();
    this.place();
  }

  /** Positions the interface layer over the canvas (call after Phaser has fitted it). */
  place(): void {
    const canvas = this.canvasHost.querySelector('canvas');
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    const style = this.ui.style;
    style.left = `${box.left}px`;
    style.top = `${box.top}px`;
    style.width = `${box.width}px`;
    style.height = `${box.height}px`;
    const base = Math.min(30, Math.max(11, (box.width / 390) * 16));
    style.fontSize = `${(base * this.uiScale()).toFixed(2)}px`;
  }
}
