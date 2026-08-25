# Canon — go-to-market plan

**Strategy in one line:** don't launch the gallery, launch the argument.

Canon-as-gallery is not launch-shaped — no signup, no retention loop, no
measurable outcome, and Figma's official AI skills library now does
discovery better than a solo site can. The launchable asset is the **waste
benchmark**: the first published cost data for AI design tooling. The
gallery is the credential that makes it credible.

Seed quietly with the authors now. Launch loudly on the benchmark later.

---

## Phase 0 — Stop the leak (this week)

Nothing else runs until attention has somewhere to land. Promotion without
capture spends a one-time asset for nothing.

- [ ] **Email capture on `/newsletter`.** Currently no form, no input, no
      mailto — the page cannot capture anything. Buttondown's free tier
      covers 1,000 subscribers. Blocked on James's account ID; a `mailto:`
      link is an acceptable stopgap that works today.
- [ ] **Check `/submit` for the same gap** and wire it to the same place.
- [ ] **Fix the `canon-all.md` label.** It is Canon's best-positioned asset
      and its least promoted — one link, on a secondary page, labelled with
      a filename. Lead with audience and verb: "Using Figma? Download one
      file." Filename becomes secondary text.
- [ ] **Surface the Figma path on the homepage.** One line under the demo
      box: "Not in Claude Code? The same guidance is one file you can
      upload to Figma."
- [ ] **Buy a domain.** `jamesmadson.github.io/canon` reads as a side
      project. That is a real credibility tax when asking someone to
      install software. `canon.design` is unavailable — pick any
      defensible alternative and redirect.

**Done when:** an interested visitor can leave an email address, and a
Figma user can find the file from the homepage.

---

## Phase 1 — Seed with the authors (week 2)

The single highest-yield channel Canon has. Roughly a dozen authors across
twenty skills, several with significant reach — Bakaus (~59k stars),
Kowalski (~30k), Osmani (~87k, adjacent), Thibeaut (~7k). Canon has written
genuine editorial about each. That is a reason to be in touch, not a cold
pitch. One share from a major author outperforms every other channel
available.

- [ ] **Twelve notification emails.** Three sentences: what Canon is, that
      they are in it, an invitation to correct anything. Send the link, not
      a pitch. Notify — do not ask permission for something that does not
      require it (listing and reviewing is criticism).
- [ ] **Two license asks, same wave:**
      - Kyle Zantos — `responsive-craft` has no license, so nobody can
        legally use it. Canon already features three of his skills, which
        earns the standing to ask.
      - Vercel — `vercel-labs/agent-skills` states no license anywhere.
        Almost certainly an oversight at 30k stars. Two Canon entries are
        hidden behind `status: pending-license` until it is resolved.
- [ ] **One genuine permission ask:** Emily Campbell (shapeof.ai) is
      CC-BY-NC-SA. Using that content requires her agreement, and the
      non-commercial clause conflicts with any paid future.

**Expect:** roughly a third reply, a couple share. That is a good outcome
for one afternoon.

---

## Phase 2 — Testers (weeks 2–4)

"Try my site" yields nothing. Canon is mostly static; exactly three things
can fail, and the test should target them.

**What is actually being tested**

1. **Install works on a machine that is not James's** — fresh clone, no
   `gh` auth, a different shell.
2. **The router routes correctly** — does describing a landing page
   reliably pull the marketing kit?
3. **Output improves** — the only question that matters and the hardest to
   answer.

**The ask:** *"Install Canon, do one real piece of design work with it,
tell me what it got wrong."* Fifteen minutes, one concrete deliverable.
Failures are worth more than praise.

**Recruit, in order of yield**

- [ ] People James already knows — designers at NatureQuant, former
      colleagues, anyone who has asked him about AI design tools. Ten
      personal asks beat a thousand impressions.
- [ ] The authors themselves — several will try it out of curiosity about
      how their own skill is being used.
- [ ] Figma Community, once `canon-all` is submitted. Built-in audience;
      comments are feedback.
- [ ] Designer Slack/Discord communities where James already has standing.
      Not cold-posting.
- [ ] Reddit (r/UI_Design, r/Figma) — low signal, use last.

**Instrument it.** Every tester session feeds the benchmark. This is data
collection wearing a feedback hat.

---

## Phase 3 — Publish evidence (weeks 4–8)

- [ ] **The waste benchmark.** Same design task run under each major skill;
      measure tokens, turns, regenerations. Publish the table and the
      methodology. Nobody in the space has cost data. This makes
      "environmentally friendly design" falsifiable and gives every future
      Canon claim a spine.
- [ ] **The audit post.** Seventeen repos — licenses, adoption, structural
      patterns, what is common, what is rare, what nobody has done. Already
      researched; needs writing. Earns links on its own.
- [ ] **The essay:** *Against decorative AI design.*
- [ ] **Submit the constraint skill to Figma's AI skills library.** Their
      taxonomy has Critique and Workflows and no constraint-mode entry.
      Their distribution, Canon's category.

**This is the launch.** Post the benchmark, not the gallery.

---

## Channels, ranked

| Channel | Why it fits |
|---|---|
| Author outreach | Highest yield. Warm, earned, one share moves more than everything else. |
| Figma Community | Right audience, native install, no gatekeeper. |
| The benchmark post | The only genuinely linkable, citable asset. |
| Designer communities | Where James has standing. Not cold. |
| Newsletter | Compounds, but only once capture exists. |

## Deliberately not doing

- **Product Hunt** — wrong audience, one-day spike, no retention to catch
  it.
- **Paid anything** — nothing to convert to yet.
- **A "Canon is live" post before capture exists** — spends the one-time
  attention asset for zero return.
- **Building an X audience from zero** — months of work for a channel that
  is not where designers evaluate tools.

## Open blockers

- Buttondown / Formspree account ID (blocks Phase 0)
- Domain purchase decision
- Brand assets — logo and favicon still not ready; the site currently has
  no `og:image` and ships `twitter:card: summary` as a result
- Constraint skill unfinished — one brainstorm question remains, and its
  Figma submission is a Phase 3 item
