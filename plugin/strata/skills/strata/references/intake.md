# Intake

## First run

Before writing any entry, create the record:

```
.strata/
  .gitignore              contains: participants.local.md
  participants.local.md   pseudonym → real identity
  assets/                 screenshots and recordings
```

`.gitignore` first, always. If it does not exist yet, the next command that
adds files to git will capture the mapping file, and that cannot be undone by
deleting it later.

## participants.local.md

```markdown
# Participants — local only, never committed

P-01 · Holly Cooper · Global Process team · first seen 2026-07-30
P-02 · Ishan Patel · first seen 2026-08-19
S-01 · Priya · VP Design · stakeholder · first seen 2026-08-21
```

Prefix by kind so reports can separate them: `P-` participant, `S-`
stakeholder, `T-` internal teammate. A stakeholder's opinion and a user's
experience are different evidence and must never be pooled into one count.

Where a person consents to attribution, that is theirs to grant in the artifact
they consented to — it does not change what the record stores.

## Entry format

One file per feedback event: `.strata/YYYY-MM-DD-short-slug.md`

```markdown
---
date: 2026-08-19
source: support
participants: [P-01]
about: [persistence, deployment]
assets: []
---

## Said

> Built a working HTML dashboard for a Global process; every edit saves only
> to the local browser. I need an approved enterprise source plus an
> architecture/compliance review before broader deployment.

## Meant

Reads as a graduation problem rather than a storage bug — the prototype works,
it just cannot leave the personal tier. Unverified: I have not asked whether
SharePoint specifically matters or whether any approved source would do.

## Decided

—
```

**date** — when the feedback happened, not when you filed it. A ticket from
three weeks ago is dated three weeks ago, or the timeline lies.

**source** — one of: `interview`, `usability`, `support`, `stakeholder`,
`survey`, `analytics-comment`, `field-note`.

**participants** — pseudonyms only. Multiple for a group session.

**about** — coarse surface tags for retrieval only: which part of the product
this touches. Not themes, not severity. `persistence`, `onboarding`,
`sharing`. If you find yourself writing `frustrating` or `p1`, that belongs in
`Meant`.

**assets** — relative paths under `.strata/assets/`.

## Writing each section

**Said** carries the person's words. Quote them. Where the source is a
recording or a live session and you have no transcript, write what you observed
in plain past tense — *"clicked Share, paused, scrolled back to the top"* — and
mark it as observation, not quotation. Never invent a quote from a memory of
the gist.

**Meant** is yours and reads like it. Name what you are inferring and what you
have not checked. An honest `Meant` usually contains the word "unverified" or
a question you did not get to ask.

**Decided** stays empty until something is actually decided. When it is, write
the decision and its date. If a decision reverses an earlier one, write the new
entry and link the old — never edit the old one.

## Group sessions

One entry per session, all participants listed, and the count stated in
`Said`. Five people in a room who heard each other are not five independent
signals — reports need to know that, and the entry is the only place it can be
recorded.

## Batch intake

When several items arrive at once — a pasted thread, an export, a stack of
tickets — file them as separate entries with their own real dates. Do not merge
a week of feedback into one entry because it arrived in one paste. The
timeline is the asset.
