import { useState } from 'preact/hooks';
import * as store from './store';
import type { Board, Role, Share } from './db';
import { Avatar } from './comments';
import { html, Icon } from './shared';

const ROLE: Record<Role, string> = { view: 'Can view', comment: 'Can comment', edit: 'Can edit' };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Sharing, Figma style: invite people by email with a role, or open the
 * board to anyone with the link. A concept until Canon is hosted: settings
 * are kept, and the link opens the viewer in this browser only.
 */
export function ShareButton({ board }: { board: Board }) {
  const [open, setOpen] = useState(false);
  return html`<button class="btn primary" onClick=${() => setOpen(true)}><${Icon} name="share" />Share</button>
    ${open && html`<${ShareDialog} board=${board} onClose=${() => setOpen(false)} />`}`;
}

export const shareUrl = (boardId: string, role: Role) => `${location.origin}${location.pathname}#/share/${boardId}?role=${role}`;

function ShareDialog({ board, onClose }: { board: Board; onClose: () => void }) {
  const share: Share = board.share ?? { link: 'off', invites: [] };
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('comment');
  const save = (next: Share) => store.setShare(board.id, next);
  const invite = (e: Event) => {
    e.preventDefault();
    const list = email.split(/[,\s]+/).map((x) => x.trim()).filter((x) => EMAIL.test(x));
    if (!list.length) return store.toast('Add an email address.');
    const fresh = list.filter((x) => !share.invites.some((i) => i.email === x));
    save({ ...share, invites: [...share.invites, ...fresh.map((x) => ({ email: x, role }))] });
    setEmail('');
    store.toast(fresh.length === 1 ? `Invited ${fresh[0]} (not sent: concept).` : `Invited ${fresh.length} people (not sent: concept).`);
  };
  const copy = async () => {
    const role = share.link === 'off' ? 'view' : share.link;
    if (share.link === 'off') save({ ...share, link: 'view' });
    try {
      await navigator.clipboard.writeText(shareUrl(board.id, role));
      store.toast('Link copied. It opens the viewer, in this browser only for now.');
    } catch {
      store.toast('The browser refused the clipboard.');
    }
  };
  const me = store.myName() || 'You';
  return html`<div class="scrim" onClick=${(e: MouseEvent) => e.target === e.currentTarget && onClose()}>
    <div class="dialog share" role="dialog" aria-label=${`Share ${board.name}`}>
      <div class="row" style="align-items:center;flex-wrap:nowrap">
        <h3 style="flex:1">Share ${board.name}</h3>
        <span class="chip">Concept</span>
        <button class="btn ghost icon" onClick=${onClose} title="Close"><${Icon} name="x" /></button>
      </div>
      <form class="row" style="flex-wrap:nowrap" onSubmit=${invite}>
        <input class="field" autofocus placeholder="Add emails, separated by commas" value=${email} onInput=${(e: Event) => setEmail((e.target as HTMLInputElement).value)} />
        <select class="select" value=${role} onChange=${(e: Event) => setRole((e.target as HTMLSelectElement).value as Role)}>
          ${(['view', 'comment', 'edit'] as Role[]).map((r) => html`<option value=${r}>${ROLE[r]}</option>`)}
        </select>
        <button class="btn primary">Invite</button>
      </form>

      <div class="share-people">
        <div class="person"><${Avatar} name=${me} size=${28} /><span><b>${me}</b><small>That's you</small></span><span class="faint">Owner</span></div>
        ${share.invites.map(
          (i) => html`<div class="person">
            <${Avatar} name=${i.email} size=${28} />
            <span><b>${i.email}</b><small>Invited · not sent</small></span>
            <select class="select" value=${i.role} onChange=${(e: Event) => save({ ...share, invites: share.invites.map((x) => (x.email === i.email ? { ...x, role: (e.target as HTMLSelectElement).value as Role } : x)) })}>
              ${(['view', 'comment', 'edit'] as Role[]).map((r) => html`<option value=${r}>${ROLE[r]}</option>`)}
            </select>
            <button class="btn ghost icon" title="Remove" onClick=${() => save({ ...share, invites: share.invites.filter((x) => x.email !== i.email) })}><${Icon} name="x" /></button>
          </div>`
        )}
      </div>

      <div class="share-link">
        <span class="way-icon"><${Icon} name="link" /></span>
        <span style="flex:1"><b>Anyone with the link</b><small>${share.link === 'off' ? 'Only people invited can open this board.' : `${ROLE[share.link]}. No account needed.`}</small></span>
        <select class="select" value=${share.link} onChange=${(e: Event) => save({ ...share, link: (e.target as HTMLSelectElement).value as Share['link'] })}>
          <option value="off">No access</option>
          ${(['view', 'comment', 'edit'] as Role[]).map((r) => html`<option value=${r}>${ROLE[r]}</option>`)}
        </select>
      </div>

      <div class="row" style="align-items:center">
        <span class="hint" style="flex:1">Until Canon is hosted, links open only in this browser and invites are not sent.</span>
        <a class="btn ghost" href=${`#/share/${board.id}?role=${share.link === 'off' ? 'view' : share.link}`} onClick=${onClose}>Preview as viewer</a>
        <button class="btn" onClick=${copy}><${Icon} name="link" />Copy link</button>
      </div>
    </div>
  </div>`;
}
