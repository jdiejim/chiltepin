---
'chiltepin-render': minor
'chiltepin-core': minor
'chiltepin': minor
'chiltepin-studio': patch
---

Diagrams get colour by category. Six hue tokens (`--hue-blue`, `-green`, `-amber`, `-violet`, `-teal`, `-rose`, each with an opaque `-tint`) say what kind of thing a node is: compute is blue, network and security green, state amber, messaging teal, AI violet, people rose. The renderer picks the hue from the node `kind`: the chip and glyph take the hue and the fill takes its tint. The one accent still marks the focal answer. Group panels and `block` layers take a hue too: `color: teal` names one, and without `color` a panel takes the family most of its nodes share, else the next free hue. A nested group repeats its outermost group's hue. Legends show each kind's chip in its hue. `c4` elements follow the same families.

The AI kit is now part of the box chart. `block` (every preset) draws `agent`, `llm` (`model`), `tool`, `memory`, `vector` (`embeddings`), `human` (`reviewer`), `guard` (`guardrail`, `policy`), `eval` (`judge`, `grader`) and `prompt`, each with its own chip, glyph and hue; `agent` and `llm` draw `tech` as the model chip. `flow` adds the node kinds `guard` and `eval` (additive schema change) and colours every AI kind by family.

`chiltepin block <type>` prints a new "Field notes" section from the schema's `.describe()` notes: the block node `kind` vocabulary (with the AI kit) and the hue names for group and layer `color`.
