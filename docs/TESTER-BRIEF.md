# Tester brief

The ask is one task, not "check this out." Fifteen minutes, one concrete
deliverable, and the failures are the point.

Feedback goes to **james@jamesmadson.me** for prose, or a GitHub issue at
`jamesmadson/canon` for anything reproducible.

---

## The message to send

> I built Canon — a small collection of design skills for AI tools, plus a
> thing that picks the right one for the job. It's at
> jamesmadson.github.io/canon.
>
> Would you try it on one real piece of work? Fifteen minutes, and I'm after
> what it gets wrong rather than whether you like it.
>
> Install: `/plugin marketplace add jamesmadson/canon` in Claude Code. If you
> work in Figma instead, download canon-all.md from the kits page and upload it
> as a skill — no install needed.
>
> Then just describe the work you're doing — "design the hero for our launch
> page", "review this dashboard", "audit this screen on mobile" — and see what
> comes back.
>
> Three things I most want to hear:
> 1. Did installing it work, or did it fail somewhere?
> 2. Did it pull in guidance that actually fit the task, or something off?
> 3. Was the output better than what you'd have got without it — and if not,
>    where did it fall short?
>
> Blunt is useful. Thanks.

---

## What to tell them up front

So they don't report things already known:

- **Submissions and the newsletter aren't open yet.** Both pages say so.
- **Two skills are hidden.** `web-design-guidelines` and
  `react-view-transitions` are from a repo that states no license, so they're
  withheld until the author adds one. Kits are a skill lighter as a result.
- **No logo yet**, so shared links have no preview image.

## The three failure modes being tested

Everything else is static content; these are the only things that can break.

1. **Install on a machine that isn't mine.** Fresh clone, no `gh` auth, a
   different shell. Most likely first failure — the automated tests prove the
   scripts are well-formed bash, not that the clones succeed.
2. **Routing.** Does describing a landing page reliably reach the marketing
   kit, a dashboard reach product UI, a phone audit reach mobile review?
3. **Output quality.** The only question that matters and the hardest to
   answer. Ask for a comparison against what they'd normally get, not an
   absolute judgment.

## What to capture from each session

Enough to feed the waste benchmark later:

- Which tool (Claude Code, Cursor, Figma, other) and which install path
- The task they described, verbatim if possible
- Which kit it routed to, and whether that was right
- Roughly how many turns before they got something usable
- Anything they had to correct or argue with

## Recruiting, in order of yield

1. People James already knows — designers at NatureQuant, former colleagues,
   anyone who has asked him about AI design tools. Ten personal asks beat a
   thousand impressions.
2. The skill authors themselves, in the same wave as the notification emails.
   Several will try it out of curiosity about how their own work is used.
3. Figma Community, once `canon-all` is submitted.
4. Designer Slack and Discord where James already has standing. Not
   cold-posting.

Ten good sessions is the target. More than that without changing anything is
just repetition.
