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

## Stored copy of a prototype made from code (D-134)

My calls, for James to correct.

1. **Limits on a build folder.** At most 2000 files, 25 MB in all and 500
   characters in a path. They sit in `cli/src/mcp/folder.js` and again in
   `src/app/lib/stage.ts`, and a test keeps the two equal.
2. **What is skipped.** Folders named `node_modules`, any folder starting with
   a dot, and `.DS_Store`. A symbolic link that stays inside the folder and
   points at a file is kept; a link that leaves the folder, breaks, or points
   at a folder is left out.
3. **How files travel.** The bridge refuses arguments over 64 KB, so the MCP
   process sends a new `stage` command carrying base64 pieces of about 36 KB,
   six at a time. The `add` or `update` that follows names the upload. The
   tab holds pieces in memory only, for ten minutes, four uploads at most.
   Pairing and signing are unchanged.
4. **Where the live address lives.** A new optional field `liveUrl` on the
   prototype's version (not on the shared metadata). A stored copy is a
   `files` prototype with that field. Nothing about boards, backups or the
   database version changed.
5. **`canon_update` is how a copy moves forward.** `canon_add` still never
   joins a stack on its own. `canon_update` with a folder adds the next
   version, keeps the name, size, star, note and tags, and keeps the live
   address unless a new `url` comes with it. A link-only prototype that gets
   a folder keeps its link as the live address. A new version is made even
   when the files are identical to the last one.
6. **`canon_update` with only a localhost `url`** still adds a link version,
   as before, and now returns the same warning as `canon_add`. It does not
   quietly change the live address of a stored copy.
7. **A live address that is not on this machine.** It cannot be checked, so
   the Live switch is offered without a check. Only localhost, 127.0.0.1 and
   `[::1]` are ever requested. `*.localhost` names, 0.0.0.0 and private
   network addresses are not.
8. **The check.** One GET of the server's root (not the path), no cookies, no
   headers, answer unread, 2.5 second limit, repeated when the tab regains
   focus. A browser that blocks a request from the hosted app to localhost
   would read as “not running”. I could not test that across browsers.
9. **Where the switch and the message show.** The Live switch is in the
   prototype's panel on a board. The canvas tile and the full-size view follow
   it. Home thumbnails and the project list always show the stored copy, and a
   link to a localhost server keeps its drawing there.

## One page of a built site, and link versions

1. **`canon_update` with a `url` already adds a version.** The brief said a
   link could not get a version through an agent and that `url` alone changes
   the current address. In the code, `url` alone has always added the next
   version (and adds nothing when the address matches the current one), and
   there is no way to change an address in place. I kept that. `newVersion:
   true` only adds the one thing missing: a version even when the address is
   the same. Should `url` without `newVersion` change the address in place
   instead? That would change item 6 above.
2. **Root-absolute paths are rewritten, not served.** The stored copy is
   served from `p/<id>/`, and a path such as `/_astro/x.css` would reach the
   app's own files, so the collector rewrites `/x` to a relative path in the
   kept HTML, CSS and JavaScript. Those files are not byte-identical to the
   build. Is that fine?
3. **What counts as a reference.** Links to other pages (`<a href>`,
   canonical, alternate) are not followed, so one page stays one page. Paths
   that scripts build or fetch at run time are not kept, and the reply lists
   the quoted root paths it noticed. Should the page option follow `<a>`
   links one level?
4. **The page the agent names opens first.** The build reference now carries
   an `entry`, so a page with no `index.html` at the top of the copy opens
   correctly. A build with no HTML file at all is still refused.
5. **The page's own outside requests still happen.** An external script on a
   kept page, such as analytics, runs when the copy is shown. Canon does not
   remove them. Should it?

## The prototype view, blocked pages, feedback and tester mode

1. **Agent links to a prototype on a board still open the board canvas.** Links
   without a board open the new prototype view. Should every agent link open
   the prototype view instead? That changes the link formats in `bridge/ops.ts`
   and their tests.
   Answered by James on 2026-11-18: yes, every agent link to a prototype opens the prototype view, and older saved links redirect to it. Board links still open the board.
2. **Multi-page prototypes open in the prototype view too**, with a page
   picker and a "Page map" link to the old map. The map has the note, star and
   archive bar but no versions menu or Live switch. Is that enough?
3. **A page that refuses framing is only detected when an agent adds it.**
   Chrome fires `load` for a frame that was blocked, so the four second line
   under the frame shows only for a page that never loads at all. A link added
   by hand in the browser shows a blank frame for a blocked site, with "Open in
   new tab" in the top bar. Should a link always carry a quiet "Blank? Open in
   new tab" line?
   Answered by James on 2026-11-18: yes, a link always carries the quiet line, and it shares one line with any other hint.
4. **Search matches the agent name too.** Searching the tag `claude-code` also
   finds prototypes whose source is Claude Code, so the count can exceed the tag
   count (the audit saw 12 results, the cap, not a wrong match). Results now say
   "Showing 12 of N" with a Show all button. Should the match be tag only when
   the query is an exact tag?
5. **Feedback without an address.** With `FEEDBACK_URL` empty the email field is
   hidden and the email is left out of the GitHub issue, because issues are
   public. The owner supplies the Formspree endpoint in
   `src/app/lib/feedback.ts`. `ISSUES_URL` points at `jamesmadson/canon`: is
   that the right repository?
6. **Tester mode lives in localStorage** (`canon-tester-*`), outside the
   library database, and is not part of backups. A sent session contains the
   readable lines only. Is that the form wanted for the owner's inbox?
   Answered by James on 2026-11-18: a sent session also carries the raw events as compact JSON in session_json, so sessions can be tallied.
7. **Disconnect** keeps the native confirm dialog, with new wording, and now
   sits in its own group above the feedback links.
