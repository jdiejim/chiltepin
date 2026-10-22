---
'chiltepin-render': minor
'chiltepin-core': minor
'chiltepin': minor
'chiltepin-studio': patch
---

Edges in grid diagrams are now routed around the nodes and every label sits on its own edge. A shared obstacle-aware router (`flow`, `block` grid and layered, `c4`, `dfd`, `state`, `felogic`, `graph`, `cluster`, `pkg`, `swimlane`, `threatmodel`) never draws a line through a node, spreads the edges that share a side, keeps parallel runs a track apart, loops a back edge around its row, and moves a line off another edge's label. A label wraps to two lines at most; the column or row gap grows (one gap per grid) to fit it, and a circled numeral with a legend entry is only the last resort for a label with no clear place. `uml` and `usecase` keep their own lines but put their labels on them too. Auto-layout keeps dagre's alignment: a straight chain stays on one row, a parent sits level with the middle of the children it fans out to, and back edges no longer move ranks. New export `geometryReport(type, data)`; `chiltepin check` reports what a layout could not avoid (two nodes in one cell, an edge through a node, a label with no clear place, many crossings) as the new `W_GEOMETRY` warning, with a fix in the block's data.
