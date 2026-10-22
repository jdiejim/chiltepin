---
'chiltepin-render': minor
'chiltepin-studio': patch
---

No renderer drops text without showing it. When a label does not fit, the renderer first grows its box. If the text is still too long, the last line ends with "…", the full text goes in a `<title>`, and `check` reports a `W_GEOMETRY` warning that names the field and says how to shorten it.

Long identifiers break at their own joints: `fetch_policy_document` breaks after `_`, `com.example.checkout` after `.`, and `PaymentMethodSelection` before each capital. A number stays on the same line as its unit. All renderers measure text with one table of widths per type role.

Changes per block:

- `block`, `cluster` and `felogic`: cells grow until every name and `tech` fits. A gateway bar is as wide as its longest word. The kind chip no longer covers the name on cylinders, buckets, warehouses, browsers and phones. A `block` with `groups` and nodes that have no `col`/`row` now gives one warning, not one per pair of nodes.
- `packet`: one-bit flags (`ACK`, `SYN`) show their names. A name that does not fit gets a letter, and a key under the drawing lists the letters.
- `array`, `linkedlist` and `hashmap`: all cells share one width, set by the widest value, so `user:1042` shows whole. Pointer labels that would touch move to a second row.
- `uml`: long members wrap with a hanging indent, and classes do not overlap.
- `pkg`: dotted package names wrap at the dots.
- `frontend`: component names wrap at their capitals.
- `agentloop`: every tool shows, in two columns when there are more than five.
- `context`: segments past the window are drawn under a hatch. Neighbouring segments never share a colour.
- `neuralnet`: each legend swatch matches the unit glyph in the drawing.
- `tree`: the `issue` and `org` variants show each value with its unit and its share of the parent.
- `gantt`, `venn`, `cycle`, `treemap`, `fishbone`, `dfd`, `threatmodel` and `wireframe`: these blocks grow to fit their text before they cut any of it.
