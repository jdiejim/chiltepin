# Chiltepin blocks — Data model

Part of the **chiltepin** skill (the hub is `SKILL.md`, two folders up).
Run `chiltepin block <type>` for the fields and an example; `chiltepin block`
lists every block by family. Schemas reject unknown fields.

**Shape**: Network — entities joined by cardinality edges, no nesting
(`erd`).
**Answers**: What shape is the data at rest, and how do the entities relate?
**Not this family**: data in motion → `dfd` (flows.md) or `sankey`
(charts-overviews.md); classes with behavior → `uml` (architecture.md);
example rows the reader should scan → `table` (tables-data.md).

### Data model

#### `erd` — entities and relations
Entity cards with columns and key markers, joined by crow's-foot edges. The
renderer centres the aggregate root (the "one" side of most relations), fans
neighbours out by relation depth, and never truncates a card.
Answers: what shape is the data at rest, and how do the entities relate?
Write columns and relations in the terse forms. Use `fromCol` / `toCol` only
when the FK cannot be inferred from `ref` or the column name. `schema` on an
entity, or `groups`, draws a panel around the entities that share it.
Budget: 20 entities or 60 columns per block; `chiltepin check` warns past that.
Split the model by domain.
`erd`, not `uml`, for data at rest; `uml` for classes with behaviour; `dfd`
for data in motion.

### Other ways to write it

A ` ```dbml ` or ` ```prisma ` fence, or a ` ```mermaid ` fence with
`erDiagram`, parses into an `erd`. `chiltepin sync sql schema.sql --out
docs/data-model.md` (or `sync dbml` / `sync prisma`) converts a schema file.
The dialect subsets are in `reference/mermaid.md` (Input dialects).
