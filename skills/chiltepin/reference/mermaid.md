# Input dialects — Mermaid, DBML, Prisma

Part of the **chiltepin** skill (the hub is `SKILL.md`, one folder up).

Three fence tags hold a body that is not YAML. The parser converts the body
into a typed block at read time; validation and rendering are the same as
for a YAML block. The Markdown file keeps the dialect text until an editor
changes the block; an edit writes the block back as YAML under its
canonical tag.

| Fence | Block | Subset |
|---|---|---|
| ` ```mermaid ` + `sequenceDiagram` | `sequence` | below |
| ` ```mermaid ` + `flowchart` / `graph` | `flow` | below |
| ` ```mermaid ` + `erDiagram` | `erd` | below |
| ` ```mermaid ` + `stateDiagram` / `stateDiagram-v2` | `state` | below |
| ` ```mermaid ` + `pie` | `chart` (`kind: donut`) | below |
| ` ```dbml ` | `erd` | [DBML](#dbml) |
| ` ```prisma ` | `erd` | [Prisma](#prisma) |

SQL DDL is **not** a fence dialect (a ` ```sql ` fence is usually a code
sample). Convert a schema file with `chiltepin sync sql schema.sql --out
docs/data-model.md`; `chiltepin sync dbml` and `chiltepin sync prisma` do the same for
files.

## The rule

Write a dialect fence when you already have the text in that grammar and
the diagram needs only what the subset can say. A Mermaid flowchart drops
three things the kit needs: node `kind` (so no AI kit, no glyphs, no family
hue — every node is a process, a decision, or a start/end), `groups`, and
`accent`. It also has no `title`, `description`, or `lede` — so no figure
caption. Switch to the typed YAML block for any of these, or for
`endpoint`, `foot`, `summary` / `code` / `note` on a message, `guard`, or
an erd `dir` / relation `label`. Never mix: one fence is either dialect
text or YAML.

# Mermaid

A ` ```mermaid ` fence whose first non-comment line is one of the five
keywords above converts. Any other first line (`gantt`, `classDiagram`,
`mindmap`, `gitGraph`, …) is not converted: the fence stays prose and
renders as a plain code block, with no diagnostic. `%%` comment lines are
ignored in every grammar.

## sequenceDiagram

- `participant A`, `participant A as Name`, `actor A as Name` → an actor
  `{ id, name }`. Without `as`, the id is the name. An id used in a message
  but never declared is added at its first use, in order, as Mermaid does.
- Messages: `A->>B: text` sync · `A-->>B: text` response · `A-)B: text`
  async · `A--)B: text` response · `A-xB: text` and `A--xB: text` error ·
  `A->B:` sync · `A-->B:` response. The text after `:` is the label.
- `Note over A,B: text`, `Note right of A: text`, `Note left of A: text` →
  a message `{ from: A, to: B, kind: note }` (`to` is `A` for a one-actor
  note).
- `title Text` → `title`.
- Fragments: `alt text` / `opt text` / `loop text` / `par text` /
  `critical text` / `break text` → a frame open `{ frame, label }`; `else
  text`, `and text`, `option text` → `{ else: text }`; `end` → `{ end: true }`.
  The frame renders as a UML frame around its messages.
- `A->>+B: text` sets `activate: true` on the message (a bar opens on B);
  `B-->>-A: text` sets `deactivate: true` (the bar on B, the sender, closes).
- Ignored: `autonumber`, standalone `activate X` / `deactivate X` lines, and
  `rect` / `box` … `end` (the messages inside are kept; the coloured box is
  lost).
- Any other line is an error (`E_PARSE_MERMAID`, with the line number).

## flowchart / graph

- Direction: `TD` and `TB` → `dir: TB`; `LR`, `RL`, `BT` → `dir: LR`; none →
  `TB`. The renderer lays the nodes out; Mermaid positions are not kept.
- Node shapes: `A[text]`, `A(text)`, `A[/text/]`, `A[\text\]`, `A>text]`,
  `A[(text)]`, `A[[text]]` → process. `A{text}`, `A{{text}}` → `decision`.
  `A([text])`, `A((text))` → `start` when the node has no incoming edge,
  `end` when it has no outgoing edge, otherwise process. A bare `A` uses the
  id as its label. Quotes around a label are removed. Ids keep their Mermaid
  spelling.
- Edges: `A --> B`, `A -->|label| B`, `A -- label --> B`, `A -.-> B`,
  `A -. label .-> B`, `A ==> B`, `A --- B`. A dotted edge (`-.->`) becomes
  `kind: dashed`; a thick edge (`==>`) renders as a plain edge. `A --x B` →
  `kind: error`. `A <--> B` is one edge from A to B.
- Chains `A --> B --> C` and fans `A & B --> C` expand to one edge per pair.
  `;` separates statements on one line.
- Lost: `subgraph … end` framing. The nodes inside are kept; the box is
  dropped, because `flow` groups need grid coordinates and the auto layout
  has none. Add `groups` with `col` / `row` in a YAML `flow` block instead.
- Ignored: `style`, `classDef`, `class`, `click`, `linkStyle`, `direction`
  inside a subgraph, and `:::class` suffixes.

## erDiagram

- `A ||--o{ B : label` → a relation. Left ends `||` `|o` (one) and `}o` `}|`
  (many); right ends `||` `o|` (one) and `o{` `|{` (many). One–one → `1:1`,
  one–many → `1:N`, many–one → `N:1`, many–many → `N:M`. A `..` body sets
  `identifying: false` (dashed); `--` is identifying. The label loses its
  quotes; `""` means no label.
- `A { type name PK "comment" }` → an entity with `columns: [{ name, type,
  pk }]`. `FK` → `fk: true`, `UK` → `unique: true`, the `"comment"` →
  `note`. An entity named only in a relation is added with no columns.
  Names may be quoted: `"Order Line"`.
- Ignored: `direction`.

## stateDiagram / stateDiagram-v2

- `[*]` becomes a pseudo-state node: `_start` (`kind: start`, the filled
  dot) or `_end` (`kind: terminal`, the bullseye). `[*] --> A : event` and
  `A --> [*]` are ordinary transitions from or to that node.
- `A --> B : event` → `{ from, to, event }`. Without `: event` the event is
  the empty string, which renders as an unlabelled arrow.
- `state "Long name" as A` → `{ id: A, name: "Long name" }`. `A : text` sets
  the name of A. A bare `state A` or an id used only in a transition is named
  by its id.
- `direction LR|TB` at the top level → `dir`.
- Lost: composite states `state A { … }` are flattened. The inner states and
  transitions are kept; the container box is dropped. An inner `[*]` gets
  its own pseudo-state, `_start_A` / `_end_A`.
- Ignored: `note … end note` blocks, one-line `note right of A : text`, `--`
  concurrency separators, `<<fork>>`-style stereotypes, `classDef`, `class`.

## pie

- `pie`, optionally followed by `showData` and/or `title Text` on the same
  line. `title Text` on its own line also works.
- `"Label" : 42` → an item `{ label, value }`. Decimals are accepted.
- Result: `{ kind: donut, title?, items }`.

# DBML

A ` ```dbml ` fence always converts to an `erd`. The subset:

- `Table [schema.]name [as Alias] { … }` → an entity. A `schema.` prefix
  sets `schema` (the renderer draws a panel per schema). Header settings
  (`[headercolor: …]`) are dropped.
- Column line `name type [settings]`. Settings: `pk` / `primary key` →
  `pk`; `unique` → `unique`; `not null` → `nullable: false`; `null` →
  `nullable: true`; `default: value` → `default` (quotes and backticks
  removed: `` `now()` `` → `now()`); `note: '…'` → `note`; `ref: > t.c` /
  `< t.c` / `- t.c` / `<> t.c` → a relation (below). `increment` and any
  other `key: value` setting are dropped. A type with spaces must be
  quoted (`"double precision"`); `varchar(255)` and `decimal(10, 2)` work.
- `Note: '…'` (or a `Note: '''…'''` block) inside a table → the entity
  `note`.
- `indexes { (a, b) [unique, name: '…'] }` → `indexes` on the entity; a
  single-column index sets `index` (or `unique`) on the column; `[pk]`
  marks a composite primary key.
- `Ref [name]: a.b > c.d` and the `Ref { … }` block: `>` many-to-one (`a.b`
  is the foreign key, relation `N:1` from `a` to `c`), `<` one-to-many (the
  key is on `c.d`), `-` one-to-one (`1:1`; the key goes on the side whose
  column is not the primary key), `<>` many-to-many (`N:M`, no key).
  Composite ends: `t.(a, b)`. Ref settings (`[delete: cascade]`) are
  dropped. A referenced table that is never declared becomes an `external`
  entity.
- `Enum [schema.]name { value [note: '…'] }` → `enums` (value notes are
  dropped).
- `TableGroup name { t1 t2 }` → `groups`.
- Skipped: `Project { … }`, sticky `Note x { … }`, `TablePartial`; `//` and
  `/* … */` comments.
- Any other line is an error (`E_PARSE_DBML`, with the line number).

# Prisma

A ` ```prisma ` fence always converts to an `erd`. The subset:

- `model X { … }` → an entity; `view X { … }` → `kind: view`. A `///` doc
  comment before the block → the entity `note`.
- Field line `name Type[?|[]] @attrs`. A scalar or enum type → a column
  (`String`, `Int`, `DateTime`, … as written; `String[]` keeps the `[]`;
  `Unsupported("x")` → `x`). `?` → `nullable: true`. `@id` → `pk`;
  `@unique` → `unique`; `@default(v)` → `default` (`uuid()`, `now()`,
  `autoincrement()`, `"str"` unquoted, `dbgenerated("…")` unwrapped). A
  `///` doc comment before the field → `note`.
- A field whose type is another model is a relation field, never a column.
  `@relation(fields: [a], references: [b])` marks `a` as the foreign key
  (`ref: Model.b`) and adds the relation `N:1` from this model — `1:1` when
  the key columns are unique. An optional relation field (`User?`) makes
  the key column nullable. A relation `"name"` becomes the `label`. A list
  on both sides with no `fields` (implicit many-to-many) → one `N:M`. The
  back side of an explicit relation adds nothing.
- `@@id([a, b])` → composite `pk`; `@@unique([...])` / `@@index([...])` →
  `indexes` (single-column ones set `unique` / `index` on the column);
  `@@schema("x")` → `schema`.
- Dropped: `@map` / `@@map`, `@db.*`, `@updatedAt`, `@ignore` / `@@ignore`,
  `onDelete` / `onUpdate`; `datasource`, `generator` and composite `type`
  blocks; `//` comments.
- Any other line is an error (`E_PARSE_PRISMA`, with the line number).

# SQL DDL (`chiltepin sync sql`)

Not a fence. `chiltepin sync sql schema.sql` prints an ` ```erd ` fence; add
`--out docs/data-model.md` to write a doc and validate it. The subset:

- `CREATE TABLE [IF NOT EXISTS] [schema.]name ( … )` with column
  definitions: `name type` (multi-word and parenthesised types work:
  `timestamp with time zone`, `numeric(10, 2)`, `int unsigned`, `text[]`),
  then `NOT NULL` / `NULL`, `PRIMARY KEY`, `UNIQUE`, `DEFAULT expr` (kept
  as text: `now()`, `'open'::order_status`, `CURRENT_TIMESTAMP`),
  `REFERENCES t (c) [ON DELETE …]`, MySQL `COMMENT '…'` → `note`, MySQL
  `ENUM('a','b')` → `enum`. Table constraints: `[CONSTRAINT n] PRIMARY KEY
  (…)`, `UNIQUE (…)`, `FOREIGN KEY (…) REFERENCES t (…)`, MySQL `KEY` /
  `INDEX (…)`. A table `COMMENT = '…'` option → `note`.
- `CREATE [UNIQUE] INDEX … ON t (cols)`, `ALTER TABLE t ADD [CONSTRAINT]
  PRIMARY KEY | UNIQUE | FOREIGN KEY …`, `CREATE TYPE t AS ENUM (…)` →
  `enums`, `CREATE [MATERIALIZED] VIEW v [(cols)] AS SELECT …` → a `view`
  entity (columns from the list or a simple select list), `COMMENT ON
  TABLE | COLUMN … IS '…'` → `note`.
- Postgres `"x"`, MySQL `` `x` `` and SQL Server `[x]` quoting; `--`, `#`
  and `/* … */` comments; `$$` bodies. The `public` / `dbo` schema prefix
  is dropped; any other prefix sets `schema`.
- Dropped: `CHECK`, `AUTO_INCREMENT`, `GENERATED … AS IDENTITY`, `COLLATE`,
  `CHARACTER SET`, `ON DELETE` actions, storage options. Every other
  statement (`INSERT`, `GRANT`, `CREATE FUNCTION`, …) is skipped.
- A `CREATE TABLE` the subset cannot read fails with its line.

# Errors

`E_PARSE_MERMAID`, `E_PARSE_DBML` and `E_PARSE_PRISMA` name the body line
the subset cannot read. Fix the line to match the subset above, or rewrite
the block as typed YAML. A dialect fence never produces `W_ALIAS_TYPE`.
