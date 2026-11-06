type Child = Node | string | false | null | undefined | readonly Child[];
type Attrs = Record<string, string | number | boolean | ((event: Event) => void) | undefined>;

/** Tiny element builder. Attributes starting with "on" are event listeners; true/false toggle boolean attributes. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (typeof value === 'function') el.addEventListener(name.slice(2).toLowerCase(), value);
    else if (value === true) el.setAttribute(name, '');
    else el.setAttribute(name, String(value));
  }
  append(el, children);
  return el;
}

export function append(el: Element, children: readonly Child[]): void {
  for (const child of children) {
    if (child === false || child === null || child === undefined) continue;
    if (Array.isArray(child)) append(el, child as readonly Child[]);
    else el.append(typeof child === 'string' ? document.createTextNode(child) : (child as Node));
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Parses trusted, hard-coded SVG markup (never user input) into an element. */
export function svg(markup: string): SVGElement {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild as SVGElement;
}

export function formatScore(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

/** Seconds as m:ss.t */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
