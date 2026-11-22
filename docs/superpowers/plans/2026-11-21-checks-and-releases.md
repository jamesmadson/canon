# Checks and releases implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every change to `main` arrives as a pull request that passed the tests and `astro check` (D-141), and `usecanon` is published by a GitHub Action from a version tag with npm trusted publishing (D-142).

**Architecture:** One reusable workflow, `checks.yml`, runs vitest and `astro check`; pull requests run it directly and the release workflow calls it before publishing. Two small Node scripts guard a release: the tag must match `cli/package.json`, and `CHANGELOG.md` must have a section for that version, which becomes the GitHub Release notes. Branch protection is a repository ruleset that James approves.

**Tech stack:** GitHub Actions, Node 22, npm 11.5.1 or later (trusted publishing), vitest, Astro.

**Spec:** D-141 and D-142 in `docs/DECISIONS.md` of the designskills repository, branch `alpha` (commit 954a790).

## Global constraints

- Repository: `jamesmadson/canon`, public. Work on branch `release-process`, from `main` at 4adba38. Nothing is pushed to `main` directly; this branch lands as the first pull request.
- No runtime dependencies in `cli/` or the app. Release scripts use Node built-ins only and live in `scripts/` as `.mjs`.
- `cli/package.json` `engines.node` stays `>=20`. Workflows run Node 22.
- No npm token anywhere: not in a secret, not on a machine. Publishing uses OIDC (`id-token: write`).
- Copy rules: sentence case, no em or en dashes, no tool attribution in commits, pull requests or docs.
- Commits use pathspecs (`git commit -m "…" -- <files>`). Never stash, reset or checkout to restore.
- Repository settings (rulesets) and npmjs.com settings change only after James says yes in chat.

## Review focus

1. A tag whose version differs from `cli/package.json` must stop before publishing, with a message naming both versions.
2. A version with no `CHANGELOG.md` section must stop before publishing, with a message naming the missing heading.
3. A tag on a commit that is not on `main` must stop before publishing.
4. A pull request from a fork must run the checks without any secret or write permission.
5. Re-running a release for a version npm already has must fail clearly before `npm publish`, not halfway.

Each of these has a test or a workflow step in the task that owns it.

---

### Task 1: Clear the astro check errors

`npx astro check` reports 14 errors on 4adba38 (13 at the time of D-141, plus one new in `prototype.ts`). Fix each at its cause. Do not add `@ts-ignore` or `any`.

**Files:**
- Modify: `src/app/prototype.ts:103` (`refusesFraming(here.url)` gets `string | undefined`)
- Modify: `src/app/store.ts:310` (`Uint8Array<ArrayBufferLike>` passed as a `BlobPart`)
- Modify: `tests/app/board-links.test.ts:53,63,75,89,98,106,146` (component with an optional `pairAtLoad` prop passed where `ComponentType<{}>` is expected)
- Modify: `tests/app/canvas-bar.test.ts:120,141` (textarea passed to a helper typed for inputs)
- Modify: `tests/app/home-view.test.ts:180` (props object missing `onTags`)
- Modify: `tests/app/stored-copy.test.ts:24,26` (unused `@ts-expect-error`)

- [ ] **Step 1:** Run `npx astro check`. Expected: `14 errors`, at the locations above.
- [ ] **Step 2:** Fix the two source errors. For `prototype.ts`, guard on `here.url` being a string. For `store.ts`, pass a `BlobPart` the types accept (for example `new Uint8Array(bytes)` or its `.buffer` sliced to length), keeping the bytes identical; the existing stored-copy tests prove that.
- [ ] **Step 3:** Fix the test errors: widen the mount helper or cast at the call site to the component's real props type; type the canvas-bar helper as `HTMLInputElement | HTMLTextAreaElement`; pass `onTags` in `home-view.test.ts:180`; delete the two unused directives.
- [ ] **Step 4:** Run `npx astro check`. Expected: `0 errors`.
- [ ] **Step 5:** Run `npx vitest run`. Expected: every test passes.
- [ ] **Step 6:** Commit: "astro check reports no errors."

### Task 2: Make the tag-filter test wait for the page it expects

`tests/app/tag-filter.test.ts`, "opens already filtered from a shared link, and Back undoes the last choice", fails now and then in a full run and passes alone. Likely cause: `history.back()` fires `popstate` asynchronously, and `settle()` waits a fixed number of ticks. Use superpowers:systematic-debugging to confirm before changing anything.

**Files:**
- Modify: `tests/app/tag-filter.test.ts:228-240`
- Possibly modify: `tests/helpers/` (only if a shared wait helper is the right home)

- [ ] **Step 1:** Reproduce: run `npx vitest run` three times, or the file with a CPU-heavy file beside it, until it fails. Record the failing assertion.
- [ ] **Step 2:** Replace the fixed wait after `history.back()` with a wait on the condition the assertion checks (wait for `popstate`, then for the chip state), with a timeout of 2,000 ms and a failure message naming the expected chips.
- [ ] **Step 3:** Run `npx vitest run` five times in a row. Expected: five green runs.
- [ ] **Step 4:** Commit: "The tag-filter test waits for Back to land instead of a fixed number of ticks."

### Task 3: Checks workflow

**Files:**
- Create: `.github/workflows/checks.yml`
- Create: `tests/repo/workflows.test.ts`

**Interfaces:**
- Produces: a workflow named `Checks` with one job id `checks` (the status check name the ruleset in Task 6 requires), triggered by `pull_request`, `push` to `main`, and `workflow_call` (Task 5 calls it).

- [ ] **Step 1: Write the failing test.** `tests/repo/workflows.test.ts` reads the file as text (no YAML dependency) and asserts:
  - it has `pull_request:`, `workflow_call:` and `push:` with `branches: [main]`
  - it has a job `checks:` that runs `npm ci`, `npx vitest run` and `npx astro check`
  - `permissions:` is `contents: read` and nothing broader
  - it uses `actions/setup-node@v4` with `node-version: 22` and `cache: npm`
  - it does not use `pull_request_target`
- [ ] **Step 2:** Run `npx vitest run tests/repo/workflows.test.ts`. Expected: FAIL, file not found.
- [ ] **Step 3:** Write `checks.yml` to satisfy the test. Add `concurrency: { group: checks-${{ github.ref }}, cancel-in-progress: true }`.
- [ ] **Step 4:** Run the test. Expected: PASS.
- [ ] **Step 5:** Commit: "A Checks workflow runs the tests and astro check on every pull request."

### Task 4: Changelog and release guards

**Files:**
- Create: `CHANGELOG.md`
- Create: `scripts/release-version.mjs`
- Create: `scripts/release-notes.mjs`
- Create: `tests/repo/release-scripts.test.ts`

**Interfaces:**
- Produces: `node scripts/release-version.mjs <tag>`: exits 0 and prints the version when `<tag>` is `v` plus `cli/package.json`'s version; otherwise exits 1 with `Tag v0.1.2 does not match cli/package.json version 0.1.1. Bump the package version or retag.`
- Produces: `node scripts/release-notes.mjs <version>`: prints the body of the `## <version>` section of `CHANGELOG.md` (up to the next `## `) to stdout; exits 1 with `CHANGELOG.md has no "## 0.1.2" section. Add one before tagging.` if it is missing or empty.
- Both export their core as functions for tests: `matchTag(tag: string, version: string): string` (throws with the message above) and `notesFor(changelog: string, version: string): string` (throws likewise).

- [ ] **Step 1: Write the failing tests** for `matchTag` (match, mismatch, tag without `v`, prerelease `v0.2.0-beta.1` matching `0.2.0-beta.1`) and `notesFor` (middle section, last section, missing section, empty section, a heading like `## 0.1.10` not matched by `0.1.1`).
- [ ] **Step 2:** Run them. Expected: FAIL, modules not found.
- [ ] **Step 3:** Implement both scripts. The CLI part reads files relative to the repository root and calls the exported function.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Write `CHANGELOG.md`. Headings are `## <version> · <yyyy-mm-dd>`; the notes script matches on the version alone. Two sections, newest first:
  - `## 0.1.1`: the tester fixes from 2026-11-20 and 2026-11-21 that touch the package: the MCP's not-connected and `canon_pair` text now says to open the link in a new browser tab, and the setup line is `claude mcp add canon --scope user -- npx -y usecanon mcp`. One short line per change, plain words.
  - `## 0.1.0`: first public release.
- [ ] **Step 6:** Run `node scripts/release-notes.mjs 0.1.1`. Expected: the 0.1.1 lines.
- [ ] **Step 7:** Commit: "A changelog, and scripts that check a release tag and pull its notes."

### Task 5: Release workflow

**Files:**
- Create: `.github/workflows/release.yml`
- Modify: `tests/repo/workflows.test.ts`
- Create: `docs/RELEASING.md`

**Interfaces:**
- Consumes: `checks.yml` via `workflow_call` (Task 3); `release-version.mjs` and `release-notes.mjs` (Task 4).

The workflow, on `push` of tags matching `v*`:
1. Job `checks`: `uses: ./.github/workflows/checks.yml`.
2. Job `publish`, `needs: checks`, `permissions: { contents: write, id-token: write }`:
   - checkout with `fetch-depth: 0`
   - refuse unless the tag's commit is on `main`: `git merge-base --is-ancestor "$GITHUB_SHA" origin/main`, with the message "This tag is not on main. Tag a commit that has landed on main."
   - `node scripts/release-version.mjs "$GITHUB_REF_NAME"` into an output `version`
   - refuse if `npm view usecanon@$version version` returns anything, with "usecanon $version is already on npm. Bump the version for a new release."
   - `node scripts/release-notes.mjs "$version" > notes.md`
   - `actions/setup-node@v4` with `node-version: 22` and `registry-url: https://registry.npmjs.org`, then `npm install -g npm@^11.5.1`
   - in `cli/`: `npm publish --access public` (trusted publishing adds provenance; no `NODE_AUTH_TOKEN`)
   - `gh release create "$GITHUB_REF_NAME" --title "$GITHUB_REF_NAME" --notes-file notes.md` with `GH_TOKEN: ${{ github.token }}`

- [ ] **Step 1: Extend the workflow test** to assert: tag trigger `v*`; `id-token: write` only on the publish job; no `NODE_AUTH_TOKEN` or `NPM_TOKEN` anywhere; the ancestor check, both scripts, the `npm view` guard, `npm publish --access public` and `gh release create` appear in that order.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Write `release.yml`.
- [ ] **Step 4:** Run it. Expected: PASS. Run the full suite. Expected: green.
- [ ] **Step 5:** Write `docs/RELEASING.md`, under 40 lines: bump `cli/package.json`, add the `CHANGELOG.md` section, merge the pull request, then `git tag v0.1.2 && git push origin v0.1.2` from an up-to-date `main`, and watch the run. Include what each refusal message means.
- [ ] **Step 6:** Commit: "Tagging a version publishes usecanon from GitHub Actions and makes a GitHub Release."

### Task 6: Open the pull request and protect main

- [ ] **Step 1:** Push `release-process` and open a pull request against `main`. Its description quotes D-141 and D-142 and lists how each part was checked. No attribution line.
- [ ] **Step 2:** Watch the `Checks` run on the pull request. Expected: the `checks` job passes.
- [ ] **Step 3: Ask James** before changing repository settings. Show the exact command: a ruleset on `main` with `pull_request` (0 required approvals, since James is the only maintainer), `required_status_checks` with context `checks` and strict policy, `non_fast_forward`, and `deletion`, with no bypass actors. After his yes, create it with `gh api -X POST repos/jamesmadson/canon/rulesets --input ruleset.json`.
- [ ] **Step 4:** Verify: `gh api repos/jamesmadson/canon/rules/branches/main` lists the four rules.
- [ ] **Step 5:** Merge the pull request once checks pass. Expected: the Pages deploy runs from `main` and succeeds.

### Task 7: First release, 0.1.1

James does Step 1 himself; it is his npm account.

- [ ] **Step 1 (James):** On npmjs.com, open usecanon, Settings, Trusted publishing, and add GitHub Actions with owner `jamesmadson`, repository `canon`, workflow `release.yml`, no environment.
- [ ] **Step 2:** From an up-to-date `main`, `git tag v0.1.1 && git push origin v0.1.1`. Pushing a tag is allowed by the ruleset, which covers `main` only.
- [ ] **Step 3:** Watch the release run. Expected: checks pass, then publish succeeds.
- [ ] **Step 4:** Verify: `npm view usecanon version` prints `0.1.1`; the package page shows provenance; `gh release view v0.1.1` shows the changelog notes; `npx -y usecanon@0.1.1 mcp` starts.
- [ ] **Step 5:** If `docs/HANDOFF.md` in the canon repository lists release or publish steps, replace them with a pointer to `docs/RELEASING.md`, on a branch and through a pull request.
