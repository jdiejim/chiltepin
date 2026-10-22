---
'chiltepin-render': minor
'chiltepin-core': minor
'chiltepin-studio': patch
---

Diagrams now show only what the author wrote, and they cut no label without a mark.

- `flow`: only an edge written `-x->` (or `kind: error`) is an error. A "no" label no longer turns an edge red or removes the success accent of its end.
- `c4`: a boundary encloses its own elements and nothing else. The panel is the hull of their cells, so it can be an L shape or have a hole. Auto-layout moves externals out of the boundary's span. When the author's grid splits a boundary, the geometry report names the element to move to an outer column.
- `usecase`: a case linked from the left sits in the left column, and a case linked from the right sits in the right column. An association ends at the near tip of its case. A line that would cross another case goes through a gap or around the shapes. The `include` and `extend` labels sit on their lines, and long case names wrap.
- `gitgraph`: a branch that is merged twice shows both merges. The name gutter fits the longest branch name. Commits on one lane keep their labels apart.
- `swimlane`: a phase without `to` ends where the next phase starts, and every phase label shows. A step can name its `phase`. With derived columns, the step then stays under that band. Step labels, notes and lane names wrap, and the boxes grow so that no text is cut.
- `sequence`: a note does not take a message number. An activation box that nothing extends is not drawn, and a box opened in a fragment branch closes when the branch ends. Actor names and subtitles wrap inside their heads.
- `state`: a guard shows in brackets (`event [guard]`). A SNAKE_CASE name breaks after `_`. The label of a self-loop sits above its arc. The transition table shows `● start` and `◉ end`, and it is in a closed `<details>`.
- `spans`: the children of a parent connect to one spine, so no connector crosses the text of another row.
- `timing`: the first marked state takes the accent when two states are marked.
- `saga`: past four steps, the cards become narrower so that a long saga fits the page.
- `erd`: a wide schema changes to top-to-bottom when that is narrower. Relations from one row spread apart, and each relation label sits on its own route.
- `archmap`: an area `accent` gives a hue panel. A deprecated tile shows a strikethrough and a `RETIRING` chip.
- `endpoint` and `eventcontract`: a long path or event name breaks only after a `/` or `.`. An auth scope keeps its case.
