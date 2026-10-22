# Chiltepin blocks — Charts & overviews

Part of the **chiltepin** skill (the hub is `SKILL.md`, two folders up).
Run `chiltepin block <type>` for the fields and an example; `chiltepin block`
lists every block by family. Schemas reject unknown fields.

**Shape**: the widest family. Time (`chart`, `gantt`, `journey`, `slopegraph`);
Grid (`heatmap`, `quadrant`); Flow (`sankey`); Containment (`treemap`, `venn`);
Network (`graph`, `mindmap`); hierarchy and proportion (`tree`, `pyramid`,
`chart` kinds); causes behind one outcome (`fishbone`).
**Answers**: What changes over time? How does the whole split? Where does the
volume go? Where do items sit on two axes? What causes this?
**Not this family**: one headline number → `bignumber`; a few KPIs → `stats`; exact values →
`table`; boundaries → architecture.md.

#### `graph` — node-link graph
Nodes and edges on a grid, no nesting; `weight` renders on the edge pill.
Answers: what connects to what? For BFS / DFS / Dijkstra walkthroughs set node
`state` (visited, current, frontier, target). `graph`, not `flow`, with no start
or end; not a topology block (a system's boxes and arrows are a `block`).
#### `tree` — indented hierarchy (HTML, not SVG)
Nodes by `parent`. Plain: an indented outline. `variant: issue`: a MECE issue
tree, left to right. `variant: org`: a top-down org chart with `role` under each
name; more than 6 reports stack in two columns. `value` on nodes makes a driver
tree: each node shows its number and its share of its parent. Answers: how does
this break down? `tree`, not `bintree`, for hierarchies; `fishbone` for causes.
#### `mindmap` — radial idea map
One `center`, branches right and left, children; `accent` on one branch is the focus.
Answers: what belongs to this topic? `tree` for a directed hierarchy; `fishbone` for causes.
#### `gantt` — schedule bars
Task bars across named periods, tinted by `kind`. Answers: what runs when?
`gantt`, not `timeline`, when bars span periods.
#### `chart` — a data chart (bar / stacked / line / area / scatter / donut / pie / gauge / radar / waterfall / funnel / pareto / histogram / bell / boxplot / bullet / dumbbell)
`labels` + `series` drive bar, stacked, line, area, radar, dumbbell, and category
scatter; `items` drive donut, pie, gauge, waterfall, funnel, pareto; `points` drive a
numeric scatter with `guides`; `values` drive histogram and bell (or give
`mean` + `sd` and `markers`); `boxes` drive boxplot; `bullets` drive bullet. Answers: how does the number move or split?
Pick the kind by the question: stacked when the total matters as much as the split; gauge for one
number against a ceiling; donut for a whole that sums; waterfall for parts against a `budget`;
funnel for drop-off between ordered stages; radar needs 3+ labels; pareto for the few causes
behind most of the effect (80% rule drawn); histogram for how raw values spread; bell for a normal
curve with named points; boxplot to compare spreads; bullet for a measure vs a target; dumbbell
for two values per row on one axis (before → after); `min` / `max` fix the axis (a 1–5 scale).
#### `sankey` — how much moves between stages
Node height and ribbon width share one scale; nodes are inferred from the links.
Answers: where does the volume go? Declare `nodes` only for a label, an accent, or
a pinned `col`. `sankey` for volumes; `flow` for the path; funnel `chart` for drop-off.
#### `treemap` — proportional composition
Squarified tiles, area = value. Answers: what dominates? `treemap`, not donut, past six parts.
#### `venn` — two or three overlapping sets
Fixed circles; `shared.sets` labels a lens. Answers: what do two groups share?
#### `fishbone` — cause & effect (Ishikawa)
One effect at the head, cause categories as bones, specific causes along each
bone. Keep 1–8 bones and up to 8 short items per bone. Answers: what causes
this? `fishbone`, not `tree`, for suspected causes behind one outcome.
#### `slopegraph` — ranked before / after
One line per item between two value columns on a shared linear scale; crossings
are the story. Quote `left` / `right` years. Give `accent` to the one line the
heading names. Answers: what rose, what fell, what held? `slopegraph` when the rank
order changes; dumbbell `chart` for each row's change; `chart` line for many points.
#### `heatmap` — a numeric grid with an intensity ramp
Cells tinted light-to-deep on one ramp, normalised to the data (or `min` /
`max`). Answers: where is it hot? `heatmap` for a dense value grid; `matrix`
for categorical cells; `table` when the reader needs exact rows.
#### `pyramid` — stacked hierarchy (top → bottom widening)
Levels that widen downward, each with a description. Answers: what rests on
what? `pyramid`, not `layers`, when the widening shape is the message.
#### `quadrant` — 2×2 matrix
Items plotted at `x` / `y` (0–1) on two labelled axes. Answers: where does each
item sit? `quadrant` for placement by judgement; scatter `chart` with `points` for data.
#### `journey` — a staged experience with feelings
Stages across the top, rows of cells beneath, an emotion curve (0–1 per
stage). Answers: what does the user experience and feel at each stage? Funnel
`chart` for drop-off; `storymap` for scope; `timeline` for events, no feelings.
