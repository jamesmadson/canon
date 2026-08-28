# Reporting

Reports are read from `.strata/` at the moment they are asked for. Nothing is
precomputed and no report is written back into the record — a report is a view,
not a layer.

Every claim carries its entries. Cite as `(2026-03-11-silent-export,
2026-03-20-save-uncertainty)`. A sentence with no citation does not ship.

## The evidence bar

| Independent participants | Language to use |
|---|---|
| 1 | "P-01 said…" — attribute, never generalize |
| 2 | "two of the people we heard from" — state the count |
| 3+ | "a pattern" |

Independent means they did not hear each other. Check before counting:

- Same person, two entries → **one** participant. Report as persistence.
- Five people in one session → **one** signal, not five.
- A stakeholder and a user → never pooled. Count and report separately.

When the bar is not met, say so plainly. "One person raised this" is a useful
sentence. Inflating it is the failure this skill exists to prevent.

## themes

Group entries by what they are about, apply the bar, report strongest first.

```markdown
## Pattern — no confirmation after a completed action
Three participants (P-01, P-02, P-04) across five weeks.
(2026-03-11-silent-export, 2026-03-20-save-uncertainty,
2026-04-02-duplicate-submissions, 2026-04-14-usability-round-two)

> "I still don't know if a file was generated or where it went" — P-02
> "I clicked save twice more just in case" — P-01

## Possible pattern — unclear who else can see a draft
Two participants (P-01, P-05). Worth one question in the next session.
```

Themes are formed here, from evidence, never assigned at intake.

## timeline

Chronological, grouped by month, so change is visible. Note where a complaint
stops appearing after a decision — that is the closest thing to proof that a
fix worked.

Say plainly when the record is too thin or too new to show a trend.

## participant

One person's arc: every entry, in order, and whether what they raised was ever
decided. Answers "has this got better for them" — the question a follow-up
interview should open with.

## open

Raised by two or more participants, or by the same participant twice, with an
empty `Decided` in every entry.

This is the most useful report and the reason `Decided` is a required section.
It surfaces what a team keeps hearing and keeps not answering. Order by how
long the oldest entry has been sitting.

```markdown
## Open — no confirmation after a completed action
First raised 2026-03-11, most recently 2026-04-14. Three entries, two
participants, no decision recorded.
```

## Refusals

- **No theme without three independent participants.** Say the count instead.
- **No claim without entries behind it.** If it cannot be cited, it is a
  hypothesis — label it one or cut it.
- **No pooling stakeholders with users.** Report separately, always.
- **No inventing a trend from a short record.** Two weeks of entries cannot
  show a trend; say the record is young.
- **No real names in a report**, including one written for internal use. The
  pseudonym is what the record holds and what the report carries.
