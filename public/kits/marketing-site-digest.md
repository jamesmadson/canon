# Marketing / Landing Site — Kit Digest

Attach this file where design work happens but skills can't run — Claude
Design, a claude.ai Project's knowledge base, or any tool that takes an
upload. It's the distilled, portable form of a ten-skill kit. The complete
skills install into `.claude/skills/` via the kit's install script and
should do the heavy work wherever they can run.

Provenance: distilled from skills by Jakub Krehel
(make-interfaces-feel-better, better-writing, better-accessibility), Kyle
Zantos (design-motion-principles), and Meng To
(scroll-scrubbed-visual-sequence, falling-leaves, threejs-landscape) —
MIT; Anthropic (frontend-design, brand-guidelines) — Apache-2.0; and
Vercel Labs (web-design-guidelines) — no license stated. This digest
itself is Canon's own writing, distilled from those skills rather than
copied from them — curated by Canon.

---

## 1 · Brand foundation

> FILL IN before first use: the real palette, type families and scale, logo
> rules, and three adjectives for the voice.

A landing page is the brand's loudest surface, so the rules exist before
the hero does. Name the subject and its world, write a compact token plan
(color, type, layout, one signature element), then self-critique against
the defaults every AI-built landing page collapses toward: the gradient
hero on white, the cream-and-terracotta wellness look, near-black with one
acid accent, Inter-as-safe-choice. Pick one deliberately or avoid them
deliberately — but decide.

## 2 · The page's job

One page, one argument. Before any layout: what should a visitor
understand, believe, and do? Every section either advances that or gets
cut. The hero states the thesis rather than decorating it. Social proof
sits where doubt appears, not in a band at the bottom because that's where
logos go.

## 3 · UI craft floor

- Depth, radius, and spacing from a scale. Concentric radii: inner = outer
  − padding.
- Every interactive element looks interactive; hover, focus-visible,
  active, and loading states all exist.
- Real copy and real images in mockups. Marketing pages are where lorem
  hides the fact that the argument doesn't work yet.
- Set the type scale for the widest hero and the narrowest phone in the
  same pass, not in sequence.

## 4 · Motion & signature moments

The frequency gate still applies — but a marketing page is one of the few
contexts where the top row is the right answer:

| Frequency | Motion budget |
| --- | --- |
| Rare (a visitor sees it once) | Expressive motion welcome |
| Occasional | Subtle and fast |
| Frequent (nav, forms) | Minimal or none |
| Keyboard-initiated | Never animate |

Rules that don't bend: animate `transform` and `opacity` only; enters
slightly slower than exits; `prefers-reduced-motion` fully supported with a
static poster state that still communicates.

**Scroll sequences**: native scroll position is the only source of truth —
never wheel deltas, elapsed time, or autoplay. Define the sequence as data
(scroll length, frame count, poster frame, reduced-motion frame, copy
stops) before building. It must be reversible and usable with motion off.

**Signature moments**: one per page, usually. Ambient motion (drifting
foliage, a live landscape) belongs behind a subject, never competing with
it — a backdrop's job is to make the subject look like it's *somewhere*,
then get out of the way. If a flourish would survive being described in a
sentence to a stakeholder, it's probably earning its place.

## 5 · Copy rules

Marketing copy is the product on this surface.

- Verb-first CTAs naming the action: "Start a project", "See pricing" —
  never "Learn more" twice on one page, never "Click here".
- Plain claims beat clever ones. Specific beats aspirational: a number, a
  named customer, a concrete outcome.
- One voice; tone can be warm here, but errors (forms, failed submissions)
  stay calm and plain.
- Address the reader as "you". Delete every word not doing work.
- Links describe their destination. One capitalization policy throughout.

## 6 · Accessibility floor

Heavy motion and full-bleed art are exactly where these get dropped:

- Native elements first; `<button>` for actions, `<a href>` for navigation.
- Visible `:focus-visible` ring ≥2px, verified against every background it
  crosses — including over imagery and video.
- Text over media needs a verified contrast ratio (≥4.5:1), not a hopeful
  scrim.
- Every pointer interaction has a keyboard path; scroll-driven content must
  be reachable and readable without scrolling animation.
- Hit areas ≥44×44 on touch.
- Autoplaying video: muted, with a pause control, and disabled under
  `prefers-reduced-motion`.

## 7 · Mobile discipline

The first screen on a phone shows the argument, not the navigation. Decide
deliberately: how the hero reflows, whether the signature moment runs at
all on mobile (often it shouldn't — battery and mid-range GPUs are real),
where the primary CTA sits in the thumb zone, and whether long scroll
sequences degrade to static art below a breakpoint.

## 8 · Pre-ship gates

Nothing ships until: a keyboard-only pass reaches every CTA; a 375px pass
shows the argument on the first screen with no horizontal scroll; motion
has been checked against the frequency gate *and* with reduced-motion on;
copy has been read against §5; contrast has been measured over every
background including media; and the page has been loaded once on a real
mid-range phone, not just an emulator.
