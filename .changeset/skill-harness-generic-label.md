---
'chiltepin-core': minor
'chiltepin': minor
---

The authoring skill works as a harness, and `chiltepin check` flags placeholder names.

- `W_GENERIC_LABEL`: a new warning for a diagram node, actor, or step with a placeholder name — `Service A`, `Service 1`, `Component`, `Node`, `Database`, `DB`, `Backend`, `Frontend`, `Server`, a bare `API`, `Foo`, `Step 1`, `Lorem`, `TODO`, `TBD`, a single letter, `...`. Only the whole label is tested, so `Orders API` and `API Gateway` pass. It reads `sequence` actors, `flow` / `block` / `c4` / `dfd` nodes, `cluster` services, and `swimlane` steps; algorithm `graph` nodes are exempt. `lintGenericLabels` and `isGenericLabel` are exported from core and run beside `validateDocument` in `chiltepin check`, like the density lint.
- `SKILL.md` is a seven-step loop the agent runs with the CLI: ground the request in a fact inventory, plan one block per reader question, read the contract (its example shows grammar, never content), compose from the kit, check and act on each warning code, render and review against slop and template echo, hand off. Assumptions are marked where they are used, never in a leading callout. A tools table lists every authoring command.
- New `reference/kit.md`: node kinds by family for `flow` and `block`, the AI kit (agent, llm, tool, memory, guard, eval, human) with composition rules for RAG, routers, hand-offs, planner–workers–reviewer, generate–check–repair, guardrails, and human gates, the edge vocabulary, groups, and what to change on `W_GEOMETRY`.
- The ten finished example documents are replaced by worked derivations (`reference/derivations/`): request facts → reader questions → outline, with what was left out and what would change the shape. They carry no YAML, so they cannot be filled in as templates. `recipes.md` maps facts to blocks instead of fixed stacks; `patterns.md` loses its copyable diagrams; `agentloop`, `cycle`, `swot`, and `scqa` are marked as fixed frames for requests that already have that shape.
