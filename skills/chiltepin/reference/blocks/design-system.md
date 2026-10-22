# Chiltepin blocks — Design system & UI mockups

Part of the **chiltepin** skill (the hub is `SKILL.md`, two folders up).
Run `chiltepin block <type>` for the fields and an example; `chiltepin block`
lists every block by family. Schemas reject unknown fields.

**Shape**: Structure & emphasis — token specimens, usage rules, and low-fi
screens (`palette`, `typescale`, `dodont`, `inventory`, `wireframe`).
**Answers**: What does the UI look like before it exists? What tokens and
styles exist, and what does correct use look like?
**Not this family**: a real screenshot → `figure` (narrative.md); the
component tree → `frontend` (architecture.md); component code → `code`
(tables-data.md); shipped history → `changelog` (planning.md).

### Design system

#### `palette` — color-token swatches
A card grid of swatches: the hex in mono, the token name, its usage. Text
contrast on each swatch is automatic. Answers: which colour tokens exist,
and what is each for? Always quote hex values (`"#0E54A1"`): an unquoted
`#` starts a YAML comment. An invalid colour falls back to gray.
`palette` for colour tokens; `stats` for numbers.

#### `typescale` — a live type specimen
One row per style; the sample text renders live at that size, weight, and
font. Answers: what does each text style look like?
Sizes over 64px render clamped at 64 but keep the true label.
`typescale` when the visual matters; `table` for a token list with no visual
payoff.

#### `dodont` — do / don't guideline cards
Two cards side by side, DO green and DON'T red; both lists are required.
Answers: what does correct use look like? An item's `example` renders
beneath it as a mono chip, good for label copy.
`dodont` for usage rules; `proscons` to weigh a decision; `callout` for one
warning.

#### `inventory` — component / feature status board
Hairline rows, each with a name, a tag chip, an optional note, and a
colour-coded maturity chip. Answers: how mature is each component?
`inventory` for maturity; `statustable` for task work; `changelog` for
shipped history.

#### `wireframe` — low-fi screen mockups (desktop / browser / phone)
Device frames left to right, each a top-to-bottom stack of gray elements.
Answers: what does the UI look like before it exists?
`nav` and `tabs` read their items from a comma-separated `label`; quote it.
`rows` repeats a list or card and sizes text or a spacer.
Keep it low fidelity: a wireframe, not a comp. `figure` for a real
screenshot; `frontend` for the component tree.
