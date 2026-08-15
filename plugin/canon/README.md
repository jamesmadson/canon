# Canon

A Claude Code plugin: one router skill plus three design kits — marketing and
landing sites, product UI and dashboards, and mobile-first review.

## Install

```
/plugin marketplace add jamesmadson/canon
```

Then install the `canon` plugin from that marketplace.

## What you get

- **`canon`** — the router. Reads the task and routes to the kit that
  applies.
- **`canon-marketing-site`** — landing pages, hero sections, pricing pages,
  anything that has to persuade in one scroll.
- **`canon-product-ui`** — dashboards, admin panels, data tables, dense
  interfaces used daily.
- **`canon-mobile-first-review`** — auditing something that already exists on
  a phone: thumb zones, tap targets, safe areas, PWA behavior.

## How it behaves

The router stays dormant until invoked. It activates only when you
explicitly say "canon", name one of its kits, or ask which design skills
apply to a task — it never triggers on general design chatter, and it never
guesses when two routes fit equally; it asks instead.

Once routed, it loads the matching kit skill and follows it. Each kit also
composes named upstream skills; when those are installed in the same
project, the kit defers to them for their own subject.
