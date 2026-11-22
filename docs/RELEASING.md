# Releasing usecanon

Pushing a version tag publishes the `usecanon` package to npm and creates a GitHub Release. The workflow is `.github/workflows/release.yml`.

## Release steps

1. Change `version` in `cli/package.json`.
2. Add a section for that version to `CHANGELOG.md`.
3. Open a pull request with both changes and merge it.
4. From an up-to-date `main`, tag the merge commit and push the tag:

   ```
   git checkout main && git pull
   git tag v0.1.2 && git push origin v0.1.2
   ```

5. Watch the run in the Actions tab. It runs the checks, then publishes.

## If the run refuses

- "This tag is not on main." The tagged commit hasn’t landed on main. Merge first, then tag the merge commit.
- "usecanon X is already on npm." That version exists. Bump `cli/package.json` and tag again.
- The tag and `cli/package.json` disagree. The tag must be `v` plus the package version.
- The changelog section is missing or empty. Add it to `CHANGELOG.md`.

Nothing is published when a refusal happens before the publish step. Delete the bad tag with `git push origin :v0.1.2`, fix the cause, and tag again.

## One-time setup

Publishing uses npm trusted publishing, so there is no token to store. On npmjs.com, open the `usecanon` package settings and add a trusted publisher: GitHub Actions, owner `jamesmadson`, repository `canon`, workflow `release.yml`, no environment.
