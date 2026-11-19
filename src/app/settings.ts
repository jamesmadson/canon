/** Settings at the foot of the sidebar: one compact panel, for now only Appearance. */
import { useRef, useState } from 'preact/hooks';
import { APPEARANCES, type Appearance, chooseAppearance, readAppearance } from './lib/appearance';
import { html, Icon } from './shared';
import { useDismiss } from './move';

export function Settings() {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<Appearance>(readAppearance);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useDismiss(open, () => setOpen(false), wrap, button);
  const pick = (v: Appearance) => { setChoice(v); chooseAppearance(v); };
  return html`<div class="settings" ref=${wrap}>
    <button type="button" class="settings-btn" ref=${button} aria-haspopup="dialog" aria-expanded=${open} onClick=${() => setOpen(!open)}><${Icon} name="gear" size=${14} />Settings</button>
    ${open && html`<div class="settings-pop" role="dialog" aria-label="Settings">
      <span class="label" id="appearance-label">Appearance</span>
      <div class="seg" role="group" aria-labelledby="appearance-label">
        ${APPEARANCES.map((a) => html`<button type="button" key=${a.value} aria-pressed=${choice === a.value} onClick=${() => pick(a.value)}>${a.label}</button>`)}
      </div>
    </div>`}
  </div>`;
}
