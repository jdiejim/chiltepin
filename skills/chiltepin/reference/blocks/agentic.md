# Chiltepin blocks — AI & agents

Part of the **chiltepin** skill (the hub is `SKILL.md`, two folders up).
Run `chiltepin block <type>` for the fields and an example; block → family map:
`INDEX.md`. Schemas reject unknown fields.

**Shape**: Structure & emphasis — four fixed frames for one LLM agent: the
loop (`agentloop`), one real episode (`trace`), the contract (`prompt`), and
the window budget (`context`).
**Answers**: What does the loop do? What can it call? What is the model
told? What fills the window? What did a real run look like?
They compose — the AI / agent recipe in `reference/recipes.md` stacks all
four.
**Not this family**: an AI *workflow* — a RAG pipeline, a router, agents
handing off, a generate → check → repair loop → `flow` (flows.md) with
`kind: agent / llm / tool / human / memory`; each ask gets its own shape,
never the fixed agentloop frame. Several owners per step → `swimlane`; the
deployment around it → `block` (`kind: llm` / `agent`); an improve-and-
re-evaluate cycle → `cycle`; one turn's timing → `sequence`.

### AI & agents

#### `agentloop` — the canonical agent-loop diagram
Environment left, agent card centre, tools stacked right, a memory cylinder
below. Answers: what does one loop turn do, and what can the agent call?
The four numbered arrows are fixed (prompt → tool call → result → response).
List only tools the agent can call; the render shows 5 and folds the rest.
The memory cylinder draws only when `memory:` is present.
`agentloop` for the loop itself; `block` for the deployment around it.

#### `trace` — an agent / session execution transcript
A vertical transcript: one card per turn with a role chip (user, assistant,
tool, system). Answers: what did one real episode do, step by step?
Quote `args` and `result`: JSON braces and colons are YAML syntax. Block
scalars (`|`) keep line breaks.
`trace`, not `sequence`, to follow one conversation; `sequence` for the
timing between services.

#### `prompt` — prompt anatomy with variable highlighting
Stacked segment cards with role kickers; every `{{variable}}` highlights as
a chip. Answers: what is the model told, and where does each value come from?
Quote any `text` that contains `{{ }}`: bare braces are YAML flow syntax.
List each variable in `vars` so the legend explains it.
`prompt`, not `code`, for templates and system prompts; `code` for programs.

#### `context` — context-window token budget
One horizontal bar sized against `window`, segments left to right, free space
dim. Answers: what fills the window, and how much is left?
A sum past `window` draws red past a dashed boundary with an "over budget"
chip. Use it to show the failure case on purpose.
`context` for token budgets; a waterfall `chart` for latency and cost.

#### `neuralnet` — layered network
One column per layer with `units`, `kind` (input / conv / pool / dense /
attention / output …) and `activation`; dense mesh between layers, an
ellipsis when a layer is wider than `maxUnits`. Answers: what is the model's
shape? List the layers a reader would name, not every repeated block: fold
"12 × transformer block" into one `attention` layer with a `note`.
`neuralnet` for the architecture; `flow` (`variant: dag`) for the training
pipeline; `chart` line for loss curves.
#### `modelcard` — model card
Identity, intended use and out-of-scope, training data, metrics per split,
limitations, ethics. Answers: what is this model, and what may it be used
for? The endpoint card for a model: one per deployed model version.
`modelcard`, not `spec`, for a model; `benchmark` to compare candidates.
