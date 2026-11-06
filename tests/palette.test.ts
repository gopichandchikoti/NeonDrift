import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** The design tokens, read from the stylesheet that ships, so the test cannot drift from the real colours. */
const css = readFileSync(new URL('../src/ui/styles/base.css', import.meta.url), 'utf8');
const token = (name: string): string => {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!match) throw new Error(`no token --${name}`);
  return match[1] as string;
};

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const channel = (v: number): number => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = ([r, g, b]: Rgb): number => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
const contrast = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
/** `top` at `alpha` laid over `under`: what a translucent panel looks like on top of the game. */
const over = (top: Rgb, alpha: number, under: Rgb): Rgb =>
  top.map((v, i) => v * alpha + (under[i] as number) * (1 - alpha)) as Rgb;

describe('colour contrast of the interface (WCAG 2.2 AA)', () => {
  const text = rgb(token('text'));
  const dim = rgb(token('text-dim'));

  it('keeps body text readable on every surface it is placed on', () => {
    for (const surface of ['asphalt', 'panel', 'panel-2']) {
      expect(contrast(text, rgb(token(surface))), `text on ${surface}`).toBeGreaterThanOrEqual(7);
      expect(contrast(dim, rgb(token(surface))), `dim text on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps text readable on the translucent screen background even over bright neon in the game behind it', () => {
    const asphalt = rgb(token('asphalt'));
    // The screens are the asphalt colour at 82-92% opacity over the live game. Worst realistic backdrops: a neon edge.
    for (const backdrop of ['cyan', 'magenta', 'yellow'] as const) {
      const surface = over(asphalt, 0.82, rgb(token(backdrop)));
      expect(contrast(text, surface), `text over ${backdrop}`).toBeGreaterThanOrEqual(7);
      expect(contrast(dim, surface), `dim text over ${backdrop}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('makes button labels readable on their fills', () => {
    expect(contrast(rgb('#14040d'), rgb(token('magenta')))).toBeGreaterThanOrEqual(4.5); // primary button
    expect(contrast(rgb('#03121a'), rgb(token('cyan')))).toBeGreaterThanOrEqual(4.5); // cyan button, selected segment
    expect(contrast(text, rgb(token('panel-2')))).toBeGreaterThanOrEqual(4.5); // default button
  });

  it('draws accents and the focus ring clearly enough against the dark surfaces', () => {
    for (const name of ['cyan', 'magenta', 'yellow', 'lime', 'focus']) {
      expect(contrast(rgb(token(name)), rgb(token('asphalt'))), name).toBeGreaterThanOrEqual(4.5);
      expect(contrast(rgb(token(name)), rgb(token('panel'))), name).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(rgb(token('danger')), rgb(token('asphalt')))).toBeGreaterThanOrEqual(4.5);
    for (const surface of ['asphalt', 'panel', 'panel-2']) {
      expect(contrast(rgb(token('control')), rgb(token(surface))), `control outline on ${surface}`).toBeGreaterThanOrEqual(3);
    }
  });
});
