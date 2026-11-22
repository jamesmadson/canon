import { h, render, type ComponentType } from 'preact';
import { act } from 'preact/test-utils';
import type { Frame, Project } from '../../../src/app/db';

/** Mounts a component into the document and returns its container. */
export async function mount<P>(Comp: ComponentType<P>, props: NoInfer<P>): Promise<HTMLElement> {
  const box = document.createElement('div');
  document.body.appendChild(box);
  await act(() => { render(h(Comp as ComponentType<any>, props as any), box); });
  return box;
}

export const clear = () => { document.body.innerHTML = ''; };

export const fire = (el: Element, event: Event) => act(() => { el.dispatchEvent(event); });
export const click = (el: Element) => fire(el, new MouseEvent('click', { bubbles: true, cancelable: true }));
export const key = (el: Element | Window, k: string, mods: KeyboardEventInit = {}) =>
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods })); });
export const type = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  input.value = value;
  return fire(input, new Event('input', { bubbles: true }));
};

/** What a screen reader would call a control: aria-label, aria-labelledby, its label, its text, else its title. */
export function nameOf(el: Element): string {
  const aria = el.getAttribute('aria-label');
  if (aria?.trim()) return aria.trim();
  const by = el.getAttribute('aria-labelledby');
  if (by) {
    const text = by.split(/\s+/).map((id) => el.ownerDocument.getElementById(id)?.textContent ?? '').join(' ').trim();
    if (text) return text;
  }
  const labels = (el as HTMLInputElement).labels;
  if (labels?.length) {
    const text = Array.from(labels).map((l) => l.textContent ?? '').join(' ').trim();
    if (text) return text;
  }
  const own = (el.textContent ?? '').trim();
  if (own) return own;
  return el.getAttribute('title')?.trim() ?? '';
}

const CONTROLS = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="combobox"], [role="option"], [role="menuitem"], summary';

/** Every control under root that has no name. */
export function unnamed(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll(CONTROLS)).filter((el) => !nameOf(el)).map((el) => el.outerHTML.slice(0, 120));
}

export const frame = (p: Partial<Frame> & { id: string }): Frame => ({
  projectId: 'p1', name: p.id, kind: 'files', x: 0, y: 0, w: 1280, h: 800, rev: 0, createdAt: 1, updatedAt: 1, entry: 'index.html', ...p,
});
export const project = (id: string, name: string, updatedAt = 1): Project => ({ id, name, createdAt: 1, updatedAt });

/** Fifty named prototypes over eight projects, some starred, some tagged, a few with versions. */
export function fifty(): { frames: Frame[]; projects: Project[] } {
  const projects = Array.from({ length: 8 }, (_, i) => project(`p${i}`, `Project ${i}`, i));
  const topics = ['Pricing', 'Checkout', 'Onboarding', 'Settings', 'Search', 'Profile', 'Billing', 'Invite', 'Dashboard', 'Empty state'];
  const frames = Array.from({ length: 50 }, (_, i) => frame({
    id: `f${i}`, projectId: `p${i % 8}`, name: `${topics[i % topics.length]} screen ${i}`, summary: `Round ${i} of the ${topics[i % topics.length].toLowerCase()} flow.`,
    tags: [topics[i % topics.length].toLowerCase(), i % 3 === 0 ? 'figma' : 'claude code'], tool: i % 2 ? 'Claude Code' : 'Figma', starred: i % 7 === 0,
    createdAt: 1000 + i, updatedAt: 1000 + i,
  }));
  return { frames, projects };
}
