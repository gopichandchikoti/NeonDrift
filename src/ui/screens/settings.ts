import type { AppContext, ScreenView } from '../../app/context';
import type { Settings } from '../../services/settings';
import { h } from '../dom';
import { icon } from '../icons';

let counter = 0;
const uid = (): string => `ctl-${(counter += 1)}`;

function toggle(label: string, hint: string, checked: boolean, onChange: (value: boolean) => void): HTMLElement {
  const id = uid();
  const button = h('button', { class: 'switch', type: 'button', role: 'switch', id, 'aria-checked': String(checked), 'aria-describedby': `${id}-hint` });
  button.addEventListener('click', () => {
    const next = button.getAttribute('aria-checked') !== 'true';
    button.setAttribute('aria-checked', String(next));
    onChange(next);
  });
  return h('div', { class: 'field' },
    h('label', { for: id }, label, h('small', { id: `${id}-hint` }, hint)),
    button,
  );
}

interface SliderSpec {
  label: string;
  value: number;
  range: [number, number, number];
  format: (v: number) => string;
  onInput: (value: number) => void;
}

function slider(spec: SliderSpec): HTMLElement {
  const { label, value, range, format, onInput } = spec;
  const id = uid();
  const out = h('output', { for: id, class: 'muted', style: 'min-width:2.6rem;text-align:right;font-size:.8rem' }, format(value));
  const input = h('input', {
    id, type: 'range', min: range[0], max: range[1], step: range[2], value, 'aria-valuetext': format(value),
  });
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = format(v);
    input.setAttribute('aria-valuetext', format(v));
    onInput(v);
  });
  return h('div', { class: 'field' }, h('label', { for: id }, label), input, out);
}

function segmented<T extends string>(
  label: string,
  options: Array<[T, string]>,
  current: T,
  onChange: (value: T) => void,
): HTMLElement {
  const group = h('div', { class: 'segmented', role: 'group', 'aria-label': label });
  const draw = (selected: T): void => {
    group.replaceChildren(...options.map(([value, text]) => h('button', {
      type: 'button', 'aria-pressed': String(value === selected),
      onClick: () => {
        draw(value);
        onChange(value);
      },
    }, text)));
  };
  draw(current);
  return h('div', { class: 'field' }, h('span', { class: 'label' }, label), group);
}

function section(title: string, ...rows: HTMLElement[]): HTMLElement {
  return h('section', { class: 'panel' }, h('h2', { class: 'display', style: 'font-size:.85rem;margin:0 0 .4rem;color:var(--cyan)' }, title), ...rows);
}

function exportDialog(ctx: AppContext): void {
  const area = h('textarea', { readonly: true, rows: 6, 'aria-label': 'Your save as text', style: 'width:100%;font:12px monospace;background:#07060d;color:#f2eeff;border:1px solid #2f2947;border-radius:8px;user-select:text' });
  area.value = ctx.progress.exportText();
  ctx.dialogs.open({
    title: 'Export save',
    body: h('div', {}, h('p', { class: 'muted' }, 'Copy this text and keep it somewhere safe. Import it on any device to restore your progress.'), area),
    actions: [
      { label: 'Close', kind: 'ghost', onClick: () => undefined },
      {
        label: 'Copy', kind: 'primary', keepOpen: true,
        onClick: () => {
          area.select();
          void navigator.clipboard?.writeText(area.value).then(() => ctx.toast('Save copied.'), () => ctx.toast('Select the text and copy it by hand.'));
        },
      },
    ],
  });
}

function importDialog(ctx: AppContext): void {
  const area = h('textarea', { rows: 6, 'aria-label': 'Paste exported save here', style: 'width:100%;font:12px monospace;background:#07060d;color:#f2eeff;border:1px solid #2f2947;border-radius:8px;user-select:text' });
  ctx.dialogs.open({
    title: 'Import save',
    body: h('div', {}, h('p', { class: 'muted' }, 'Paste an exported save. This replaces the progress on this device.'), area),
    actions: [
      { label: 'Cancel', kind: 'ghost', onClick: () => undefined },
      {
        label: 'Import', kind: 'primary',
        onClick: () => {
          if (ctx.progress.importText(area.value)) ctx.toast('Save imported.');
          else ctx.toast('That is not a valid Neon Drift save.');
        },
      },
    ],
  });
}

function resetDialog(ctx: AppContext): void {
  ctx.dialogs.open({
    title: 'Reset progress?', center: true,
    body: h('p', {}, 'This erases all stars, unlocks, bests and trophies on this device. Settings are kept. It cannot be undone.'),
    actions: [
      { label: 'Keep it', kind: 'ghost', onClick: () => undefined },
      {
        label: 'Erase', kind: 'primary',
        onClick: () => {
          ctx.progress.reset();
          ctx.toast('Progress erased.');
        },
      },
    ],
  });
}

/** The settings controls, shared by the full screen and the pause menu. */
export function settingsPanel(ctx: AppContext, withData = true): HTMLElement {
  const s = ctx.settings.value;
  const set = (patch: Partial<Settings>): void => ctx.settings.update(patch);
  const pct = (v: number): string => `${Math.round(v * 100)}%`;
  const root = h('div', { class: 'screen__body' },
    section('Sound',
      toggle('Mute everything', 'Music and effects', s.muted, (v) => set({ muted: v })),
      slider({ label: 'Music', value: s.musicVolume, range: [0, 1, 0.05], format: pct, onInput: (v) => set({ musicVolume: v }) }),
      slider({ label: 'Effects', value: s.sfxVolume, range: [0, 1, 0.05], format: pct, onInput: (v) => set({ sfxVolume: v }) }),
      toggle('Vibration', 'Haptic feedback on impacts and near misses', s.haptics, (v) => set({ haptics: v })),
    ),
    section('Controls',
      segmented('Steering', [['thumb', 'One thumb'], ['buttons', 'Left / right']], s.controls, (v) => set({ controls: v })),
      slider({
        label: 'Sensitivity', value: s.sensitivity, range: [0.8, 1.2, 0.05],
        format: (v) => `${v.toFixed(2)}x`, onInput: (v) => set({ sensitivity: v }),
      }),
    ),
    section('Display',
      segmented('Effects quality', [['auto', 'Auto'], ['high', 'High'], ['medium', 'Med'], ['low', 'Low']], s.quality, (v) => set({ quality: v })),
      segmented('Motion', [['system', 'System'], ['reduce', 'Reduced'], ['full', 'Full']], s.motion, (v) => set({ motion: v })),
      toggle('Screen shake', 'Off removes all camera shake', s.screenShake, (v) => set({ screenShake: v })),
      slider({ label: 'Interface size', value: s.uiScale, range: [0.9, 1.3, 0.05], format: pct, onInput: (v) => set({ uiScale: v }) }),
    ),
  );
  if (withData) {
    root.append(section('Your data',
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Save',
        h('small', {}, ctx.progress.saveWorks ? 'Stored on this device only' : 'Saving is blocked in this browser')),
        h('div', { style: 'display:flex;gap:.4rem' },
          h('button', { class: 'btn', type: 'button', onClick: () => exportDialog(ctx) }, 'Export'),
          h('button', { class: 'btn', type: 'button', onClick: () => importDialog(ctx) }, 'Import'),
        )),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Erase progress', h('small', {}, 'Stars, unlocks, bests and trophies')),
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => resetDialog(ctx) }, 'Reset')),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Defaults', h('small', {}, 'Restore every setting')),
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => { ctx.settings.reset(); ctx.nav.show('settings'); } }, 'Restore')),
    ));
  }
  return root;
}

export function buildSettings(ctx: AppContext): ScreenView {
  const el = h('main', { class: 'screen', 'aria-label': 'Settings' },
    h('div', { class: 'screen__head' },
      h('button', { class: 'btn btn--icon btn--ghost', type: 'button', 'aria-label': 'Back', onClick: () => ctx.nav.back() }, icon('back')),
      h('h1', { class: 'display', tabindex: '-1' }, 'Settings'),
    ),
    settingsPanel(ctx),
  );
  return { el, title: 'Settings' };
}
