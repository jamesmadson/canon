# Canon business plan

**Draft, 2026-09-02. Companion to `ROADMAP.md`, `GO-TO-MARKET.md`, and the
v2 PRD. Constraints taken as fixed: no loans, no outside capital, one
maintainer.**

**Thesis in one line:** the package is free forever and can never be
charged for, so Canon sells two things instead: judgment now (no
infrastructure), and the guest surface later (which physically requires a
server).

---

## 1. The tension, stated plainly

D-41 greenlit the hardest possible shape to monetize. Every property that
makes the alpha good makes it unbillable:

| Property | What it costs commercially |
| --- | --- |
| Runs in the customer's repo | No usage to meter. No seat count. No project limit to enforce. |
| Nothing leaves the machine | No identity, no funnel, no idea who installed it or whether they kept it. |
| No hosting | Nothing to resell. The one thing every open-core comparable charges for does not exist here. |
| MIT, plain JS | A license check is twenty lines to delete. Any paid feature shipped inside the package is free to anyone willing to fork. |
| Skill runs burn the customer's tokens | The natural unit of value (a review run) produces no cost on Canon's side and no record of having happened. |

The conclusion is not "add a hook." It is: **stop trying to charge for the
package.** It is distribution, and it is good distribution. Charge for
things it cannot do.

### The one architectural hook worth adding

Canon does not need a monetization hook. It needs a **contact** hook,
because the thing serverless actually costs is not billing, it is knowing
who is out there.

**What:** at the end of `canon init`, one opt-in prompt. "Canon is free
forever. Want occasional notes on what's being built? (y/N)" A `y` opens
the browser at the newsletter page. Nothing is sent from the machine.

**Where:** `cli/src/commands.js`, the tail of `init`, alongside the
existing prompter.

**Friction cost:** one keystroke, once, defaulted to no. That is the
entire price.

**What I would not do:** anonymous aggregate telemetry, even opt-in. The
return is a rough install count. The cost is that "nothing leaves your
machine" stops being literally true, which is the trust asset the whole
security story rests on. Bad trade. Skip it.

---

## 2. Who pays, out of whose budget

The package user and the payer are different people, and the plan breaks
if that is blurred.

**The package user** is a designer or design-engineer. No budget
authority, no line item, cannot pay, and would resent being asked.
Correct call: give them everything, free, forever, at any team size, and
say so loudly. That sentence is worth more as a trust signal than any
revenue it forecloses.

**The judgment buyer** is the same individual, spending differently. Most
product designers at funded companies hold a $500 to $1,500 annual
learning or tools stipend, or will expense a $99 purchase without asking
anyone. **This is the lowest-friction dollar available anywhere in this
plan, and it needs zero infrastructure.** It is currently missing from
the PRD's pricing section, which treats monetization as entirely a
hosted-seat question.

**The seat buyer** is the design lead or founder at a 2 to 15 person
product team. They already carry: Figma at roughly $15 per editor per
month, often a research tool (Dovetail and similar, $30 plus per seat),
sometimes a review tool (Chromatic starts around $149 per month). Canon's
Team tier must be expensed **against one of those existing lines**, not
as a new one. A new line needs a champion and a procurement conversation.
A substituted line needs a receipt and a sentence: "this replaced the
Mural snapshot wall," or "this replaced Dovetail for prototype feedback."
Position accordingly.

**The org buyer** cares about audit trail, SSO, and cross-repo
aggregation. Different motion, different sales cycle. Out of scope until
there are twenty paying teams.

---

## 3. Comparables, and what each actually monetizes

Named because the mechanism matters more than the logo.

| Company | Free | Paid | The actual mechanism |
| --- | --- | --- | --- |
| **Storybook / Chromatic** | The entire library, MIT, enormous adoption | Hosted builds, visual snapshot diffing, review workflow | Sells **compute and storage a laptop cannot provide** (thousands of browser snapshots per build). The OSS was never monetized and was never meant to be. Closest structural match to Canon's hosted plan. |
| **Sentry** | SDKs, and a real self-host path | Hosted ingest, retention, alerting | Sells **the endpoint events are sent to**, metered on volume. Unavailable to Canon by construction: nothing is sent anywhere. |
| **Plausible** | AGPL, genuinely self-hostable | Hosted analytics, priced per pageview | Sells hosting plus not-having-to-run-it, wrapped in an ethics brand. Note the license: **AGPL is the anti-fork moat.** MIT forecloses this. That is a live decision, not a settled one. |
| **Tailwind CSS / Tailwind UI** | The framework | Components and templates, one-time license, no server at all | Sells **taste as a product.** This is the closest match to Canon's stated moat (judgment, curation, D-16) and the model the plan currently under-uses. |
| **Obsidian** | The app, free for personal use, local-first, no telemetry | Sync ($5/mo), Publish ($10/mo), and a **commercial-use license** at $50/user/yr | Two mechanisms worth stealing. First, paid services that require a server the local app cannot be. Second, an **unenforced honesty license** that companies pay anyway because procurement wants compliance. Proof that a local-first tool with no telemetry can hold real revenue. |
| **giscus** | The whole widget, MIT | Nothing | The cautionary tale. Gave away the client *and* leaned on someone else's storage (GitHub Discussions), so no paid seam ever existed. **If Canon's relay is a thin wrapper over GitHub Issues, it repeats this exactly.** The relay has to be Canon's own. |
| **Frame.io** | Trial | Hosted review, comments anchored to the artifact, share links for people without the authoring tool | The willingness-to-pay reference. Sold to Adobe for $1.275B. Same job to be done as the guest surface, different medium. |

**The pattern across all of them:** everyone who monetizes an open tool
sells either (a) a server the local tool cannot be, or (b) content and
taste with no server at all. Nobody successfully sells the local tool.

---

## 4. What Canon sells

Three lines, ranked by how little they cost to build.

### Line B: judgment, sold directly (build first)

Tailwind UI shaped. No backend, no auth, no metering. A payment
processor (Polar or Lemon Squeezy, both handle EU VAT) and a private repo
invite or a gated download.

Candidate products, in order of readiness:

1. **The waste benchmark as a paid report.** Already the launch asset in
   the GTM plan. Publish the headline table free (that is the argument,
   and the argument is the marketing); sell the full methodology,
   per-skill breakdowns, and the reproducible harness. $49 to $99.
2. **A paid kit.** The `system` skill and the team constraint file, the
   two things the roadmap already names as the paid layer. Sold as a
   perpetual license with a year of updates, Tailwind UI's exact terms.
   $99 to $199 per seat.
3. **A workshop or a recorded course** on the method: the record, the
   evidence bar, Said/Meant/Decided, running reviews that change
   decisions. $199 to $499.

Why first: it ships in weeks, it violates nothing in D-41, it monetizes
precisely the thing D-16 names as the moat, and **it is the only line
that survives an employer "no" on independent release.**

Honest weakness: leakable. Tailwind UI proves that is survivable when the
buyer is a professional who wants updates and a clean license.

### Line A: the guest surface, per editor (build only when the wall test fires)

Chromatic shaped. The moment feedback must reach someone without the
repo (legal, copy, a PM, a client), **a server is physically required.**
That is the only place in the entire product where the value and the
server coincide, and it is therefore the only durable metered boundary.

The field already validated the need: four participants pipe screens into
boards so non-repo reviewers can look. The PRD's own wall test governs
when this gets built: three independent teams requesting a guest surface,
filed as record entries under the evidence bar. **Do not build it
before then.**

Pricing, confirming the PRD's draft: charge editors, viewers free and
unlimited, Figma's model because that is the model the buyer already
budgets for. $12 to $15 per editor per month. Team tier carries no SLA,
stated in the open.

Why it is fork-resistant where the package is not: forking the client
gets you nothing without the relay, and nobody forks a service to avoid
$14 a month. They fork when the maintainer disappears. **Fork risk is
therefore an argument for charging for the service, not a threat to it.**

#### The version archive, and why it is the strongest paid feature in the plan

Raised 2026-09-03: *"what's hard is going back and finding a version of
their prototype. What was shared last week, or five weeks ago. That
version of the hero."*

This is the sharpest monetizable job identified so far, for four reasons.

**1. Git already holds the bytes and cannot answer the question.**
`git checkout` returns the exact hero from five weeks ago, and a designer
still cannot see it. The gap is not storage, it is rendering and recall.
The answer requires a *rendered artifact* from that moment, and there are
only two ways to get one: rebuild the old commit now, or have captured it
then.

**2. Rebuilding degrades, and that is the physics boundary.** A six week
old branch frequently will not build: dependencies drift, env vars
rotate, the API it called has changed. Local capture-on-demand works for
recent branches and fails exactly where the need is sharpest. Capturing
at the time requires persistence independent of the repo, which requires
a server. **This clears the Section 6 physics test cleanly**, which the
guest surface does too, but this one clears it for a solo user with no
second reviewer in the picture.

**3. "What we shared last week" is an event query, not a time query, and
that merges two features into one.** If Canon mints the share link, then
**every share is automatically an immutable pinned version.** The archive
becomes a byproduct of an action the user already wanted to take,
requiring no discipline, no cadence job, and no new habit. The guest
surface and the version archive are the same server and largely the same
build. Each makes the other more valuable.

**4. The buyer already pays for exactly this.** Figma version history is
a paid feature; the free tier caps at 30 days, and version history is
routinely cited as a reason teams tolerate Figma's price. Chromatic
prices on snapshot count and retention window. Frame.io, already the
PRD's chosen analogy, is a stack of pinned versions with comments on
each. The willingness to pay is established; nobody has to be convinced
that old versions are worth money.

**Retention economics, which are better than seats.** Value compounds
with tenure: month 12 of an archive is worth more than month 1, and
cancelling forfeits accumulation going forward. That is Backblaze
shaped, and it is a materially better retention curve than per-seat
alone. Storage cost is negligible against it: a capture of ten screens
runs roughly 2MB, so 100 teams sharing twenty times a month is about
4GB a month.

**What is actually hard.** Not storage. Capture reliability: walking
routes, authenticated states, dynamic content. That is the Survey engine
(D-30), and the PRD already predicted this, noting that "every arrow
keeps pointing at capture as the service layer." This is the third
arrow. It argues for building capture earlier than Stage 3.

**The free tier writes itself.** Ship local capture-on-demand in the
package: re-checkout, re-capture, view. It genuinely works for recent
branches, and it fails honestly on old ones, which is precisely the
moment the paid archive sells itself. No crippling required.

This also updates the positioning. The CLI's own tagline is already *the
record of the work*; the archive is the record made visual. The tagline
was right before the product was.

### Line C: services (bridge revenue, deliberately capped)

Design record setup, audits, advisory, a benchmark run against a team's
own stack. High margin, immediate, zero infrastructure, and it doubles as
the highest-quality customer research available. Cap it at roughly one
engagement a month. It funds the no-loans constraint through months 1 to
6 and it must never become the business, because it does not scale and it
eats the maintainer.

### The license-key variant of Line B

Raised 2026-09-03: gate features in the local dashboard and CLI, sell a
key that unlocks them. This is worth taking seriously, and it is **a
licensing decision rather than a pricing one.** It works or fails on one
question, answered before the first npm publish.

**It demonstrably works as a model.** Sidekiq is the proof: a local Ruby
library, no server, Pro and Enterprise sold as commercial gems, reportedly
eight figures a year from what was effectively a solo maintainer. Add
TablePlus, Tower, Dash, Proxyman, JetBrains, and Kaleidoscope. Sublime
Text, Beyond Compare, and Charles Proxy go further and gate nothing at
all, running on an unenforced nag, and remain profitable. None of these
run a server. All of them prove people pay for local software.

**What every one of them has that Canon currently does not:** the source
is either closed or under a license that forbids redistributing a
modified build. That is the whole mechanism. The gate is never
technically strong; it is **legally** strong. Under MIT, it is neither.
MIT explicitly grants the right to modify and redistribute, so a forker
can publish `canon-unlocked` to npm, and be entirely in the right. The
problem is not that the key can be cracked in an afternoon. It is that
cracking it and publishing the result is compliant behavior under the
license Canon chose.

Note also the ecosystem: JS tooling almost never gates locally. Cypress
kept the runner free and charged for the Dashboard; Storybook never
gated and went to Chromatic. npm plus MIT norms make local gating
socially expensive here in a way it is not in Ruby or on the Mac desktop.

**So there are two coherent paths and one incoherent one.**

1. **Source-available, gated, sold.** Move the CLI off MIT before v1.0.0
   to a source-available license (PolyForm Perimeter, BUSL, or Elastic
   2.0): source stays readable, redistribution of an unlocked build is
   prohibited. Keys validate **offline**, ed25519 signature against a
   public key compiled in, no activation server, so "nothing leaves your
   machine" survives intact. This is Sublime's mechanism.
2. **MIT, no gate.** The current plan. Free forever at any team size,
   charge for the relay and for authored content.
3. **MIT plus a license key.** Incoherent. Legally unenforceable,
   socially costly, and it makes "free forever" a line rather than a
   fact the first time it is enforced. Do not do this.

**If path 1: what to gate, and the rule that replaces physics.** Section
6's physics rule stops applying, because the boundary becomes policy and
policy boundaries rot. It needs a replacement that ages as well. The best
one for Canon: **free is the record and the index; paid is the analysis
over them.**

| Free | Paid |
| --- | --- |
| `init`, branch families, staleness, the dashboard, `note`, the raw `.strata/` files | Reports with the evidence bar applied, the contextual skills (`system`, `interface`, `ux`, `copy`) running against your accumulated record, Survey maps, cross-repo aggregation |

This keeps "your data is yours, leaving is `git clone`" completely
intact, which is the promise that must not bend, and charges for exactly
what D-16 names as the moat. It also gives the free tier a real job
rather than making it a crippled demo.

**The synthesis worth noticing:** this is not a fourth revenue line. Paid
CLI features and the paid kit are the same product, judgment, delivered
through the binary instead of through a download. Delivery through the
binary is **better**: the upgrade prompt appears at the moment of need,
the UX is native, and it is recurring rather than one-time. If path 1 is
taken, it does not replace Line B. It becomes Line B.

**What it costs.**

- *The security story survives*, but only with offline keys. Any
  activation callback kills D-41's headline claim.
- *The trust line weakens from "free forever at any team size" to "free
  forever for individuals and small teams."* That is Obsidian's exact
  line, so it is defensible, but it is a real downgrade in a plan that
  currently treats the stronger version as a trust asset.
- *The credential must be firewalled.* The gallery, the kits,
  `canon-all.md`, and the `canon` plugin stay MIT unconditionally. Only
  the CLI would change license. Gating the credential would poison the
  author-outreach motion the entire GTM plan rests on.
- *Support becomes a job.* Refunds, seat moves, key reissues, "it will
  not activate on my new laptop." Keygen.sh plus Polar handles most of
  it. Bounded, not free.

**The deadline.** MIT is perpetual for any version published under it.
The moment `v1.0.0` hits npm as MIT, anyone can fork from that commit
forever, and path 1 is closed in practice even if the license changes
later. **This decision has to be made before the first publish, not
after.** It is the most time-sensitive item in this document.

### Explicitly rejected

- **MIT plus license keys.** See above: unenforceable by construction,
  and it converts "free forever" into marketing.
- **Usage metering.** Nothing to meter, and adding what would be
  meterable breaks the security story.
- **A marketplace rake on other people's skills.** D-26 already killed
  hosting other people's bundles; a rake inverts the curation moat and
  adds legal exposure.
- **Ads, affiliate links, sponsored gallery placement.** Destroys the
  credential, which is the only asset that makes any of the above
  credible.
- **Sponsors as a primary line.** Real but small and unreliable. Turn it
  on, expect nothing, spend zero effort on it.

---

## 5. The rule that keeps free-forever honest

**The boundary between free and paid must be drawn by physics, never by
policy.**

Free: anything that runs on the customer's machine, at any team size.
Paid: anything that requires Canon to run a server, plus content Canon
authored.

The moment a paid feature is one that *could* have been local but was
withheld, "free forever" becomes a marketing line rather than a fact, and
every "that's the paid tier" answer costs goodwill against it. Physics
answers those requests for you: "that needs a relay because the person
reviewing does not have your repo." Policy cannot.

This is the single most important rule in this document. It also gives a
clean test for any future feature: if a laptop can do it, it is free.

---

## 6. Sequencing, and what has to be true at each stage

### Stage 0: distribution (now to week 4)

Ship the package free. Add the contact hook. Land the Phase 0 email
capture from the GTM plan, which is still the blocking dependency for
everything below.

**True before advancing:** alpha assumptions 1 through 3 hold at
NatureQuant. Ten real feedback entries, one review run that changed a
decision.

Revenue: $0. Cost: a domain, and roughly $0 in infrastructure.

### Stage 1: prove someone moves money (month 2 to 3)

Ship one Line B product. Preferably the benchmark report, since the GTM
plan is already building it and it is the launch asset.

**True before advancing:** a list of 200 or more credible names, and at
least three unsolicited requests for more of the judgment layer. First
$1,000 collected.

That first $1,000 is worth far more as information than as cash. It is
the only evidence that anyone in this audience converts at all, and it
arrives without building anything.

### Stage 2: shares and the version archive (month 4 to 8, gated on the wall test)

**The wall test is broader than the PRD states it.** Two walls, not one,
and either firing counts:

- *the guest wall*, someone without the repo needs to review, and
- *the recall wall*, someone needs a version as it was on a date or as
  it was shared.

Three independent teams hitting either, filed under the evidence bar.
The recall wall will almost certainly fire first and more often, because
it hits a solo designer with no second reviewer in the picture.

Then: the relay, share links, pinned versions on every share, Team tier.
Ship sharing and the archive together, since sharing is what creates the
archive.

**True before advancing:** those three teams exist, and at least one of
them names the budget line it comes out of.

Infrastructure cost: Vercel plus Neon plus object storage, under $100 a
month to the first twenty teams. Fundable out of Line B and Line C
revenue, which is what "no loans" requires.

### Stage 3: expansion (month 9 to 18)

Capture and Survey, cross-repo aggregation, Org tier, SSO. Only after
Team retention proves out.

**True before advancing:** month-3 Team retention above 60%, and a
support load one person can carry.

### Ceiling check, said out loud

100 teams at 5 editors and $14 is roughly $84k ARR. 300 teams is roughly
$250k, plus Line B and Line C on top. **That is an excellent solo
business and a bad venture business,** which is exactly the right shape
given no loans and no outside capital. Plan for it deliberately rather
than discovering it at month 18.

---

## 7. Failure modes, honestly

1. **The wall test never fires.** *Downgraded 2026-09-03 from "the most
   likely outcome" to "a real but no longer leading risk."* The original
   reasoning held that a five person team posting a screenshot in Slack
   is good enough, so the guest wall might never arrive. The recall wall
   changes that assessment: needing last week's shared version is a pain
   a solo designer feels without any second reviewer existing, so the
   trigger no longer depends on team composition. The residual risk is
   real, teams do tolerate a lot of mess, but this is no longer the
   likeliest failure. If it does fire, Line A dies and Lines B and C cap
   out around a strong freelance income, which is still why Line B goes
   first.
2. **Free forever eats the paid tier.** Everything valuable will be
   requested in the package. Section 5 is the defense; if that rule ever
   bends, this failure mode is what arrives.
3. **The employer answer is no.** Already a product risk in the PRD; it
   is equally a business risk, because a no removes the platform and
   with it all of Line A. Lines B and C survive it intact. Another
   reason to sequence B first.
4. **Solo maintainer becomes the bottleneck.** A hosted service is an
   on-call obligation. Paid support from one person converts $14 a month
   into unbounded hours. Mitigation: Team tier ships with no SLA, said
   plainly in the pricing table; support is priced at Org.
5. **A neighbor ships the seam.** Vercel adding annotated preview
   comments tied to a decision record would end Line A. Figma building
   it inside the canvas would slow it badly. The PRD's answer holds
   (the record compounds, the relay does not), but the honest version
   is: Line A is the exposed line, and Lines B and C are not.
6. **The year of free grandfathering delays first seat revenue by a
   year.** The PRD offers alpha teams free for a year, which is a good
   trust move and means the **first paying cohort is the second
   cohort.** Worth keeping, worth pricing into the plan, and worth
   noting as a third argument for Line B leading.

---

## 8. Open questions for James

1. **The CLI's license, and it has a deadline.** MIT, AGPL, or
   source-available. MIT forecloses both the Plausible model and the
   license-key path permanently, and it is currently decided by default
   rather than on purpose. **The deadline is the first npm publish**,
   because MIT is perpetual for any version shipped under it. This is
   the most time-sensitive decision in the plan. The gallery, kits,
   `canon-all.md`, and the plugin stay MIT regardless.
2. **Does capture move earlier?** The version archive argues for
   building the capture engine in Stage 2 rather than Stage 3, which
   contradicts the PRD's current sequencing of Survey as post-alpha.
   Capture now serves three jobs, not one.
3. **Which Line B product ships first,** and at what price? The benchmark
   report is closest to done and already the launch asset.
4. **Is an Obsidian-style commercial-use license worth it?** Unenforced,
   honesty-based, roughly $50 per user per year for companies above some
   size. Near zero build cost, low conversion, no downside except the
   sentence itself sitting slightly against "free forever."
5. **Does the independent-release confirmation land?** Gates all of Line
   A. Nothing below Stage 1 depends on it.
6. **What is the actual wall-test count today?** The PRD says three
   independent teams. How many requests are already filed in `.strata/`,
   counting both walls rather than only the guest surface?
