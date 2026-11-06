import type { ScreenView } from './context';

/** Shows one full-screen view at a time inside the interface layer, and moves focus onto it for keyboard users. */
export class ScreenHost {
  private current: ScreenView | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly announce: (message: string) => void,
  ) {}

  get active(): boolean {
    return this.current !== null;
  }

  show(view: ScreenView): void {
    this.clear();
    this.current = view;
    this.root.prepend(view.el);
    this.announce(view.title);
    const target = view.el.querySelector<HTMLElement>('[tabindex="-1"]') ?? view.el.querySelector<HTMLElement>('button');
    target?.focus({ preventScroll: true });
  }

  clear(): void {
    this.current?.dispose?.();
    this.current?.el.remove();
    this.current = null;
  }
}
