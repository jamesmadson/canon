---
name: strata
license: MIT
description: Use when filing user feedback — interviews, usability sessions, support tickets, stakeholder comments, survey replies, screenshots — into a durable project record, or when asking what users have said about something over time. Also use when someone asks for themes, patterns, or a summary of feedback, or wants to know what was raised and never resolved.
---

# Strata

Feedback accumulates in layers. Each layer keeps the date it was laid down and
the voice that laid it. You read the sequence to know what happened; you never
rewrite a lower layer to agree with a higher one.

The record grows. This skill does not. Nothing here mutates itself — entries
are appended as separate files and read on demand.

## The three states

Every entry separates what a person **said** from what you think they
**meant** from what you **decided**. These are different kinds of knowledge and
collapsing them is how "one person mentioned it'd be nice" becomes "users are
demanding this" by the time it reaches a roadmap.

```markdown
## Said       verbatim only — their words, not yours
## Meant      your reading, marked as yours, may be empty
## Decided    what was actually done — usually empty, and that is fine
```

An empty `Decided` is information. It is how the `open` report finds things
raised repeatedly and never answered.

## Never store an identity

Participants are pseudonyms everywhere this skill writes: `P-04`, or a role
like `the ops lead`. The mapping from pseudonym to real person lives in
`.strata/participants.local.md` and nothing else references it.

On first use, create `.strata/.gitignore` containing `participants.local.md`
before writing any entry. Do this even if the project has no git repository —
one may be added later, and the file must already be excluded when it is.

If feedback arrives with a name attached, assign a pseudonym and write the
pseudonym. Never write the real name, email, or employer into an entry, a
report, or a filename — not once, not "just this one since it's internal."

**Screenshots and recordings:** file into `.strata/assets/`, reference by
relative path. If an asset shows a face, a name, an email, or an account
identifier, say so in the entry and leave the cropping decision to the person —
do not silently file an image you cannot verify.

## Filing an entry

Read [references/intake.md](references/intake.md) for the entry format and the
source types. In short: one file per feedback event, named
`.strata/YYYY-MM-DD-short-slug.md`, dated by when the feedback *happened*, not
when you filed it.

Record only what the source supports. Do not add a severity, a priority, or a
theme at intake — those are readings, and a reading stored in a structured
field becomes indistinguishable from a fact within weeks. Interpretation goes
in `Meant`, in prose, where its author is obvious.

## Reporting

Read [references/reporting.md](references/reporting.md) for the four reports
and how to run them.

**The evidence bar governs every report:**

| Independent participants | What you may call it |
|---|---|
| 1 | a quote — attribute it, do not generalize |
| 2 | a possible pattern — say the count out loud |
| 3 or more | a pattern |

"Independent" means different people who did not hear each other. Two mentions
in one group session is one signal. The same person raising something twice is
one participant with a persistent problem — which is worth reporting, and is
not a pattern.

Every claim in a report carries its entry references. A statement that cannot
be traced back to specific entries does not go in the report.

## Red flags — stop

- About to write a real name into an entry
- About to add `severity:` or `priority:` to frontmatter
- About to call something a theme with fewer than three participants
- About to summarize feedback without linking the entries behind it
- About to edit an old entry so it agrees with a newer one

Old entries are not corrected, they are superseded. Add a new entry and link
back. The record is a sequence, not a current-state document.

## Rationalizations

| Excuse | Reality |
|---|---|
| "It's only internal colleagues, names are fine" | Internal records get exported, shared, and screenshotted. Pseudonymize once, at intake, and the question never arises. |
| "Two people is basically a pattern" | Two is two. Say "two of the seven people we spoke to" and let the reader judge. |
| "I'll tag themes now while it's fresh" | Fresh is exactly when your reading is least tested. Themes emerge at report time, from evidence, not at intake from memory. |
| "The verbatim is long, I'll paraphrase" | The paraphrase is the part that will be wrong in six months. Keep the words; put your compression in `Meant`. |
| "Severity is obvious here" | Then it will still be obvious at report time, when you have more evidence. Severity in frontmatter is a guess wearing a fact's clothing. |
| "Nobody decided anything, leave Decided out" | An empty `Decided` is the whole point. It is what makes unresolved feedback findable. |
