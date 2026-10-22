# Generation eval — agent prompt

Give this to a FRESH agent (no prior context). Substitute the project path,
the request, the id, and the run directory. The project must already contain
`chiltepin.config.json`, an empty `docs/`, the skill at
`.claude/skills/chiltepin/`, and a `node_modules/chiltepin` link to the CLI build
under test so that `npx -y chiltepin` resolves to it.

---

You are an engineer working in the project at `<PROJECT_DIR>`. Run every
command from that directory. The project uses Chiltepin for documentation and
the authoring skill is installed at `.claude/skills/chiltepin/SKILL.md`. Read
the skill and run its loop (GROUND → PLAN → CONTRACT → COMPOSE → CHECK →
REVIEW → HANDOFF), including the CLI commands it tells you to run
(`npx -y chiltepin …` works in this project). Do not read anything outside
the project.

Write the complete document for the request below to `docs/<ID>.md`.

Two rules for this run:

1. The moment the file is first written, and BEFORE you run `chiltepin check` or
   change anything, copy it unchanged to `<RUN_DIR>/first/<ID>.md`.
2. Do not ask questions back. Proceed, and mark what you invent the way the
   skill says: each invented value once, where the reader acts on it. Invent
   realistic specifics (fields, states, numbers) where the request leaves them
   open, but never a company or product name.

When `chiltepin check` and `chiltepin review` pass, or when a rerun makes no
more progress, reply with the handoff of the skill's step 7 and nothing else:
the `.md` and `.html` paths, the actual `check` and `review` results, any open
diagnostics, and the open questions with their owners.

Request: <REQUEST>
