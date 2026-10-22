# Check and fix — step 5 of the loop

After you create or edit any doc, run the CLI and fix everything it reports.
**A change is not done until `chiltepin check` passes.** A warning is
feedback on the data: change the YAML, run the check again, and repeat.
Then run `chiltepin review` on the doc and look at what the reader sees.

```
chiltepin check                       # validate all docs: schema, refs, links, lints
chiltepin check docs/orders-api.md    # validate one file (links still resolve against docs/)
chiltepin check --json                # machine-readable: every diagnostic with its code, file, line, value
chiltepin check --strict-prose        # prose warnings become errors
chiltepin review docs/orders-api.md   # check + every block as the reader sees it, with a contact sheet
chiltepin block <type>                # the fields, enums, terse forms, and example for one block
chiltepin html docs/orders-api.md -p  # render and open it (slides … -p for a deck)
chiltepin new <block>                 # print an empty block scaffold (never fill a doc template from a request)
chiltepin build                       # static site (index + nav + search + cross-doc links) → dist/
chiltepin sync openapi spec.yaml --out docs/api.md   # doc from an OpenAPI spec
```

Prefix every command with `npx -y chiltepin@latest` when `chiltepin` is not on PATH.

`chiltepin check` exits non-zero on any error and names the file, line, and
offending value. Warnings never fail the check, but read each one: most name a
real problem.

## Review — look at the doc as the reader sees it

`chiltepin review <file>` runs every `check` diagnostic for the file. Then it
renders the doc in a browser and looks at every block in light and dark at
1280 px, at 400 px (a phone), and in print. It prints one line per issue:

```
error  cut      block 2 · FLOW · Request path — node `pg` tech "Postgres 16 · primary · eu-west-1a" is cut: the drawing shows 4 of its 6 words. Fix: Shorten `tech` on node `pg`.
warn   fit      block 3 · SEQUENCE · Checkout — the drawing is 1802 px wide and scrolls sideways (the stage shows 1600). Fix: Split it at an `alt` frame (one sequence per branch), or remove actors that take part in one message.
```

Each line names the block number, its title, the part of the data, and the
fix in the YAML. Do what the fix says, run `chiltepin review` again, and
repeat until it reports no errors. It exits 1 while an error remains.

| Kind | Level | What the reader sees | What to do |
|---|---|---|---|
| `cut` | error | Text the renderer cut short (`…`), a word that never reached the drawing, text clipped by its box, or text that runs outside its node. | Shorten the named field. Move the detail to `note` or `desc` when the item has one, or give the node `w: 2`. |
| `overlap` | error | Text drawn on other text: two edge labels in one spot, a name that runs into its kind chip. | Do what the fix says: shorten the label, move one box to a free cell, or remove `col`/`row`. A chip over one short name is the renderer's problem: the fix says so, and the level is `warn`. |
| `overlap` | warn | An edge label far from its own line, so it reads as another edge's label. | Shorten the label, or remove `col`/`row` so auto-layout gives the edge room. |
| `fit` | warn | The drawing scrolls sideways or shrinks below 65% (its labels read small), or the block runs past a phone screen. | The fix names the change for the block type: `dir: TB`, fewer `col`/`row`, a split at a decision, an `alt` frame, a handoff, or an aggregate. |
| `tiny` | warn | The block's main text renders under 8 px on a 400 px phone. | Make the drawing narrower (`dir: TB`), or split it into two blocks. |
| `print` | warn | Print clips part of the block (print does not scroll). | Break long lines of code, remove a column, or split the block. |
| `check` | its level | A `chiltepin check` diagnostic inside the block, or in the prose. | See the code tables below. |

Then open `contact-sheet.png` (the path is in the output) and look at it.
It shows every block, numbered, light above dark, with a red frame and badge
on a block that has an error. One PNG per block and theme, the 400 px page,
and `review.json` (every issue, with `block`, `kind`, `level`, `path`,
`field`, and `fix`) are in the same folder. Use `-o <dir>` to choose the
folder and `--json` to print the review as JSON.

## Links in prose

Three forms are internal links. `check` resolves each one and reports
`E_DANGLING_LINK` when the target is missing. `build` turns each one into a
link to the built page.

- `[text](#anchor)` — a block `id:`, a heading id, or a figure anchor in the same doc.
- `[text](other-doc#anchor)` — `other-doc` is the doc path under `docs/` without `.md`.
- `[text](./other.md)` or `[text](../x/other.md#anchor)` — a relative Markdown link.

A heading id is the heading text in lower case, with `-` between words
(`## Order flow` → `#order-flow`). A second `## Order flow` gets
`#order-flow-2`, and a heading that has the same slug as a block `id:` gets
`-2` too. A titled block with no `id:` has the figure anchor
`fig-<slug of its title>`.

## Error codes

Every diagnostic carries a stable code. Apply the matching fix:

| Code | Meaning | First check |
|---|---|---|
| `E_PARSE_YAML` | YAML body failed to parse. | Re-read *YAML pitfalls* in `writing.md`. Unquoted `,`/`:`/`#` in a `desc` is the usual cause. |
| `E_PARSE_MERMAID` | A ` ```mermaid ` body has a line outside the supported subset; the message names the line. | Compare against `mermaid.md`. Fix the line, or write the block as typed YAML. |
| `E_PARSE_DBML` / `E_PARSE_PRISMA` | A ` ```dbml ` / ` ```prisma ` body has a line outside the supported subset; the message names the line. | Compare against `mermaid.md` (Input dialects). Fix the line, or write the block as an `erd` in YAML. |
| `E_SCHEMA` | A field is missing, wrong-typed, or unknown; the message contains the path. | Compare against `chiltepin block <type>`. Do not add undocumented fields — the schema is strict. |
| `E_DANGLING_REF` | A `ref` points at an id that exists nowhere. | Fix the ref string, or add the missing `id:` to the target block. |
| `E_DANGLING_LINK` | A Markdown link in prose points at a doc, block id, or heading that does not exist. The message names the link; `suggestions` holds the closest anchors. | Fix the link: use one of the three forms above. Copy the anchor from the heading text or the block `id:`. |
| `E_SWIMLANE_LANE` | A `swimlane` step's `lane` matches no lane label, id, or index. | Use one of the lane labels the hint lists, exactly as written (case does not matter). |
| `E_DUP_ID` | The same `id:` in two blocks; the message names both. | Ids are repo-global. Rename one. |
| `E_BAD_REF_FORMAT` | A `ref:` is not `doc#id` or `#id` shape. | Match the format; the id slug is `[\w-]+`. |
| `E_UNKNOWN_BLOCK` | A segment claims an unknown block type (rare — unknown fences normally fall through to plain code). | Use exactly one of the types `chiltepin block` lists. |
| `E_ENCODING` | The file on disk is not UTF-8. | Save the file as UTF-8. |
| `E_RENDER` | A renderer failed on a block (`build`, `html`, `review`); the message names the doc and the block. | Check the block against `chiltepin block <type>`. If the data is valid, keep it and report the failure. |

Common `E_SCHEMA` shapes: `Expected string, received number` → quote the
value (`tech: "16"`). `Invalid enum value` → use the documented enum only.
`Unrecognized key(s)` → you added an undocumented field, or an unquoted comma
in a flow-style mapping split a phrase into keys. `meta` fails → it must be
the first block in the file.

## Warning codes

| Code | Meaning | What to do |
|---|---|---|
| `W_EMPTY_BLOCK` | A typed block had an empty body. | Add fields or remove the block. |
| `W_SUSPECT_BLOCK` | A fence tag is within typo distance of a real type (e.g. ` ```sequnce `); it rendered as plain text. | Rename the fence to the suggested type. |
| `W_ALIAS_TYPE` | The fence uses one of the 12 old merged names. It parsed and rendered fine. | Nothing — both spellings work forever. Use the canonical name in new blocks; do not churn existing fences. |
| `W_DENSE_BLOCK` | A diagram is past its density budget. | Split it into two focused blocks. A diagram past its budget reads worse than two. |
| `W_EDGE_LABEL` | A `c4` relationship has no `label`. | Add the verb phrase that crosses the line; at container level add `tech` (the protocol). |
| `W_SEQ_FRAME` | A sequence frame marker is out of order: an `else` or `end` with no open frame, or a frame never closed. | Open each frame (`alt`, `opt`, `loop`, …) before its `else`, and close it with `end`. |
| `W_GROUP_NESTING` | A group's `parent` does not exist, or its cells are not inside the parent's cells. | Fix the `parent` id, or move the child's `col`/`row` inside the parent. |
| `W_GENERIC_LABEL` | A node, actor, step, or group has a placeholder name: `Service A`, `Database`, `DB`, `Backend`, `API` alone, `Step 1`, `TODO`, `X`, or an editor default (`New node`, `New database`, `New group 3`). | Use the real component's name from the inventory (`orders-db`, `Payments API`). If the request names none, ask, or mark the name as assumed. Delete an editor default you did not mean to add, with its edges. Never rename to silence it with another generic word. |
| `W_ORPHAN_NODE` | A node, state, or step that no edge touches, in a diagram that has edges. A node placed inside a group panel of a `block`, `c4`, `felogic`, or `threatmodel` is not reported. | Add the edge that reaches it, or delete it. |
| `W_EMPTY_GROUP` | A group panel whose cells hold no node (checked when every node has `col` and `row`). | Move a node into its cells, widen it with `cols`/`rows`, or delete the group. |
| `W_DUP_EDGE` | The same `from`, `to`, and label written twice. | Delete the copy. Give two different flows between the same nodes their own labels. |
| `W_DECISION_LABEL` | A flow or swimlane decision has two or more branches, and one has no label. | Label each branch with the answer that takes it (`check -> pay: "in stock"`). |
| `W_ERROR_INTO_SUCCESS` | A flow's ends are mixed up: an end that reads as success only error edges reach; an end that reads as a failure no error edge reaches (it draws as the happy path); or an error edge joins the success end while another end exists. | Make the edge kind match the outcome: `-x->` into the failure end, `->` into the success end. Give a failure its own `kind: end`. |
| `W_IDLE_ACTOR` | A sequence actor sends and receives no message. | Add the message it takes part in, or delete the actor. |
| `W_GEOMETRY` | A grid diagram's layout could not avoid a problem: two nodes in one cell, an edge forced through a node, a label with no clear place on its edge (it shows as a number), a label cut short, or many crossings. | Do what the hint says, in the data: move the named node to a free cell, remove `col` and `row` so auto-layout places the nodes, try `dir: TB`, shorten the label, or split the diagram. Never add coordinates to fix it. |
| `W_FIT` | A drawing is wider than the page can show: past 1600 px it scrolls sideways; below 65% of its size its labels read small. | Do what the hint says for the block type: `dir: TB` and fewer `col`/`row` for a flow or a grid diagram; split a sequence at an `alt` frame, a swimlane at a handoff, an `erd` by aggregate. |
| `W_TEMPLATE_ECHO` | Most of the doc is the example text of a `chiltepin new` template. It states facts about a system that is not yours. | Replace every example passage with the facts of your system. Never ship template text. |
| `W_LENS_REPEAT` | A third `callout`, or a fourth block of any other structural type, in one doc. | Merge them, or answer the third question with a different lens — the hint names the usual one. |
| `W_PROSE_*` | A prose rule broke: a sentence or paragraph too long, a perfect or progressive tense, a banned opener, or a meta phrase ("The request names no model", "as requested", "the closing list"). | Apply the prose rules in `SKILL.md` and `style-ste.md`. State the fact, not the request: write "This doc assumes Sonnet." The present perfect with `since` or `for` is allowed in incident and status prose. Block text fields are exempt from the length cap. |
| `W_INLINE_UNKNOWN` | An icon-shaped `:name:` names no icon, a span class is not on the list, a span names two styles, or a `list` / `drivers` `icon` is unknown. The text shows plain, or the icon shows an empty ring. | Use a suggested name. `chiltepin block list` lists every icon. A span takes one hue, `.kbd`, or `.pill` with one status word (`writing.md`, *Inline styling*). |
| `W_HIGHLIGHT_OVERUSE` | More than two `==highlights==` in one section. | Keep the one fact a skimming reader must not miss. Remove the other highlights, or use **bold** for a key term. |
| `W_DOC_CONVENTION` | The file path breaks the on-disk convention. | See `organizing.md`. Never rename a file only to silence this. |

## The final read

After the check passes, reread only the headings and block titles. The skim
must still tell the story from step 1. Cut any section that reads as filler.
