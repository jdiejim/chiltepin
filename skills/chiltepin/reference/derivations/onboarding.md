# Derivation — ingest team, week one

Part of the **chiltepin** skill. One request, from its facts to its outline.
No YAML on purpose: your request has other facts and gets another outline.

## What the new joiner gets

- The ingest tier takes 2.1M spans per second in three regions. The team
  owns the gateway, the sampler, and the Kafka topics between them.
- The week's goal: ship a guarded sampler-config change to staging by
  Friday.
- Three named people with roles and focus, plus a help channel with a
  median answer time of 11 minutes.
- Four day-one setup steps with exact commands; one step needs an access
  role.
- One danger: `make replay` against a production broker puts replayed
  spans in customer dashboards.
- A five-day plan, two days done.
- Five team terms: span, drop rate, head sampling, tail sampling, tenant.

Reader: a new engineer on day one, with the doc open beside a terminal.

## Task labels, not claims

This is a tutorial. The reader does each section in order, so each heading
is a task:

1. Opening: "By Friday you ship one guarded sampler-config change to
   staging. Day one is the local stack; ask in the help channel, where the
   median answer takes 11 minutes."
2. **Set up the local stack** → `steps`, four commands, with the access
   role named before the step that needs it. A `callout` (`tone: danger`)
   sits before the replay step, never after it.
3. **Your week** → `timeline`, five days with a status each.
4. **Words you will hear today** → `glossary`, five terms.
5. **Who to ask** → `team`: three people and their focus, last, because
   the reader needs it when stuck, not before.

Prose carries why day four's change is small on purpose: the path is the
lesson, not the diff.

## Left out

- `c4` or `block` of the ingest tier — it belongs in the architecture doc;
  link to it with `[the ingest tier](architecture/ingest#tier)`.
- `checklist` — the setup is ordered, so `steps` fits.

## What would change the shape

- No named people → no `team`; the doc ends on the help channel.
- A code map is the main need → `tree` of the repo, or `felogic`.
