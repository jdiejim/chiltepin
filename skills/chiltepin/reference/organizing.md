# Organizing a documentation set

Part of the **chiltepin** skill (the hub is `SKILL.md`, one folder up). One
doc is a story; a docs folder is a *library*. Use this when a project outgrows
a single file — or when you're deciding whether it has.

## Where files live

| Path | What it holds |
| --- | --- |
| `docs/` (or the configured `docsDir`) | All docs. One group level: `docs/<area>/<doc>.md`. Deeper nesting is drift. |
| `dist/` (the build default) | Generated output. Never commit it. |
| `.claude/skills/chiltepin/` (or your agent's skill folder) | The authoring skill, installed with `npx skills add jdiejim/chiltepin`. Not a doc. |
| `chiltepin.config.json` | Project config, at the root. |
| `resources/` (or any folder outside `docsDir`) | Demo and fixture docs. Not part of the built site. |

Doc filenames are kebab-case slugs: lowercase a-z, 0-9, hyphens, `.md`. The
path is the reference prefix (`doc#id`), so slugs are load-bearing. Put a new
doc at `docs/<area>/<doc>.md` — `chiltepin check` warns (`W_DOC_CONVENTION`) when a
name is not kebab-case or a doc sits deeper than one group level.

## Four kinds of document

Readers arrive with one of four needs, and a page that serves two of them
serves neither (the Diátaxis split, used by Canonical, Python, and
Cloudflare). Keep each doc to one kind. `meta.tag` takes one list
(`writing.md`): these four, plus `Design doc`, `ADR`, `Runbook`,
`Postmortem`, and `Spec`.

| Kind | Reader need | Typical blocks |
| --- | --- | --- |
| Tutorial | learn by doing, start to finish | `steps`, `code`, `callout` |
| How-to | get one task done now | `steps`, `flow`, `checklist` items, `table` |
| Reference | look a fact up | `endpoint`, `table`, `erd`, `spec`, `glossary` |
| Explanation | understand why it is this way | `c4`, `sequence`, `options`, `scqa`, `timeline` |

A runbook is a how-to with its own tag. An architecture overview is an explanation. An API
doc is a reference; its "getting started" section is a tutorial and wants
its own page once it passes three steps.

## When to split into multiple docs

One document = **one system (or one job) for one audience**. Split when any of
these hold; otherwise stay in one file — a 4-block doc doesn't need a folder.

- **Two audiences.** An integrator reference and a new-joiner explainer about
  the same service are two docs, not two halves of one.
- **Two systems.** The orders service and the notification pipeline each get a
  doc, even if they talk to each other — connect them with refs, not by merging.
- **Two jobs.** "How it works" (overview) and "what to do at 3am" (runbook)
  read at different speeds. A runbook buried in an architecture doc won't be
  found during the incident.
- **The skim breaks.** If reading only the `##` headings no longer tells one
  story (step 2 of the loop in `SKILL.md`), the extra beats want their own doc.

## Slugs — the path *is* the reference prefix

A doc's **slug** is its path under the docs root without `.md`:
`docs/payments/api.md` → slug `payments/api` → its blocks are referenced as
`payments/api#some-id`. Renaming a file renames every ref to it, so:

- **kebab-case** file and folder names (`getting-started.md`, not
  `GettingStarted.md`).
- **Folders are domains**, not types: `docs/payments/`, `docs/identity/` —
  never `docs/diagrams/` or `docs/misc/`.
- Name for the subject, not the format: `orders-api.md`, not `api-doc-v2.md`.
- Avoid ids named like `section-*` — the renderer uses those for its own
  section anchors.

## The index / overview doc

Give a multi-doc set a landing page — `docs/overview.md` (or
`docs/<domain>/overview.md` per domain). It holds a `meta` block, 2-4
sentences of prose on what the set covers, and one big-picture block (`c4`
context or `archmap`). When the set is large, add a `table` or `list` of the
other docs and the job each does. It's the doc a new reader opens first and the
natural home for ids that many docs reference.

## Cross-doc references

- Ids are **repo-global unique** — `id: seq-place-order` can exist once across
  the whole docs tree, so a ref always has exactly one target.
- **Same doc → prefer `#id`** (survives file renames). Other doc →
  `slug#id` (`payments/api#seq-charge`). In prose, write a link:
  `[the charge flow](payments/api#seq-charge)`.
- Point stories at the diagrams that realize them
  (`userstory.links[].ref` / `stories.items[].links[].ref` — the ref-bearing
  fields), rather than redrawing the diagram in the second doc.
- Draw each diagram in the doc that *owns* it; every other doc links. When a
  system changes, one block changes.
- `chiltepin check` fails on dangling refs and links (`E_DANGLING_REF`,
  `E_DANGLING_LINK`) and duplicate ids across the whole set — run it after
  any rename or move.

## How `chiltepin build` reads the set

`chiltepin build` renders every doc under the docs root into a static site.
`index.html` is a card grid from each doc's `meta` (title, subtitle, tag,
status). Each doc becomes `<slug>.html`, folders keep their nesting, and
links and refs become page links. `chiltepin studio` (Site mode) rebuilds
the same site on every save. Import data instead of retyping it:
`chiltepin sync csv` or `sync openapi` writes a normal doc you edit and check.
