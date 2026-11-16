# Proposed

Questions the decision log does not cover. Answered ones wait here until
James moves them into `docs/DECISIONS.md`.

## Project 1: names, metadata, automatic tags, star and note

### Answered by James, 2026-11-16

1. **Where Canon reads the page.** The MCP process reads it. On `canon_add`,
   and on `canon_update` with a new URL, the local `canon` process fetches
   the prototype URL once and hands the title and headings to the tab. A
   link it cannot read gets only the source tag.
2. **Where repo and branch come from.** The agent passes them. If it passes
   neither, the `canon` process reads `.git` in its working directory, as
   files, without running git.
3. **What the source tag is.** The agent that added the prototype, such as
   “claude code”. A link dropped by hand gets a tag from its host, such as
   “localhost” or “vercel”.
4. **How much interface.** Data and rules only. Project 1 ships the fields,
   the store actions and the MCP tools. A person edits through their agent
   until project 2 adds the controls.

### My calls, for James to correct

5. **Archived prototypes and `canon_find`.** `canon_find` leaves archived
   prototypes out unless it is called with `archived: true`, and then it
   shows only those.
6. **Tags on `canon_update`.** `tags` adds tags and `removeTags` removes
   them. A removal through the agent counts as the person removing the tag,
   so it stays removed.
7. **A tag the person removed, passed again on purpose.** If an agent
   passes a removed tag by name in `tags`, it comes back. Only automatic
   tags are held back.
8. **Star, note, tags and archive belong to the prototype, across its
   versions.** A new version keeps them.
9. **Dropped zips get no automatic tags yet.** Only links do.
10. **The scripted naming run uses a real agent.** `scripts/naming-run.mjs`
    starts `claude -p` with the Canon tools and checks the three names it
    gives. It needs the Claude command and a login, so it is not part of
    `npm test`.
11. **The library file stays at version 1.** The new fields are optional,
    so an older Canon still opens a newer file.
