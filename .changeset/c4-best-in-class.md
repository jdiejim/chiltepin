---
'chiltepin-core': minor
'chiltepin-render': minor
'chiltepin': patch
'chiltepin-studio': patch
---

`c4` draws the C4 notation. Each element shows its name, a bracketed type line in its category hue (`[Container: Go, gRPC]`) and a description that wraps in full. A person is a head over shoulders, a database a cylinder, a queue a pipe, a web front end a browser window, and a mobile app a phone. Elements outside the scope are neutral and dashed.

Each relationship label states the intent, with the technology in brackets on its own line. A boundary is a dashed, rounded panel that names its scope and its type (`[Software System]`, `[Container]`, `[Enterprise]`), and its label moves to a stretch that no arrow crosses. The key lists exactly the notation a diagram uses. The eyebrow names the diagram type and its scope (`Container diagram · Payments`); `level` is optional, because the deepest element kind sets it.

Auto-layout now reads from the people down. People take the top row, each element sits one row below the nearest element that calls it, the boundary keeps its members in one block of cells, and elements outside the boundary line its sides.

New optional edge field `step`: numbered relationships make a C4 dynamic view, drawn with the circled step numeral. `W_LENS_REPEAT` counts each C4 level and the dynamic view as separate lenses, so a doc can zoom from context to components without a warning. The skill's `c4` entry is shorter and links the new `reference/c4.md`, and `docs/examples/c4-model.md` shows one system at every level.
