---
name: graft
license: MIT
description: Visualize the current project's Claude Code session history as a Graft-style branch map. Parses the session transcript (never into context), renders trunk + subagent forks + compaction markers as a self-contained HTML tree in the Graft visual language, and delivers the file. Use when the user asks to /graft, map, or visualize their chat/session history.
---

# Graft a session

Render this project's conversation history as a branch map in the visual
language of Graft (jamesmadson.me/graft): monochrome ink on warm ground,
IBM Plex Mono labels, shallow sweep curves, open-circle terminators.

## Hard rules

- **Never read a transcript .jsonl into context.** They can exceed 100MB.
  All parsing happens in a python subprocess that emits a small JSON summary.
- Vanilla SVG + HTML/CSS only. No d3, no CDN, fully self-contained file.
- Trunk = the main session. Forks = subagent/Task launches. Diamond
  markers = compaction boundaries. That is the whole vocabulary.

## Procedure

1. Locate transcripts for the current project:
   `~/.claude/projects/<slug>/*.jsonl` where `<slug>` is the cwd with `/`
   replaced by `-` (a leading `-` included). Default to the largest/most
   recent file; if the user names a session or "all", adapt.

2. Extract a compact summary with a python subprocess. Fields per event:
   role, timestamp, first ~90 chars of text (strip newlines), and markers.
   Detect forks and compactions:

```python
import json, sys, re
path = sys.argv[1]
turns, forks, compactions = [], [], 0
for line in open(path, encoding='utf-8', errors='replace'):
    try: o = json.loads(line)
    except: continue
    t = o.get('type')
    msg = o.get('message') or {}
    role = msg.get('role')
    if t == 'summary' or 'isCompactSummary' in str(o.get('isMeta', '')) or o.get('subtype') == 'compact_boundary':
        compactions += 1; turns.append({'k':'compact'}); continue
    if role in ('user','assistant'):
        content = msg.get('content')
        text = ''
        if isinstance(content, str): text = content
        elif isinstance(content, list):
            for c in content:
                if isinstance(c, dict):
                    if c.get('type') == 'text': text += c.get('text','')
                    if c.get('type') == 'tool_use' and c.get('name') in ('Agent','Task'):
                        d = (c.get('input') or {}).get('description','agent')
                        forks.append({'at': len(turns), 'label': d[:40]})
        text = re.sub(r'\s+',' ', text).strip()
        if text or role == 'user':
            turns.append({'k': role, 's': text[:90]})
print(json.dumps({'turns': turns[:400], 'forks': forks[:30],
                  'compactions': compactions, 'total': len(turns)}))
```

   Adapt field names to what the JSONL actually contains (inspect one line
   with `head -c 2000` first if the schema surprises you). If the session
   is enormous, sample: keep every user turn, drop assistant turns beyond
   the first sentence.

3. Generate ONE self-contained HTML file in the scratchpad
   (`graft-history.html`) and deliver it with SendUserFile
   (`display: "render"`). No external requests of any kind.

## Visual language (match jamesmadson.me/graft exactly)

Tokens:

```css
:root { --bg:#171814; --ink:#EDEEE8; --ink2:#D4D5D0;
        --muted:rgba(237,238,232,.55); --rule:rgba(237,238,232,.14);
        --panel:rgba(237,238,232,.04); --ghost:rgba(237,238,232,.35); }
/* light mode via prefers-color-scheme: bg #F2F2ED, ink #2A2B26 */
```

- Font: system stack for body; `"IBM Plex Mono", monospace` for labels,
  uppercase, letter-spaced, ~11px, `font-variant-numeric: tabular-nums`.
- Trunk: horizontal 2px line, a 6px-radius circle node per user turn
  (assistant turns don't get nodes — they're the line between).
- Forks (subagents): depart with a single shallow cubic sweep,
  `C fx,(y0+(y1-y0)*.55) (fx+33),y1 (fx+60),y1`, one open-circle node,
  label after in mono. **Labels must never overlap**: truncate to ~26
  chars with an ellipsis, then lane-pack per row — greedy interval
  packing where each fork occupies `[fx, fx + 60 + labelWidth]` and takes
  the first lane whose previous occupant ends before it. Row pitch grows
  to fit that row's lane count; rows without forks stay tight. Compute
  the SVG width from the widest fork label extent, not just the trunk.
- Compactions: small ink diamond on the trunk with a `<title>`.
- Hover/focus a node: show that turn's summary in a detail panel that is
  `position: sticky; bottom: 1rem` with an OPAQUE background, so feedback
  is visible while hovering any row of a tall map. Also give each node an
  SVG `<title>` as a native-tooltip fallback. Nodes are `tabindex="0"`
  with `aria-label`; hit area ≥44px via transparent circle.
- Long sessions wrap the trunk into rows (like text) rather than scrolling
  horizontally forever: break every ~14 nodes, connect row-ends with a
  quiet return curve.
- Header: session name, date span, counts line
  ("214 turns · 3 agents · 2 compactions") in mono.
- Footer line: "Generated by /graft · read-only map, no AI behind this box."

## Known gap

Dense fork bursts (many agents launched from nearly the same turn) render
as a fan of parallel sweeps that reads poorly. The intended fix is a
cluster node: collapse a burst into one labeled node ("13 agents") that
lists its members in the detail panel. Until then, expect tall fan rows
on agent-heavy sessions.

## Scope

Static preview only: no editing, no forking real history (that is Graft
v2 on the site). One file out, delivered, done. If the user asks to
compare sessions or map all sessions, lay multiple trunks vertically with
shared scale rather than inventing new vocabulary.
