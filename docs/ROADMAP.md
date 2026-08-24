# Canon roadmap

Position: **a design practice that publishes skills, with a stated ethic —
a design agent should make less, not more.** The gallery is the credential,
not the product. Aggregation is crowded (Figma's AI skills library,
awesome-design-md, Aura, Seeds); constraint and compute-waste are unclaimed.

## Phase 1 — Consolidate the credential (~2 weeks)

- [ ] Merge `canon-router` and `gallery-adds`; commit the four re-verified
      skill entries so main reflects reality.
- [ ] Add a validated `license` field to the skill schema, shown on every
      card and detail page. License claims stop living in unvalidated prose.
- [ ] Publish the rubric at `/rubric`: what makes a design skill good —
      carries judgment, refuses to be a checklist, states its boundaries,
      bounds its verification, honest provenance. Re-score depth dots
      against it.
- [ ] Finish and ship the constraint skill — Canon's first authored skill
      under its own name. (Brainstorm is one question from done: how the
      no-waste rule behaves at runtime.)
- [ ] Author outreach, after the license field lands: Kyle Zantos
      (license ask for responsive-craft), notifications to Bakaus /
      Thibeaut / Mill / LunkiBR, introductions to Krehel and Kowalski.

Done when: main is current, every entry shows a verified license, the
rubric is public, the constraint skill is installable.

## Phase 2 — Publish evidence nobody else has (weeks 3–8)

- [ ] **The waste benchmark.** Same design task, run under each major
      skill; measure tokens, turns, regenerations. Publish the table and
      the methodology. Nobody in the space has cost data — this makes
      "environmentally friendly design" falsifiable and gives every Canon
      claim a spine.
- [ ] The essay: *Against decorative AI design* — the position piece the
      homepage compresses.
- [ ] Submit the constraint skill to Figma's AI skills library — their
      distribution, our category (they have critique and generation;
      no one has constraint).

Done when: benchmark v1 and essay are live, the skill is in Figma's
library.

## Phase 3 — The practice (months 3+)

- [ ] Crit runner: paste a URL, get a critique against the published
      rubric. First feature that justifies a backend (and app-shape).
- [ ] Community submissions reviewed against the rubric — Canon becomes a
      mark skills earn, not a list they appear on.
- [ ] Designer-lenses skill (Rams/Sottsass/Fukasawa as conflicting
      voices) — the taste-teaching layer, after Canon's own judgment is
      established.
- [ ] Paid layer, if ever: team constraint files authored with Canon's
      method.

## Deliberately not doing

- Plugin configurator / hosting other people's bundles (GitHub gives away
  the mechanism; hosting inverts the curation moat and adds legal exposure).
- PWA before there is state worth installing.
- Download-all for kits (`canon-all.md` already is one; a zip serves
  hoarding, not work).
- Gallery expansion beyond maintenance and genuine gaps.

## Standing tasks

- Re-run `scripts/fetch-skill-trees.ts` on a cadence; commit drift as
  re-verification.
- Correct the NatureQuant install script's license footer (owed).
- Case-study assets for jamesmadson.me (in progress, separate track).
