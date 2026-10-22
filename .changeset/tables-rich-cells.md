---
'chiltepin-core': minor
'chiltepin-render': minor
'chiltepin': patch
'chiltepin-studio': patch
---

`table` cells, headers and the note render inline Markdown: `**bold**`, `*em*`, `` `code` `` and links work, and raw HTML stays escaped. A number cell still prints as a number.

A column takes an optional `type`. `num` right-aligns the figures with tabular digits, thousands separators, a true minus sign and the decimals of the most precise value in the column; an optional `unit` prints with each value (`$` before it, `ms` or `%` after it). `check` draws yes · no · partial (or `true` / `false`) as ✓ ✗ – from the shared icons, and keeps the word for screen readers and copy. `bar` adds a quiet bar, scaled to the largest value in the column, beside each number.

A one-cell row `[{ v: Payments, group: true }]` is a section label across the table. The new `foot` field is one totals row under a rule; it does not repeat on each printed page.

The table is calmer: rules instead of stripes between rows, tighter rows, cells aligned to the top, headers aligned to the bottom, and links styled as in prose. On a phone, a table that scrolls keeps its first column in view, and a column never breaks a short hyphenated word such as `ap-southeast-2` or a date. The `journey` grid shares the tighter rows.

`chiltepin check` now reports a row with more cells than the table has columns. This is almost always an unquoted comma in a flow list (`[Light (one block, little prose), Centered]`), and the message says so. Three tables in the guides, and their copies in the `chiltepin init` templates, had this error and are fixed. Other new errors: a `unit` on a column that is not `num` or `bar`, a negative value in a `bar` column, and data beside a group label.

Studio: adding, deleting or moving a table column also updates the `foot` row and leaves group rows alone. `chiltepin review` no longer reads an inline icon as a drawing that shrinks.
