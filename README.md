<p align="center">
  <img src="./assets/brand/mark-256.png" alt="Chiltepin" width="80" />
</p>

<h1 align="center">Chiltepin</h1>

<p align="center"><strong>Technical docs, made visual.</strong><br/>
AI systems, architecture, graphs, and the documents that connect them.<br/>
Written in Markdown. Drawn by code. Checked in CI.</p>

<p align="center"><sub>Open-source docs as code: an AI documentation generator that lives in your repo. Your agent writes the docs, <code>chiltepin check</code> validates them, the renderer draws them.</sub></p>

<p align="center">
  <a href="https://www.npmjs.com/package/chiltepin"><img src="https://img.shields.io/npm/v/chiltepin?label=chiltepin&color=e4744c" alt="npm version" /></a>
  <a href="https://github.com/jdiejim/chiltepin/actions/workflows/ci.yml"><img src="https://github.com/jdiejim/chiltepin/actions/workflows/ci.yml/badge.svg" alt="CI status" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" /></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/chiltepin" alt="Supported Node.js version" /></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#agents-architectures-and-graphs">See the results</a> ·
  <a href="#how-chiltepin-works">Architecture</a> ·
  <a href="./skills/chiltepin/SKILL.md">Agent skill</a> ·
  <a href="https://chiltepin.dev">Website</a>
</p>

<p align="center">
  <a href="./docs/examples/platform-architecture.md"><img src="./assets/examples/platform.png" alt="System design of a marketplace platform: clients through a CDN, WAF, and load balancer into replicated services, a Kafka event backbone, sharded Postgres with read replicas, a Redis cache, search, object storage, a warehouse, and Stripe and Twilio at the edge" width="960" /></a>
</p>
<p align="center"><sub>A platform on one page: 20 nodes, 21 flows, one <code>block</code> in <a href="./docs/examples/platform-architecture.md">typed YAML</a>. Shapes, routing, numbering, and the legend come from the renderer.</sub></p>

**Your agent writes the content. Chiltepin handles the layout.** Compose prose and typed YAML blocks in a `.md` file. Get consistent diagrams, a document you can share, and a source diff you can review.

```bash
npx -y chiltepin@latest demo
```

Explore the built-in examples without creating a project. **Node.js 20+ required.**

## Agents, architectures, and graphs

Show how an agent acts, where a system begins and ends, or how a graph connects. Chiltepin gives each question its own visual form.

**A transport platform, in context.** Riders, operators, maps, and live fleet data around one system boundary.

[![C4 context for a city transport platform: a rider plans a journey, an operator reports disruptions, the mobility platform requests walking routes, and fleet telemetry streams arrival updates](./assets/examples/transport.png)](./assets/examples/transport.png)

**Then zoom into the network.** A weighted graph makes connections and alternative routes explicit.

[![A transport graph connects Central, Museum, Depot, Campus, Harbor, and Airport, with a legend of travel times in minutes](./assets/examples/graph.png)](./assets/examples/graph.png)

<p align="center"><sub>Two views of one transport design. <a href="./docs/examples/transport-network.md">Read the C4 and graph source.</a> Travel times are illustrative.</sub></p>

<details>
<summary><strong>Inside the AI document: a budget for the next tool call</strong></summary>

[![Research agent context budget: instructions, tool schemas, source excerpts, and conversation use 40,000 of 64,000 tokens](./assets/examples/agent-context.png)](./assets/examples/agent-context.png)

The [full research agent document](./docs/examples/research-agent.md) includes the agent loop, a C4 container view, and this illustrative context budget.

</details>

## One document. The whole design.

An architecture review needs the boundaries, the failure paths, the data, and the release plan. Keep them together.

The [checkout example](./docs/examples/checkout-design.md) brings these figures together with architecture and prose in one Markdown file:

| What happens when a payment fails? | How do orders and events stay consistent? |
| --- | --- |
| [![Payment sequence with approved and declined branches, and a transaction before success](./assets/examples/sequence.png)](./assets/examples/sequence.png) | [![Orders and outbox tables with keys, column types, and a one-to-many relationship](./assets/examples/data-model.png)](./assets/examples/data-model.png) |
| An explicit failure path, alongside the successful request. | A transactional outbox, with the constraints visible. |

[![A canary rollout from 1% to 100% traffic, with hold times, health gates, and a rollback action](./assets/examples/rollout.png)](./assets/examples/rollout.png)

<p align="center"><sub>The release plan is part of the design: traffic, gates, and rollback in one figure.</sub></p>

<details>
<summary><strong>Read the complete checkout document</strong></summary>

[![The complete rendered checkout architecture review, including its system diagram, payment sequence, data model, and rollout plan](./assets/examples/document.png)](./assets/examples/document.png)

[Open the Markdown source](./docs/examples/checkout-design.md) to reproduce the document.

</details>

**Go deeper on architecture.** Describe regions, availability zones, subnets, replicas, and the connections between them.

[![Cloud deployment topology: customers, gateway, services, databases, and a queue inside nested region, zone, and subnet boundaries](./assets/examples/deployment.png)](./assets/examples/deployment.png)

<p align="center"><sub><a href="./docs/examples/deployment-topology.md">Read the deployment source</a> · Includes a second view of the service on Kubernetes.</sub></p>

More complete examples: [system context](./docs/examples/system-overview.md) · [API reference](./docs/examples/api.md) · [ADR](./docs/examples/adr.md) · [runbook](./docs/examples/runbook.md) · [agent system](./docs/systems/agent-system.md) · [slide deck](./docs/examples/presentation.md).

## Small source. Finished figures.

This is the agent loop in the opening image. The block type selects the renderer; the YAML describes the content.

````markdown
```agentloop
id: research-agent-loop
title: Research. Verify. Answer.
agent:
  name: Research agent
  model: Tool-calling LLM
  note: "Build a cited answer. Keep uncertainty visible."
env: Researcher
tools:
  - { name: search_sources, desc: "Find relevant sources" }
  - { name: read_source, desc: "Read the original text" }
  - { name: compare_claims, desc: "Find gaps and conflicts" }
memory:
  - research question
  - source links + excerpts
  - unresolved claims
stop: "Return a cited answer after verification, or report gaps after eight tool rounds."
```
````

**No coordinates, drawing instructions, or generated SVG to maintain.** Chiltepin owns the geometry, typography, and spacing. Change a tool or a stopping rule in the source and render again.

Every block has a strict schema. Look up its fields and a working example with `chiltepin block agentloop`.

## Quick start

**With your AI agent**

Install the [authoring skill](./skills/chiltepin/SKILL.md):

```bash
npx skills add jdiejim/chiltepin -y
```

Then ask your agent:

> Use Chiltepin to document this project's architecture. Read the code, show the system boundaries and request flow, include the failure path, and validate the document. Export it to HTML.

The skill guides block selection, schema lookup, composition, and validation. You review the technical facts; Chiltepin checks the structure.

**In your terminal**

Run these commands in your project directory:

```bash
npx -y chiltepin@latest init
npx -y chiltepin@latest check
npx -y chiltepin@latest html docs/getting-started.md -p
npx -y chiltepin@latest studio
```

`init` creates a config and two starter documents, skipping existing files. `html -p` opens the rendered page. `studio` opens the local visual editor.

To pin the CLI in your project:

```bash
npm install --save-dev chiltepin
npx chiltepin@latest check
```

See the [getting started guide](./docs/guides/getting-started.md) for the full workflow. `chiltepin skill` also prints the guide for tools with a system-prompt field.

## One source, several ways to share

| You need… | Run | You get |
| --- | --- | --- |
| A document to send | `chiltepin html docs/design.md` | A standalone page with inline CSS and SVG |
| A design review deck | `chiltepin slides docs/design.md` | A self-contained slide deck organized by headings |
| A printable handoff | `chiltepin pdf docs/design.md` | A PDF; Chromium downloads once on first use |
| A documentation site | `chiltepin build` | A static site with navigation and cross-document links |
| A place to edit | `chiltepin studio` | A local visual editor for the same Markdown files |

Dark by default. Set `"colorScheme": "light"` or `"system"` in `chiltepin.config.json` to change the page appearance. Print and PDF use the light palette.

<details>
<summary><strong>See the same document in light mode</strong></summary>

[![The research agent document rendered with Chiltepin's light palette](./assets/examples/agent-document-light.png)](./assets/examples/agent-document-light.png)

The same source and layout, with a light palette for reading and print.

</details>

## How Chiltepin works

**Geometry is code, never prompt.** An agent produces structured content; the same parser and renderers serve the CLI and Studio.

[![Chiltepin document pipeline: Markdown and YAML enter chiltepin-core for parsing and validation, diagnostics identify issues, and chiltepin-render produces HTML and SVG](./assets/examples/pipeline.png)](./assets/examples/pipeline.png)

<p align="center"><sub>Chiltepin's architecture, drawn with Chiltepin. <a href="./docs/examples/chiltepin-pipeline.md">Read the figure source.</a></sub></p>

| Layer | Responsibility |
| --- | --- |
| [`chiltepin-core`](./packages/core) | Parse Markdown, validate typed blocks, resolve references, and return diagnostics. Pure: no I/O or DOM. |
| [`chiltepin-render`](./packages/render) | Turn the parsed document into deterministic HTML and SVG. Own all layout and visual tokens. |
| [`chiltepin-studio`](./packages/studio) | Run the shared pipeline in the browser; edit source files through the local server. |
| [`chiltepin`](./packages/cli) | Read and write files, run checks, export documents, build sites, and serve Studio. |

The block registry connects each type to its schema. Exhaustive TypeScript registries make missing renderers a compile error. Files remain the source of truth across editors and exports.

Read the [architecture guide](./ARCHITECTURE.md) and [renderer design rules](./packages/render/DESIGN.md) for the implementation details.

## Review the diff. Check the document.

Put the CLI in your project's development dependencies, then add this step after dependency installation in CI:

```yaml
- name: Validate documentation
  run: npx --no-install chiltepin check
```

`chiltepin check` validates the configured docs directory. It catches invalid fields, duplicate IDs, and broken references across documents. Errors fail the command.

```bash
chiltepin check --json          # diagnostics for tooling and agents
chiltepin check --strict-prose  # also fail on prose warnings
```

Density and style warnings flag crowded diagrams and unclear prose. Validation checks structure and references; it cannot verify your system's technical facts.

## Pick the block that answers the question

**107 block types across 13 families.** Architecture and flows are only the start.

| Reader's question | Reach for |
| --- | --- |
| What runs where? | `c4`, `block`, `cluster`, `archmap` |
| What happens next, or when it fails? | `sequence`, `flow`, `state`, `saga` |
| What do we store or expose? | `erd`, `endpoint`, `eventcontract` |
| Why this decision? | `options`, `scqa`, `scorecard`, `proscons` |
| How does this ship? | `rollout`, `roadmap`, `gantt`, `steps` |
| What did the measurements show? | `chart`, `percentiles`, `benchmark`, `slo` |
| How does the agent behave? | `agentloop`, `trace`, `prompt`, `context` |

Run `chiltepin block` to browse the catalog, or `chiltepin demo architecture` to render one family.

<details>
<summary><strong>Browse all block families</strong></summary>

| For… | Blocks |
|---|---|
| Architecture & system design | `c4` `block` `cluster` `archmap` `dfd` `erd` `usecase` `pkg` |
| Flows, state, time | `sequence` `flow` `state` `swimlane` `saga` `spans` `timing` `gitgraph` `cycle` |
| Events & messaging | `block` (`preset: event`) `eventcontract` `saga` — 12 patterns in the skill |
| API reference | `endpoint` `eventcontract` `packet` `code` |
| Quality, audits, performance | `audit` `checklist` `perfbudget` `percentiles` `threatmodel` `slo` `benchmark` `risk` |
| Charts | `chart` (bar · line · area · scatter · donut · pie · gauge · radar · waterfall · funnel · pareto · histogram · bell · boxplot · bullet) `heatmap` `sankey` `treemap` `slopegraph` `quadrant` |
| Decks & decisions | `scqa` `takeaways` `bignumber` `options` `harvey` `scorecard` `scenarios` `chevrons` `roadmap` `swot` `okr` `wardley` |
| Planning | `userstory` `storymap` `kanban` `timeline` `gantt` `rollout` `changelog` `statustable` `agenda` |
| Design systems | `wireframe` `palette` `typescale` `dodont` `inventory` `frontend` `felogic` |
| Algorithms | `array` `linkedlist` `bintree` `hashmap` `graph` |
| AI & ML | `agentloop` `trace` `prompt` `context` `neuralnet` `modelcard` |
| Prose structure | `callout` `list` `glossary` `faq` `steps` `spec` `layers` `gallery` `mindmap` `tree` `fishbone` |

Typed blocks across 13 families. Every field, enum, and terse form: `chiltepin block <type>`. Twelve old names (`infra` `event` `ddd` `network` `belogic` `dag` `waterfall` `funnel` `diff` `terminal` `mece` `tracker`) remain permanent aliases.

</details>

<details>
<summary><strong>Full CLI reference</strong></summary>

| Command | What it does |
|---|---|
| `chiltepin init` | Scaffold `chiltepin.config.json` + two starter docs (`--force` overwrites) |
| `chiltepin new [name]` | Scaffold a whole doc (`adr`, `runbook`, …) or one block |
| `chiltepin check [globs]` | Validate — schemas, refs, ids, density, prose, lens lints (`--json`) |
| `chiltepin block [type]` | The reference: every type on one line, or one type's contract (`--json`) |
| `chiltepin demo [family] [-s]` | Render the built-in showcase — every block, or one family (`-s` slides) |
| `chiltepin html / slides / pdf <in>` | Render one doc (`-p` opens, `-o` writes) |
| `chiltepin <file.md>` | Render and open one doc |
| `chiltepin build` | Static site from all docs (`--out`) |
| `chiltepin studio` | The local editor (`--port`, `--no-open`) |
| `chiltepin audit [path]` | Audit a codebase and recommend which docs to write, with evidence |
| `chiltepin sync openapi\|csv\|sql\|dbml\|prisma <file>` | Generate blocks or docs from an OpenAPI spec, a CSV, or a schema |
| `chiltepin skill` | Print the skill as one document |

Exit codes: `0` clean · `1` errors · `2` usage error. `CHILTEPIN_PLAIN=1` forces plain output.

</details>

## Contribute

```bash
pnpm install
pnpm verify
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) to add a block, improve a renderer, or contribute an example. [Report a bug](https://github.com/jdiejim/chiltepin/issues/new?template=bug.yml) with a small Markdown file that reproduces it, or [request a block](https://github.com/jdiejim/chiltepin/issues/new?template=block.yml).

The figures in this README come from checked-in source documents. Run `pnpm build` followed by `pnpm screenshots` to regenerate them with Playwright and Chromium. The CLI build also syncs the npm README and converts its image and document links to absolute URLs.

[Generation evaluations](./evals/generate) track block selection, validation, and rendering across 40 requests. The results are maintainer-reported development runs; see the method and its reproducibility limits there.

## License

[MIT](./LICENSE)
