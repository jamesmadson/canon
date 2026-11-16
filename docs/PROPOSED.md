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

## Project 2: home, project view and the canvas bottom bar

### My calls, for James to correct

12. **Where a drop or a pasted link goes on Home.** The project row it lands on.
    Anywhere else on Home, it goes to the project with the latest work. With no
    project yet, Canon makes one called “My prototypes”. The Add prototype
    button in the header follows the same rule.
13. **The first run shows only the setup line and the drop target.** The sample
    project and the restore offer left that screen. “Try the sample project”
    now sits in the sidebar while there are no projects, and Back up and
    Restore stay in the sidebar footer.
14. **Which note the bottom bar edits.** The bar’s note is the prototype’s
    stored note from project 1, labelled “Prototype note”. The older tool that
    pins a note on a page stays, and is now named “Pin a note on the page”.
15. **Archiving from the bar.** An archived prototype stays on its boards. It
    leaves Home, the project list and search, and shows under Archive on the
    sidebar and the Archived chip in a project. The same button brings it back.
16. **What a thumbnail is.** The stored cover if a link has one, else a lazy
    live page for a prototype whose files Canon keeps (shelf only), else a
    neutral drawing. List rows and links never load a live page, so Home opens
    nothing off the machine. There is no capture system.
17. **Light is the default, dark follows the system.** The whole app moved to
    the new tokens, so boards and dialogs are light too. The dark fills now
    use the brief’s values (fill #2A2927, fill 2 #211F1E), and the older
    colour test in `tests/app/tryout.test.ts` reads them from the dark block.
18. **Sidebar tags.** The eight most used tags, each a link to a list of the
    prototypes that carry it. There is no rename or merge yet. The open
    project no longer expands into its boards in the sidebar; they are under
    the project’s Boards tab.
19. **The Source column.** The agent’s name when there is one, else Files,
    Folder, or the link’s host.
20. **The shelf shows five prototypes per project,** fewer as the window
    narrows, with Open project for the rest.
21. **The arrival keeps its tags.** After a drop the new card keeps showing
    its tags and the orange mark until you leave Home or drop again.
22. **jsdom is a dev dependency** so component tests can render the screens.
