# Chiltepin blocks — Planning, lists & backlogs

Part of the **chiltepin** skill (the hub is `SKILL.md`, two folders up).
Run `chiltepin block <type>` for the fields and an example; `chiltepin block`
lists every block by family. Schemas reject unknown fields.

**Shape**: Time — what happened or is planned (`timeline`, `changelog`,
`rollout`, `roadmap`, `chevrons`); Grid — one option weighed (`proscons`);
work items and cards (`userstory`, `stories`, `kanban`, `storymap`,
`statustable`, `risk`, `list`, `cvt`, `agenda`, `pattern`, `gallery`).
**Answers**: What work exists, in what state, owned by whom? What shipped when?
**Not this family**: bars against dates → `gantt`; verdicts → `options`; targets → `slo`.

#### `userstory` — agile story + acceptance criteria + links
One story as its own section: role / want / soThat, criteria, links. Use a short
stable `id` (`US-142`); other docs reference it. `links[].ref` (`doc#id`) is a real
cross-reference that `chiltepin check` verifies. Answers: what does done mean? `stories` for many.
#### `timeline` — ordered events or phases, past or planned
A status dot each. Answers: what happens in which order? `changelog` for
releases; `gantt` for bars over periods; `gitgraph` for branches.
#### `changelog` — release history
A rail with a dot per release (red for `tag: breaking`), a version pill, a date,
and typed items. Newest first. Answers: what shipped when?
#### `kanban` — flexible columns
Named columns of cards (Now / Next / Later). Answers: what is in flight?
`kanban` for work in flight; `storymap` for scope; `statustable` for status.
#### `storymap` — user story mapping (backbone + release slices)
Activities across the top; each release slice is a band of cards under the step
they belong to. Each slice's `cells` carries exactly one entry per backbone step,
in order; write `[]` for an empty step. Answers: what do we build, in what order?
#### `rollout` — how a change ships, and what stops it
Stages left to right with traffic share, hold time, and the gate that must pass
before the next stage; the gate belongs to the stage it closes. `rollback` is the
footer: the move, not the wish. Answers: what condition starts the next stage?
#### `statustable` — task table with an update column + colored status pills
Free cells under `columns`, then a Status pill per row; one level of `subtasks`.
`statuses` is your label → colour vocabulary; built-in defaults are in progress,
blocked, completed, todo, done. Any other status fails `chiltepin check`. A parent's status
never rolls up. Answers: what state is each task in? `list` when items carry no status.
#### `risk` — a risk register
One row-card per risk; severity derives from likelihood × impact. Answers: what
could go wrong, and who owns it? `swot` for strategic position.
#### `cvt` — current vs target (before / after)
Two side-by-side panels of items, today and target, with a note. Answers: what
changes between now and the target? `options` when several targets compete.
#### `proscons` — pros vs cons (two columns)
Two columns weighing ONE option. Answers: is this one option worth it?
`options` for several candidates with verdicts; `gallery` for side by side.
#### `agenda` — meeting agenda
Timed rows with duration, title, owner, and description. Answers: what happens
when in this meeting? `agenda`, not `timeline`, for one meeting.
#### `list` — a fancy bullet list (four marker styles)
A bold lead plus text per item; `style` picks accent, check, icon, or number markers.
Answers: what are the points? `statustable` when items carry status; `takeaways` to close.
#### `stories` — a collapsible user-story backlog
Every story as an accordion in one section; `open: true` expands one.
Answers: what is in the backlog? `userstory` for one with its own section.
#### `pattern` — a design-pattern reference card
A GoF-style card: intent, forces, participants, consequences; only `name` is required.
Answers: what does this pattern do and cost? Start from the pattern library in
`reference/system-design.md`; pair with `felogic` (structure) and `sequence` (runtime).
#### `gallery` — a responsive grid of cells
A real grid (2 columns by default, `cols` up to 4). A cell is a note, a `code`
snippet, or a nested `block`: a whole diagram checked against its own schema.
Answers: how do these compare side by side? When the user says "compare X vs Y",
put each side in a cell as a nested block (a `pattern` card or a diagram), not
prose or a table. `gallery`, not `code` with `blocks[]`, for a grid.
#### `chevrons` — process chevron strip
2–8 chevrons left to right, `current` highlighted, a `desc` under each. Answers:
what are the phases, and where are we? `steps` to execute them; `cycle` when it loops.
#### `roadmap` — themes × periods
`themes` as rows, `periods` as columns, items as status chips spanning
`from` … `to`, `now` as a rule. Answers: what ships when, by theme? Coarser
than `gantt` (no days, no dependencies); `kanban` when nothing is dated.
