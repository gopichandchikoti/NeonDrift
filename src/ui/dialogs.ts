import { h } from './dom';

export interface DialogAction {
  label: string;
  onClick: () => void;
  kind?: 'primary' | 'ghost' | 'default';
  /** Keep the dialog open after the click. */
  keepOpen?: boolean;
}

export interface DialogOptions {
  title: string;
  body: Node;
  actions?: DialogAction[];
  /** Centre the dialog instead of docking it to the bottom. */
  center?: boolean;
  onClose?: () => void;
}

export interface OpenDialog {
  el: HTMLElement;
  close(): void;
}

const FOCUSABLE = 'button:not([disabled]), input, select, textarea, [href], [tabindex]:not([tabindex="-1"])';

/**
 * Opens a modal dialog over the interface. Focus moves into it and is trapped there, Escape and the scrim close it,
 * and focus returns to whatever had it before. Several dialogs stack.
 */
export class Dialogs {
  private readonly stack: OpenDialog[] = [];

  constructor(private readonly layer: HTMLElement) {}

  get isOpen(): boolean {
    return this.stack.length > 0;
  }

  /** Closes the top dialog. Returns false when there was none. */
  closeTop(): boolean {
    const top = this.stack[this.stack.length - 1];
    if (!top) return false;
    top.close();
    return true;
  }

  closeAll(): void {
    while (this.closeTop()) {
      // Each close removes one dialog from the stack.
    }
  }

  open(options: DialogOptions): OpenDialog {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const titleId = `dlg-${this.stack.length}-${Math.floor(performance.now())}`;
    const buttons = (options.actions ?? []).map((action) => {
      const kind = action.kind === 'primary' ? ' btn--primary' : action.kind === 'ghost' ? ' btn--ghost' : '';
      return h('button', {
        class: `btn${kind}`,
        type: 'button',
        onClick: () => {
          if (!action.keepOpen) dialog.close();
          action.onClick();
        },
      }, action.label);
    });
    const panel = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      h('h2', { id: titleId, class: 'display' }, options.title),
      options.body,
      buttons.length > 0 && h('div', { class: 'row' }, ...buttons),
    );
    const scrim = h('div', { class: options.center ? 'scrim scrim--center' : 'scrim' }, panel);
    scrim.addEventListener('pointerdown', (event) => {
      if (event.target === scrim) dialog.close();
    });
    scrim.addEventListener('keydown', (event) => this.trap(event, panel));
    const dialog: OpenDialog = {
      el: scrim,
      close: () => {
        const index = this.stack.indexOf(dialog);
        if (index < 0) return;
        this.stack.splice(index, 1);
        scrim.remove();
        previous?.focus();
        options.onClose?.();
      },
    };
    this.stack.push(dialog);
    this.layer.append(scrim);
    (panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel).focus();
    return dialog;
  }

  private trap(event: KeyboardEvent, panel: HTMLElement): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.closeTop();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
