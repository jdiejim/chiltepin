# Derivation — claims triage workflow

Part of the **chiltepin** skill. One request, from its facts to its outline.
No YAML on purpose: your request has other facts and gets another outline.

## Who reads it, and what they do next

The claims operations lead decides staffing: how many claims reach an
adjuster each day. The engineers who own the workflow read it too. So the
doc must show every path that ends with a person.

## The inventory

- Our claims team receives about 3,000 claim emails a day.
- A classifier model routes each claim to one of three paths: auto glass,
  property, injury.
- Auto glass: a rules check approves claims under $1,500, with no model.
- Property: a retriever pulls policy clauses from a vector index of 40,000
  policy documents; a drafting model writes a coverage note.
- A citation guard rejects a note that cites no clause id. The drafter
  retries with the guard's errors, at most twice; then an adjuster takes it.
- Injury: always to an adjuster; no model drafts anything.
- Measured on 500 labelled claims: routing accuracy, and the guard pass
  rate on the first draft.
- Not given: the model names, the deployment, who set the two-retry cap.

## Building the first diagram

The whole mechanism goes in one `flow`, loop intact, from the kit:

- the classifier is an `llm`, with one out-edge per named route;
- the policy index is `memory`, and the drafter is a second `llm`;
- the citation check is a `guard`, with a `-x->` repair edge to the drafter;
- a `decision` holds the two-retry cap; its "no" edge to the next step is a
  plain `->`, because it is the normal path;
- each adjuster exit is a `human` node.

Node names are the request's nouns ("Citation guard"), never kinds.

## Headings, in order

- Opening: "Two of three claim routes can finish without a person; injury
  claims always reach an adjuster. A property note that fails the citation
  guard twice goes to an adjuster too."
- **Every route that ends with an adjuster** → the `flow`.
- **Who touches each claim** → `swimlane`, kept because the lead asked.
- **The router is right on most labelled claims; the guard catches the rest**
  → `benchmark` with both measured rates.
- **Open before staffing is set** → `faq`: who chose the two-retry cap, and
  what adjuster time does a third retry cost? The lead answers the first;
  the workflow owners answer the second.

## Left out

- `agentloop` — no step chooses its own next action.
- `block` — the request gave no deployment facts.
- Model names — not given. The doc says "drafting model (assumed: one model
  for both calls)" once, in the drafter's `note`.
