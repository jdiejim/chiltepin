```meta
title: Chiltepin — all blocks
subtitle: One rendered example of every block type the renderer supports.
tag: DEMO · v1
```

## Welcome

Each section renders one block type from a typed YAML fence in this file.
Copy a fence into your own doc as a starting point.

```callout
tone: tip
title: Source of truth
body: Every diagram on this page comes from a YAML block. There is no
  hand-written HTML or SVG — change the YAML to change the picture.
```

```prose
title: Structured prose
lede: "Use the prose block when prose must travel inside a structured layout: headings, paragraphs, lists, and quotes become typed data."
blocks:
  - { type: h, text: Why structured prose }
  - { type: p, text: It plays nicely with the section-head wrapper and keeps content uniform across docs. }
  - { type: ul, items: [Predictable spacing, Consistent fonts, Easier diffs] }
  - { type: quote, text: A document degrades gracefully — opens in any editor with no tooling. }
```

```glossary
title: A few terms
terms:
  - { term: Idempotent, def: A call that produces the same outcome on a replay. }
  - { term: SLO, def: A service-level objective the team commits to., avoid: [uptime target, service promise] }
  - { term: Saga, def: A long-running transaction split across services. }
```

```proscons
title: Sync vs async writes
prosLabel: Synchronous
consLabel: Asynchronous
pros:
  - One transaction, easy to reason about
  - Errors surface at call time
  - Latency budget is predictable
cons:
  - Caller waits for downstream
  - Failure mode is "everything stops"
  - Hard to scale horizontally
```

```cvt
title: Migration plan
current:
  label: Today (monolith)
  items: [Single deployable, Shared Postgres, Manual releases]
target:
  label: Target (services)
  items: [Per-service deploys, Per-service stores, Continuous releases]
note: Migrate one service per quarter; freeze new monolith features.
```

```stats
title: This quarter
stats:
  - { value: 12.4k, label: Active users, delta: "+18%", trend: up }
  - { value: 99.95%, label: Uptime, delta: "0", trend: flat }
  - { value: 142ms, label: p95 latency, delta: "-22ms", trend: up }
  - { value: $84k, label: MRR, delta: "+$6.1k", trend: up }
```

```code
title: Reference snippets
blocks:
  - title: order-handler.ts
    lang: TypeScript
    code: |
      export async function placeOrder(req: OrderRequest): Promise<Order> {
        const order = await db.tx(async (t) => {
          const inserted = await t.orders.insert({ ...req, status: 'PENDING' });
          await payments.authorize(inserted.id, req.token);
          return t.orders.update(inserted.id, { status: 'CONFIRMED' });
        });
        return order;
      }
  - title: schema.sql
    lang: PostgreSQL
    code: |
      CREATE TABLE orders (
        id              uuid PRIMARY KEY,
        user_id         uuid NOT NULL REFERENCES users(id),
        amount_cents    integer NOT NULL,
        status          text NOT NULL DEFAULT 'PENDING'
      );
```

```agenda
title: Tuesday standup
items:
  - { time: "09:00", duration: 5m, title: Round-robin, owner: Host }
  - { time: "09:05", duration: 20m, title: Status updates, desc: Each team for 5 minutes }
  - { time: "09:25", duration: 30m, title: Tech deep-dive, owner: API team, desc: Walk-through of the new orders service }
  - { time: "09:55", duration: 5m, title: Action items + wrap }
```

```tree
title: Repo layout
nodes:
  - { id: root, label: chiltepin }
  - { id: packages, parent: root, label: packages }
  - { id: core, parent: packages, label: 'chiltepin-core', note: pure model }
  - { id: render, parent: packages, label: 'chiltepin-render', note: HTML out }
  - { id: studio, parent: packages, label: 'chiltepin-studio', note: visual editor }
  - { id: cli, parent: packages, label: 'chiltepin', note: chiltepin binary }
  - { id: resources, parent: root, label: resources, note: fixtures + reference renderer }
  - { id: docs, parent: root, label: docs, note: the documents }
```

```pyramid
title: Engineering priorities
levels:
  - { label: Vision, desc: Documentation as a navigable typed model }
  - { label: Strategy, desc: Files on disk are the source of truth }
  - { label: This quarter, desc: "107 blocks, one look, agent skill" }
  - { label: This week, desc: Phase 2 blocks shipped }
```

```flow
title: Decision flow
description: The flow decides whether to accept a payment; the error path ends in a rejection. An invalid token never reaches the charge step.
nodes:
  - { id: start, col: 1, row: 1, kind: start, label: Start }
  - { id: check, col: 2, row: 1, kind: decision, label: Token valid? }
  - { id: charge, col: 3, row: 1, kind: process, label: Charge card }
  - { id: reject, col: 2, row: 2, kind: end, label: Reject }
  - { id: done, col: 3, row: 2, kind: end, label: Done }
edges:
  - start -> check
  - check -> charge: "yes"
  - check -x-> reject: "no"
  - charge -> done
```

```state
title: Order lifecycle
description: PENDING is the only state visible inside the txn; CONFIRMED is the only post-commit state.
states:
  - { id: s0, col: 1, row: 1, kind: start }
  - { id: pending, col: 2, row: 1, kind: wait, name: PENDING }
  - { id: confirmed, col: 3, row: 1, kind: active, name: CONFIRMED }
  - { id: cancelled, col: 3, row: 2, kind: wait, name: CANCELLED }
  - { id: end, col: 4, row: 1, kind: terminal }
transitions:
  - { from: s0, to: pending, event: create }
  - { from: pending, to: confirmed, event: authorize_ok }
  - { from: pending, to: cancelled, event: authorize_fail }
  - { from: confirmed, to: end, event: ship }
```

```dfd
title: Order placement data flow
nodes:
  - { id: client, col: 1, row: 1, kind: external, name: Client }
  - { id: orders, col: 2, row: 1, kind: process, name: Place order, num: 1 }
  - { id: pay, col: 3, row: 1, kind: external, name: Payment GW }
  - { id: db, col: 2, row: 2, kind: store, name: orders }
edges:
  - { from: client, to: orders, label: POST /orders }
  - { from: orders, to: pay, label: authorize }
  - { from: orders, to: db, label: INSERT }
```

```journey
title: Onboarding journey
stages:
  - { label: Discover }
  - { label: Sign up }
  - { label: Activate }
  - { label: Pay }
rows:
  - { label: Touchpoint, cells: [Landing, Form, Email, Checkout] }
  - { label: Time, cells: [30s, 90s, 24h, 60s] }
  - { label: Friction, cells: [Low, Medium, Low, Medium] }
emotion: [0.75, 0.40, 0.60, 0.85]
```

```gantt
title: Quarterly plan
periods: [Q1, Q2, Q3, Q4]
tasks:
  - { label: Discovery, start: 0, span: 1, kind: done }
  - { label: Core build, start: 1, span: 2, kind: active }
  - { label: Beta, start: 2, span: 1 }
  - { label: GA, start: 3, span: 1, kind: milestone }
  - { label: Support hand-off, start: 3, span: 1 }
```

```graph
title: Service dependency graph
nodes:
  - { id: web, col: 1, row: 1, label: web, group: 0 }
  - { id: api, col: 2, row: 1, label: api, group: 1 }
  - { id: pay, col: 3, row: 1, label: payment, group: 2 }
  - { id: db, col: 2, row: 2, label: postgres, group: 3 }
  - { id: cache, col: 1, row: 2, label: redis, group: 4 }
edges:
  - web -> api
  - api -> pay
  - api -> db
  - { from: api, to: cache, dir: undirected }
```

```quadrant
title: Effort vs impact
description: The skill ships first — the most impact for the least effort. Quick wins sit top-left, big bets top-right.
xAxis: { label: Effort, low: Low, high: High }
yAxis: { label: Impact, low: Low, high: High }
items:
  - { x: 0.18, y: 0.82, label: Ship the skill }
  - { x: 0.80, y: 0.90, label: MCP server }
  - { x: 0.22, y: 0.30, label: README polish }
  - { x: 0.75, y: 0.22, label: VS Code ext }
  - { x: 0.55, y: 0.65, label: Hosted preview }
```

```swimlane
title: Cross-functional handoff
lanes: [Customer, Sales, Engineering, Ops]
phases:
  - { label: Intake, from: 1, to: 2 }
  - { label: Build, from: 3, to: 4 }
  - { label: Ship, from: 5 }
steps:
  - req: Submit request · Customer · start
  - triage: Qualify? · Sales · decision
  - scope: Scope work · Engineering
  - build: Build · Engineering
  - { id: deploy, lane: Ops, label: Deploy, note: blue/green, accent: true }
  - done: Receive · Customer · end
links:
  - req -> triage
  - triage -> scope: approved
  - scope -> build
  - build -> deploy
  - deploy --> done: notified
```

```gitgraph
title: Release model
description: "Release branches are short-lived: cut, ship, merge back."
branches:
  - { name: main, accent: navy }
  - { name: release, accent: teal }
commits:
  - { label: baseline }
  - { label: feature A }
  - { branch: release, label: cut 1.2 }
  - { merge: release, label: ship, tag: v1.2.0, kind: release }
```


```c4
title: System context
description: Who uses ShopCo and which external systems it depends on.
level: container
boundary: { label: ShopCo platform }
nodes:
  - { id: shopper, col: 1, row: 1, kind: person, name: Shopper, desc: A customer placing an order from web or mobile. }
  - { id: web, col: 2, row: 1, kind: container, family: client, name: Web app, tech: Next.js, desc: Server-rendered React. }
  - { id: api, col: 3, row: 1, kind: container, family: service, name: Orders API, tech: Go, desc: "Authorises, persists, emits events." }
  - { id: pg, col: 3, row: 2, kind: store, name: Orders DB, tech: Postgres 16, desc: Single source of truth for orders. }
  - { id: pay, col: 4, row: 1, kind: external, name: Payment GW, desc: Stripe authorisation. }
edges:
  - { from: shopper, to: web, label: places order }
  - { from: web, to: api, label: POST /orders }
  - { from: api, to: pg, label: writes }
  - { from: api, to: pay, label: authorises }
```

```uml
title: Domain classes
description: Order owns its items by composition — an OrderItem cannot outlive its Order.
classes:
  - id: order
    col: 1
    row: 1
    name: Order
    attrs: ["id: UUID", "status: Status", "total: Money", "items: OrderItem[]"]
    methods: ["place()", "confirm()", "cancel()"]
  - id: item
    col: 2
    row: 1
    name: OrderItem
    attrs: ["id: UUID", "sku: String", "qty: int", "price: Money"]
  - id: status
    col: 1
    row: 2
    name: Status
    stereotype: enumeration
    attrs: ["PENDING", "CONFIRMED", "CANCELLED"]
  - id: shopper
    col: 2
    row: 2
    name: Shopper
    attrs: ["id: UUID", "email: String"]
rels:
  - { from: order, to: item, kind: composition, label: contains }
  - { from: order, to: status, kind: association, label: has }
  - { from: shopper, to: order, kind: association, label: places }
```

```tree
variant: issue
title: Why are conversions down?
description: A MECE breakdown of plausible causes. Each leaf is a claim we can test before spending on a fix.
nodes:
  - { id: root, label: Lower conversion this quarter }
  - { id: traffic, parent: root, label: Traffic quality }
  - { id: friction, parent: root, label: Funnel friction }
  - { id: pricing, parent: root, label: Pricing / offer }
  - { id: t1, parent: traffic, label: Wrong audience }
  - { id: t2, parent: traffic, label: Ad fatigue, note: paid creative is stale }
  - { id: f1, parent: friction, label: Slow checkout, note: p95 over 4s on mobile }
  - { id: f2, parent: friction, label: Mobile bugs }
  - { id: f3, parent: friction, label: Required signup }
  - { id: p1, parent: pricing, label: Competitor undercut }
  - { id: p2, parent: pricing, label: Shipping fee surprise }
```

```tree
variant: org
title: Platform group
description: "The same tree block as an org chart: parents center over their children, role under the name."
nodes:
  - { id: dana, label: Dana Reyes, role: VP Engineering }
  - { id: sam, parent: dana, label: Sam Ortiz, role: "Manager, Core" }
  - { id: kim, parent: dana, label: Kim Lau, role: "Manager, Infra" }
  - { id: ada, parent: sam, label: Ada Boone, role: Frontend lead }
  - { id: raj, parent: sam, label: Raj Patel, role: Backend lead }
  - { id: mei, parent: kim, label: Mei Tanaka, role: SRE lead }
```

```frontend
title: React component tree
description: "In the orders app, state lives in two places only: the cart store and the useOrders hook."
nodes:
  - { id: app, kind: root, name: App }
  - { id: auth, parent: app, kind: provider, name: AuthProvider }
  - { id: theme, parent: app, kind: provider, name: ThemeProvider }
  - { id: layout, parent: auth, kind: layout, name: AppLayout }
  - { id: home, parent: layout, kind: page, name: Home }
  - { id: orders, parent: layout, kind: page, name: OrdersPage }
  - { id: list, parent: orders, kind: component, name: OrderList }
  - { id: card, parent: list, kind: component, name: OrderCard }
  - { id: badge, parent: card, kind: leaf, name: StatusBadge }
  - { id: hook, parent: orders, kind: hook, name: useOrders }
  - { id: cart, parent: app, kind: store, name: cartStore, note: Zustand }
```

```cluster
title: Production cluster
description: Two namespaces (api and data) with replicas; cross-namespace edges run from the API services to their backing stores. Only the orders service touches all three stores — it is the blast radius to watch.
clusters:
  - { id: api, label: api namespace, kind: namespace }
  - { id: data, label: data namespace, kind: namespace }
services:
  - { id: web, cluster: api, label: web, kind: service, tech: Next.js, replicas: 3 }
  - { id: orders, cluster: api, label: orders, kind: service, tech: Go 1.22, replicas: 4 }
  - { id: payments, cluster: api, label: payments, kind: service, tech: Node 20, replicas: 2 }
  - { id: pg, cluster: data, label: postgres, kind: store, tech: Postgres 16, replicas: 1 }
  - { id: redis, cluster: data, label: redis, kind: cache, tech: Redis 7, replicas: 2 }
  - { id: bus, cluster: data, label: events, kind: queue, tech: NATS, replicas: 3 }
edges:
  - { from: web, to: orders }
  - { from: orders, to: pg }
  - { from: orders, to: redis }
  - { from: orders, to: bus, kind: dashed }
  - { from: payments, to: pg }
```

```block
title: Layered architecture
description: "Clients call the gateway, which fans out to the microservices, each backed by the data layer. The gateway is the single entry point: cross-cutting concerns live there, not in each service."
systemLabel: E-COMMERCE PLATFORM
layers:
  - { label: Client layer }
  - { label: API gateway }
  - { label: Microservices }
  - { label: Data layer }
nodes:
  - { id: web, layer: 0, kind: client, name: Web app, tech: React }
  - { id: mob, layer: 0, kind: client, name: Mobile, tech: iOS / Android }
  - { id: gw, layer: 1, kind: gateway, name: API Gateway, tech: Kong }
  - { id: orders, layer: 2, kind: microservice, name: Orders, tech: Go }
  - { id: catalog, layer: 2, kind: microservice, name: Catalog, tech: Node }
  - { id: payments, layer: 2, kind: microservice, name: Payments, tech: Java }
  - { id: ordersdb, layer: 3, kind: db, name: Orders DB, tech: Postgres }
  - { id: catalogdb, layer: 3, kind: db, name: Catalog DB, tech: MongoDB }
  - { id: cache, layer: 3, kind: cache, name: Cache, tech: Redis }
edges:
  - web -> gw
  - mob -> gw
  - gw -> orders
  - gw -> catalog
  - gw -> payments
  - orders -> ordersdb
  - catalog -> catalogdb
  - catalog --> cache
  - payments -> ordersdb
```

```block
preset: infra
title: Cloud deployment
description: "Edge → gateway → containers, backed by a database, object storage, a cache, and a queue worker. Two nested groups mark the cloud account and the private network inside it. The queue decouples the API from the worker: a slow job never blocks a request."
groups:
  - { id: cloud, label: Cloud account, col: 1, row: 1, cols: 4, rows: 2, color: "#374151" }
  - { id: net, label: Private network, col: 2, row: 1, cols: 3, rows: 2, color: "#0e54a1" }
nodes:
  - { id: cdn, col: 1, row: 1, kind: cdn, name: CDN, tech: edge cache }
  - { id: gw, col: 2, row: 1, kind: gateway, name: API Gateway, tech: load balancer }
  - { id: svc, col: 3, row: 1, kind: compute, name: Storefront API, tech: containers }
  - { id: db, col: 4, row: 1, kind: db, name: orders-db, tech: managed SQL }
  - { id: bucket, col: 4, row: 2, kind: bucket, name: Object storage, tech: blobs / files }
  - { id: cache, col: 3, row: 2, kind: cache, name: Cache, tech: in-memory }
  - { id: q, col: 2, row: 2, kind: queue, name: Queue, tech: messages }
  - { id: wk, col: 1, row: 2, kind: function, name: Worker, tech: async jobs }
edges:
  - cdn -> gw: HTTPS
  - gw -> svc: routes
  - svc -> db: SQL
  - svc --> bucket: reads
  - svc --> cache: cache
  - svc --> q: publish
  - q --> wk: consume
```

```block
preset: event
title: Order events
description: Producers publish to topics and consumers subscribe. Producers never know their consumers — Analytics subscribed without a change to the Orders API.
nodes:
  - { id: api, col: 1, row: 1, kind: producer, name: Orders API, tech: publishes }
  - { id: pays, col: 1, row: 2, kind: producer, name: Payments, tech: publishes }
  - { id: t1, col: 2, row: 1, kind: topic, name: order.created, tech: topic }
  - { id: t2, col: 2, row: 2, kind: topic, name: payment.captured, tech: topic }
  - { id: email, col: 3, row: 1, kind: consumer, name: Email worker, tech: subscribes }
  - { id: ship, col: 3, row: 2, kind: consumer, name: Fulfilment, tech: subscribes }
  - { id: an, col: 3, row: 3, kind: consumer, name: Analytics, tech: subscribes }
edges:
  - api -> t1: publish
  - pays -> t2: publish
  - t1 --> email
  - t1 --> ship
  - t1 --> an
  - t2 --> ship
```

```block
preset: ddd
title: Context map
description: "Sales is upstream of Billing and Shipping: its model changes ripple downstream, never the reverse."
nodes:
  - { id: sales, col: 1, row: 1, kind: context, name: Sales, tech: core }
  - { id: billing, col: 2, row: 1, kind: context, name: Billing, tech: supporting }
  - { id: ship, col: 2, row: 2, kind: context, name: Shipping, tech: supporting }
  - { id: catalog, col: 1, row: 2, kind: context, name: Catalog, tech: generic }
edges:
  - sales -> billing: U → D
  - sales -> ship: U → D · ACL
  - catalog --> sales: shared kernel
```

```block
preset: network
title: Network zones
description: Trust boundaries run from edge to data. The load balancer must never reach the database directly — the red "no direct" edge marks the forbidden connection and makes the rule reviewable.
groups:
  - { id: z1, label: DMZ, col: 1, row: 1, cols: 1, rows: 2, color: "#f7952c" }
  - { id: z2, label: Private subnet, col: 2, row: 1, cols: 1, rows: 2, color: "#0e54a1" }
  - { id: z3, label: Data subnet, col: 3, row: 1, cols: 1, rows: 2, color: "#991b1b" }
nodes:
  - { id: lb, col: 1, row: 1, kind: gateway, name: Load balancer, tech: public }
  - { id: waf, col: 1, row: 2, kind: firewall, name: Firewall, tech: WAF }
  - { id: web, col: 2, row: 1, kind: compute, name: App servers, tech: private }
  - { id: cache, col: 2, row: 2, kind: cache, name: Cache, tech: private }
  - { id: db, col: 3, row: 1, kind: db, name: customers-db, tech: restricted }
edges:
  - lb -> waf: filter
  - waf -> web: "443"
  - web -> cache: "6379"
  - web -> db: "5432"
  - { from: lb, to: db, label: no direct, kind: forbidden }
```

```felogic
title: Frontend logic — strategy + engine
description: The checkout UI drives a pricing engine that selects a DiscountStrategy implementation; the API client egresses over HTTPS to the backend. Discount rules hide behind one interface — a new promotion is a new strategy class, not an engine change.
groups:
  - { id: app, label: App (browser), col: 1, row: 1, cols: 3, rows: 3, color: "#0e54a1" }
  - { id: net, label: Egress · network, col: 4, row: 1, cols: 1, rows: 1, color: "#6b7280" }
nodes:
  - { id: ui, col: 1, row: 1, kind: component, name: Checkout UI, note: renders form }
  - { id: engine, col: 2, row: 1, kind: engine, name: PricingEngine, note: computes total }
  - { id: api, col: 3, row: 1, kind: service, name: ApiClient, note: fetch wrapper }
  - { id: backend, col: 4, row: 1, kind: external, name: Orders API, note: REST /orders }
  - { id: cart, col: 1, row: 2, kind: hook, name: useCart(), note: state }
  - { id: iface, col: 2, row: 2, kind: interface, name: DiscountStrategy, note: calculate() }
  - { id: s1, col: 1, row: 3, kind: strategy, name: PercentOff, note: "% off" }
  - { id: s2, col: 2, row: 3, kind: strategy, name: BuyXGetY, note: bundle }
  - { id: s3, col: 3, row: 3, kind: strategy, name: NoDiscount, note: default }
edges:
  - { from: ui, to: engine, label: uses, kind: uses }
  - { from: ui, to: cart, label: reads, kind: reads }
  - { from: engine, to: iface, label: selects, kind: uses }
  - { from: s1, to: iface, kind: implements }
  - { from: s2, to: iface, kind: implements }
  - { from: s3, to: iface, kind: implements }
  - { from: engine, to: api, label: calls, kind: uses }
  - { from: api, to: backend, label: HTTPS, kind: egress }
```

```felogic
variant: be
title: Backend logic — gateway + repository
description: The controller calls OrderService, which loads through OrderRepository and charges through the PaymentGateway interface (Stripe and Adyen adapters). Writes go to Postgres, the event bus, and the external gateways. One interface per provider, so a Stripe outage is a config change.
groups:
  - { id: svc, label: Service boundary, col: 1, row: 1, cols: 3, rows: 3, color: "#0e54a1" }
  - { id: infra, label: Infrastructure · egress, col: 4, row: 1, cols: 1, rows: 3, color: "#6b7280" }
nodes:
  - { id: ctrl, col: 1, row: 1, kind: controller, name: OrdersController, note: HTTP /orders }
  - { id: service, col: 2, row: 1, kind: service, name: OrderService, note: use case }
  - { id: stripe, col: 3, row: 1, kind: adapter, name: StripeAdapter, note: implements }
  - { id: queue, col: 4, row: 1, kind: queue, name: EventBus, note: order.created }
  - { id: repo, col: 1, row: 2, kind: repository, name: OrderRepository, note: data access }
  - { id: iface, col: 2, row: 2, kind: interface, name: PaymentGateway, note: charge() }
  - { id: adyen, col: 3, row: 2, kind: adapter, name: AdyenAdapter, note: implements }
  - { id: db, col: 4, row: 2, kind: db, name: postgres, note: orders table }
  - { id: model, col: 1, row: 3, kind: model, name: Order, note: entity }
  - { id: ext1, col: 4, row: 3, kind: external, name: Stripe API, note: HTTPS }
edges:
  - { from: ctrl, to: service, label: handles, kind: uses }
  - { from: service, to: repo, label: loads, kind: uses }
  - { from: repo, to: model, label: reads, kind: reads }
  - { from: repo, to: db, label: SQL, kind: egress }
  - { from: service, to: iface, label: charges, kind: uses }
  - { from: stripe, to: iface, kind: implements }
  - { from: adyen, to: iface, kind: implements }
  - { from: stripe, to: ext1, label: HTTPS, kind: egress }
  - { from: service, to: queue, label: publishes, kind: uses }
```

```flow
variant: dag
title: Build pipeline
description: "Lint and unit tests run in parallel; both gate the build. The w: 2 span lets Deploy cover two columns."
nodes:
  - { id: src, col: 1, row: 1, kind: start, label: Checkout }
  - { id: lint, col: 2, row: 1, kind: process, label: Lint }
  - { id: test, col: 2, row: 2, kind: process, label: Unit tests }
  - { id: build, col: 3, row: 1, kind: process, label: Build }
  - { id: deploy, col: 4, row: 1, w: 2, kind: end, label: Deploy }
edges:
  - src -> lint
  - src -> test
  - lint -> build
  - test -> build
  - build -> deploy
```

## Saga

Each service owns its own database, so no single transaction covers an order.
The order service issues every compensation itself, and a customer can see the
stock reservation before the refund lands.

```saga
title: Place order
mode: orchestration
coordinator: Order service
steps:
  - reserve: Reserve stock · inventory · release stock
  - coupon: Redeem coupon · promotions · restore coupon
  - charge: Charge card · payments · refund card
  - ship: Book shipment · shipping · cancel shipment
  - notify: Send confirmation · notifications
failAt: ship
```

## Incident loop

Every incident feeds the next one: the review only closes when a guardrail
lands in code. A loop that ends at the write-up is the one that repeats.

```cycle
title: How an incident closes
steps:
  - { label: Detect, desc: An SLO burn alert pages the on-call engineer }
  - { label: Mitigate, desc: "Stop the bleeding first — roll back or shed load" }
  - { label: Review, desc: Write the timeline while the details are fresh }
  - { label: Guardrail, desc: "Ship the alert, test, or limit that catches it next time" }
center: every page
```

## Architecture map

```archmap
title: Retail platform — target architecture
description: The legacy ESB retires once the event bus carries its traffic.
cols: 3
areas:
  - label: Customer channels
    accent: blue
    items:
      - Web storefront
      - { name: Mobile app, status: target }
      - Contact centre
  - label: Commerce
    accent: teal
    items:
      - Catalog
      - Checkout
      - { name: Promotions, status: gap }
      - { name: Subscriptions, status: new }
  - label: Fulfilment
    accent: green
    items:
      - Warehouse mgmt
      - { name: Carrier gateway, status: target }
  - label: Data & analytics
    accent: amber
    items:
      - Reporting
      - { name: Customer 360, status: target }
      - { name: ML forecasting, status: gap }
  - label: Platform services
    accent: purple
    desc: Shared capabilities every domain builds on.
    items:
      - Identity
      - { name: Event bus, status: new }
      - { name: Legacy ESB, status: deprecated }
  - label: Integration
    accent: navy
    items:
      - API gateway
      - { name: Partner APIs, status: target }
```

## Table

```table
title: Plan comparison
columns:
  - { label: Plan }
  - { label: Price, align: r }
  - { label: Seats, align: r, highlight: true }
rows:
  - [ Free, "$0", "1" ]
  - [ Pro, "$20", "10" ]
  - [ Team, { v: "$80", tone: pos }, "50" ]
```

## Benchmark

```benchmark
title: Retrieval engines, measured
description: "The best number in each row is derived, not authored — `better: low` flips it for latency and cost."
metricLabel: Benchmark
subjects:
  - { label: Ours, sub: v2.1, featured: true }
  - { label: Vendor A }
  - { label: Vendor B, tone: muted }
rows:
  - { label: Answer accuracy, sub: internal QA set, cells: ["82.4%", "79.1%", "74.8%"] }
  - { label: Citations correct, sub: 500 sampled answers, cells: ["91.0%", "88.2%", "83.4%"] }
  - { label: p95 latency, sub: 500 rps soak, better: low, cells: ["310 ms", "420 ms", "290 ms"] }
  - label: Cost per 1k queries
    variants: [cached, cold]
    better: low
    cells:
      - ["$0.14", "$0.90"]
      - ["$0.21", "$1.10"]
      - ["$0.18", "—"]
  - { label: Index size, sub: 40M docs, better: none, cells: ["112 GB", "98 GB", "150 GB"] }
note: Single region, same corpus, October run. Vendor B declined the cold-cache test.
```

## Sequence

```sequence
id: sw-seq-checkout
title: Place order
endpoint: { method: POST, path: /orders }
actors:
  - { id: client, name: Client }
  - { id: api, name: Orders API }
  - { id: db, name: Postgres, external: true }
messages:
  - client -> api: POST /orders
  - { from: api, to: db, label: INSERT order, kind: async }
  - api --> client: 201 Created
```

## Trace waterfall

A trace holds one sampled request, not an average. A dependency that retries
only sometimes costs a real user the full time here, which a percentile chart
hides.

```spans
title: GET /orders/{id}
description: One sampled request, 2026-08-28. The payments call was retried once.
unit: ms
spans:
  - { id: get, service: api, name: "GET /orders/{id}", start: 0, duration: 138, kind: server }
  - api/auth: verify token · 3 · 9 · get
  - db/orders: SELECT orders · 14 · 38 · get
  - { id: cat, service: catalogue, name: "GET /skus", start: 55, duration: 62, parent: get, kind: client }
  - { id: sku, service: cache, name: "GET sku:A1", start: 58, duration: 4, parent: cat, kind: cache }
  - { id: pay, service: payments, name: "GET /payments/ord_123", start: 120, duration: 16, parent: get, kind: client, error: true, attrs: { http.status: 502 }, note: The first call returned 502 and the retry succeeded. }
```

## ERD

```erd
title: Shop schema
entities:
  - name: users
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: email, type: text }
  - name: orders
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: user_id, type: uuid, fk: true }
      - { name: total, type: numeric }
relations:
  - orders }o--|| users: placed by
```

## User story

```userstory
id: sw-us-1
role: shopper
want: pay in one step
soThat: I can check out quickly
priority: High
points: 3
criteria:
  - { given: a saved card, when: I confirm, then: the order is placed }
links:
  - { ref: '#sw-seq-checkout', label: Checkout flow }
```

## Timeline

```timeline
title: Roadmap
items:
  - "[done] Q1 · MVP"
  - "[current] Q2 · Beta"
  - "[next] Q3 · GA"
```

## Kanban

```kanban
title: Sprint board
columns:
  - { label: To do, cards: [ { title: Auth, tag: backend }, { title: Login UI } ] }
  - { label: Doing, cards: [ { title: Checkout, tag: api } ] }
  - { label: Done, cards: [ { title: DB schema } ] }
```

## Rollout

A gate compares the new version against the old one on the same traffic, not
against last week. A stage that fails its gate holds; nothing reverts until a
person or the rollback line says so.

```rollout
title: Orders API v2
strategy: canary
stages:
  - "[done] 1% · Smoke · 15m — no 5xx"
  - "[current] 10% · Canary · 30m — error rate < 0.5%"
  - "[next] 50% · Half · 2h — p95 < 300 ms"
  - { name: Full, traffic: 100, status: next, note: Delete the v1 deployment after 24 h. }
rollback: Flip the orders-v2 flag off; v1 keeps serving without a deploy.
```

## Story map

```storymap
title: Checkout story map
description: "The backbone of activities across the top; each release slice holds the cards that ship under each step."
backbone:
  - { label: Browse, note: Find the product }
  - { label: Decide, note: Trust the price }
  - { label: Pay }
  - { label: Confirm }
slices:
  - label: MVP
    cells:
      - [Search box]
      - ["Product page", "Price incl. tax"]
      - [{ title: Card payment, tag: risky }]
      - [Order email]
  - label: Later
    cells:
      - ["Filters", "Saved carts"]
      - [Reviews]
      - [{ title: Wallet pay, tag: spike }]
      - []
```

## Task tracker

```statustable
variant: tracker
title: Tasks
items:
  - { task: Set up CI, status: done, priority: high, owner: Ana }
  - { task: Payment flow, status: doing, priority: high, owner: Lee, due: Fri }
  - { task: Write docs, status: todo, priority: med }
  - { task: Rate limiting, status: blocked, priority: low }
```

## Status table

```statustable
title: Launch workstreams
description: Weekly status roll-up; statuses use our own vocabulary.
columns: [Workstream, Latest update]
statuses:
  - { label: on track, color: green }
  - { label: at risk, color: amber }
  - { label: blocked, color: error }
  - { label: in review, color: purple }
rows:
  - { cells: [Checkout revamp, A/B test at 50%; conversion up 0.3pp], status: on track }
  - cells: [Vendor SSO, Contract countersigned; sandbox creds due this week]
    status: at risk
    subtasks:
      - { cells: [SAML metadata exchange, Our metadata sent Tuesday], status: on track }
      - { cells: [Provisioning sync, Waiting on sandbox credentials], status: blocked }
  - { cells: [Rate-limit rework, PR up for second review], status: in review }
  - { cells: [Docs refresh, Draft complete], status: done }
```

## Risk register

```risk
title: Launch risks
description: Reviewed weekly until GA.
items:
  - { risk: Key dependency ships late, likelihood: high, impact: high, mitigation: Feature-flag the integration and keep the old path., owner: PM, status: open }
  - { risk: Traffic spike overwhelms the API, likelihood: med, impact: high, mitigation: Autoscaling + load-shedding at the gateway., owner: Platform, status: mitigating }
  - { risk: Docs lag the release, likelihood: med, impact: low, status: accepted }
  - { risk: Beta feedback arrives after freeze, likelihood: low, impact: low, mitigation: Weekly beta digest to the team., owner: DevRel, status: closed }
```

## Wireframe

```wireframe
title: Checkout screen
screens:
  - device: phone
    title: Checkout
    elements:
      - { type: header, label: Checkout }
      - { type: input, label: Card number }
      - { type: input, label: Expiry }
      - { type: button, label: Pay now, tone: accent }
      - { type: text, label: Secure payment, align: c, tone: muted }
```

## API endpoint

```endpoint
method: POST
path: /orders/{cartId}
title: Create an order
description: Convert a cart into an order and start fulfilment.
auth: Bearer <token>
params:
  - { name: cartId, in: path, type: uuid, required: true, desc: Cart to convert }
  - { name: dry-run, in: query, type: boolean, desc: Validate without persisting }
body:
  - { name: items, type: "Item[]", required: true, desc: Line items }
  - { name: coupon, type: string, desc: Optional discount code }
responses:
  - { status: 201, desc: Order created }
  - { status: 400, desc: Invalid cart }
  - { status: 401, desc: Missing or invalid token }
request: |
  { "items": [{ "sku": "A1", "qty": 2 }], "coupon": "SAVE10" }
response: |
  { "id": "ord_123", "status": "pending", "total": 42.00 }
```

```packet
title: Wire format of the request header
width: 32
fields:
  - { label: Version, bits: 4, value: "1" }
  - { label: Flags, bits: 4 }
  - { label: Total length, bits: 24 }
  - { label: Request id, bits: 32, accent: teal }
```

## Event contract

Payments emits this event and never waits for a reply, so the endpoint contract
above does not apply to it. Delivery is at-least-once: a consumer that is not
idempotent will ship the same order twice.

```eventcontract
name: order.paid
version: v2
channel: orders
summary: Payment for an order was captured, so fulfilment may start.
producers: [payments]
consumers: [fulfilment, billing, analytics]
delivery: at-least-once
ordering: per-key
key: order_id
retention: 7d
schema:
  - order_id uuid required — The order the payment belongs to
  - payment_id uuid required — The capture in the payment provider
  - amount money required — Captured amount, as a decimal string with currency
  - method string required — One of card, wallet, or invoice
  - captured_at timestamp required — When the provider confirmed the capture
headers:
  - trace_id string required — W3C trace id of the checkout request
example: |
  { "order_id": "ord_123", "payment_id": "pay_77", "amount": "42.00 EUR", "method": "card" }
errors:
  - DuplicateCapture — the same payment_id arrived twice; drop the event
note: Fulfilment must be idempotent on order_id.
```

## Pull quote

```pullquote
text: Site group = read at that plant. Role group = extra actions on top.
attribution: The taxonomy in one line
```

## Access in three layers

```layers
items:
  - { kicker: L1, title: Identity, source: IdP JWT, question: "Are you a signed-in user?", body: Validate the token and resolve groups. }
  - { kicker: L2, title: Site scope, source: JWT + lookup, question: "Which sites may you see?", body: Confirm the site is in the user's set. }
  - { kicker: L3, title: Permission, source: App DB, question: "What may you do here?", body: Resolve persona permissions from the matrix. }
```

## Success callout

```callout
tone: success
title: Why this scales
body: Site and role are separate group types, so they grow on independent axes.
```

## Capability matrix

```matrix
title: Who can do what
corner: Role / App
cols: [Billing, Reports, Admin]
rows:
  - { label: Owner,   cells: [Full, Full, Full] }
  - { label: Manager, cells: [Full, Read, "—"] }
  - { label: Viewer,  cells: [Read, Read, "—"] }
```

## Anatomy of a permission

```anatomy
separator: ":"
parts:
  - { label: App,     value: meridian,         note: Which product. }
  - { label: Feature, value: billing,       note: The area within the app. }
  - { label: Action,  value: invoices.read, note: The specific capability. }
```

## Composition

```composition
title: How access is decided
result: May read invoices
gates:
  - { label: Identity,   desc: A valid signed-in user. }
  - { label: Scope,      desc: The request is in range. }
  - { label: Permission, desc: The action is granted. }
```

## Drivers

```drivers
title: What guided the design
items:
  - { title: Single sign-on, body: One login carries the user everywhere., tag: "HOW: token", icon: lock, accent: purple }
  - { title: Read per site, body: "Access is scoped to the user's sites.", tag: "WHERE: site group", icon: location, accent: green }
  - { title: Governed roles, body: "An IGA requests, approves, certifies.", tag: "WHO: role groups", icon: shield, accent: blue }
  - { title: Per-app permissions, body: The same role differs per app., tag: "WHAT: matrix", icon: grid, accent: amber }
```

## Options

```options
title: Approaches explored
items:
  - { kicker: Option 1, title: App-managed roles, how: Roles in our own DB., pros: [Full control], cons: ["Second source of truth"], verdict: "REJECTED", tone: rejected }
  - { kicker: Option 2, title: Global role groups, how: One global group per role., pros: [Fewest groups], cons: ["Applies at every site"], verdict: "VIABLE", tone: viable }
  - { kicker: Option 3, title: Per-site role groups, how: One group per persona per site., pros: [Least privilege], cons: [Most groups], verdict: "CHOSEN", tone: chosen }
```

## Decision scorecard

```scorecard
title: Queue technology choice
description: "Weighted 0-5 scoring across the four criteria that mattered. Throughput and operational cost carry double weight; SQS wins on the weighted total."
criteria:
  - { label: Throughput, weight: 2 }
  - { label: Operational cost, weight: 2 }
  - { label: Team familiarity }
  - { label: Ecosystem }
options:
  - { label: Kafka, scores: [5, 2, 3, 5], note: self-hosted }
  - { label: SQS, scores: [3, 5, 4, 3], note: managed }
  - { label: RabbitMQ, scores: [3, 3, 4, 4] }
```

## Spec

```spec
title: Per-site role groups
accent: green
rows:
  - { label: Groups, value: "SiteN-Users (read) + SiteN-<Persona> per staffed plant." }
  - { label: Roles, value: "Each group reads as (site, role); the token carries the scope." }
  - { label: Resolution, steps: [Decode token, "Read (site, role)", Check matrix] }
```

## Fancy list

```list
title: Why documentation-as-code
style: accent
items:
  - { lead: Typed blocks, text: "76 strict schemas, validated by chiltepin check.", accent: blue }
  - { lead: One source of truth, text: Diagrams live in the .md file., accent: green }
  - { lead: Many outputs, text: "HTML, slides, and PDF from one file.", accent: amber }
```

## Story backlog

```stories
title: Sprint backlog
items:
  - { id: US-1, title: One-step checkout, role: shopper, want: pay in one step, soThat: I finish faster, priority: High, points: 5, tags: [checkout], open: true, criteria: [{ given: items in cart, when: I pay, then: an order is created }] }
  - { id: US-2, title: Save payment method, role: returning shopper, want: store a card, soThat: I skip re-entry, priority: Med, points: 3 }
```

## Design pattern

```pattern
name: Repository
category: Backend
intent: Hide persistence behind a collection-like interface so the domain never sees the database.
forces: [Swap the data store, Unit-test without a DB, No query leaks into the domain]
participants:
  - { name: OrderRepository, role: interface the service depends on }
  - { name: PgOrderRepository, role: Postgres implementation }
  - { name: OrderService, role: caller (domain logic) }
consequences:
  pros: [Swappable storage, Testable with a fake]
  cons: [Another layer, Risk of anemic pass-through]
```

## Bug gallery

```gallery
cols: 2
items:
  - { title: "N+1 query", lang: JavaScript, accent: red, caption: "1000 users = 1001 queries.", code: "users.forEach(async u =>\n  await q('...user_id=?', u.id));" }
  - { title: "Off-by-one", lang: JavaScript, accent: amber, caption: "arr[len] is undefined.", code: "for (let i=0; i<=arr.length; i++)\n  process(arr[i]);" }
  - { title: "Open redirect", lang: JavaScript, accent: red, caption: "Allowlist destinations.", code: "res.redirect(req.query.url);" }
  - { title: "Secrets in code", lang: JavaScript, accent: red, caption: "Use env vars + a scanner.", code: "const KEY = 'sk-live-abc123';" }
```

## Gallery — diagram comparison

```gallery
title: Compare architectures
cols: 3
items:
  - title: Monolith
    caption: One deployable unit.
    block:
      type: c4
      level: container
      nodes:
        - { id: u, col: 1, row: 1, kind: person, name: User }
        - { id: app, col: 2, row: 1, kind: container, family: service, name: App }
        - { id: db, col: 2, row: 2, kind: store, name: DB }
      edges:
        - { from: u, to: app }
        - { from: app, to: db }
  - title: Microservices
    caption: Independent services.
    block:
      type: c4
      level: container
      nodes:
        - { id: gw, col: 1, row: 1, kind: container, family: service, name: Gateway }
        - { id: a, col: 2, row: 1, kind: container, family: service, name: Orders }
        - { id: b, col: 2, row: 2, kind: container, family: service, name: Billing }
      edges:
        - { from: gw, to: a }
        - { from: gw, to: b }
  - title: Event-driven
    caption: Async via a broker.
    block:
      type: block
      nodes:
        - { id: p, col: 1, row: 1, kind: producer, name: Producer }
        - { id: bus, col: 2, row: 1, kind: topic, name: Bus }
        - { id: c, col: 3, row: 1, kind: consumer, name: Consumer }
      edges:
        - { from: p, to: bus }
        - { from: bus, to: c }
```

## Data charts

```chart
title: p95 latency by week
kind: line
unit: ms
labels: [W1, W2, W3, W4, W5, W6]
series:
  - { label: /orders, accent: navy, values: [240, 226, 215, 188, 164, 150] }
  - { label: /search, accent: teal, values: [310, 295, 288, 262, 246, 231] }
```

```chart
title: Monthly cost by service
kind: bar
unit: k
labels: [API, Workers, Postgres, Cache]
series:
  - { label: March, accent: navy, values: [8.2, 4.6, 3.1, 1.2] }
  - { label: April, accent: amber, values: [7.4, 5.1, 3.3, 1.1] }
```

```chart
title: Traffic by client
kind: donut
unit: "%"
items:
  - { label: Web, value: 62, accent: navy }
  - { label: iOS, value: 23, accent: teal }
  - { label: Android, value: 15, accent: amber }
```

```chart
title: Migration progress
description: "A gauge answers how far along one number is; max is the full sweep (default 100)."
kind: gauge
unit: "%"
items:
  - { label: Services migrated, value: 68, desc: of 42 services }
  - { label: Traffic cut over, value: 41, accent: teal }
```

```chart
title: Incident causes last quarter
description: "A pie is the donut with the centre filled — use it when there is no total worth printing."
kind: pie
unit: "%"
items:
  - { label: Config change, value: 41 }
  - { label: Deploy, value: 27 }
  - { label: Capacity, value: 18, accent: teal }
  - { label: Third party, value: 14 }
```

```chart
title: Checkout latency distribution
description: "Sampled requests, binned by the renderer (Sturges); the dashed rule is the mean."
kind: histogram
unit: ms
values: [112, 118, 121, 124, 127, 129, 131, 133, 134, 136, 138, 139, 141, 142, 143, 145,
  146, 148, 149, 151, 152, 154, 155, 157, 158, 160, 162, 164, 166, 168, 171, 174,
  177, 181, 185, 189, 194, 199, 205, 212, 220, 231, 244, 258, 275, 296, 322, 358]
```

```chart
title: Response time against the SLO
description: "Where the p95 target sits on the fitted curve — the z-score under each marker says how far out it is."
kind: bell
unit: ms
mean: 180
sd: 35
markers:
  - { at: 250, label: SLO p95, accent: amber }
  - { at: 120, label: Cache hit }
```

```chart
title: Build time by pipeline
description: "Five-number summaries over the last 200 runs; the accent box is the pipeline under repair."
kind: boxplot
unit: min
boxes:
  - { label: Web, min: 4.1, q1: 5.2, median: 5.9, q3: 6.8, max: 8.3, outliers: [11.4] }
  - { label: API, min: 2.8, q1: 3.4, median: 3.9, q3: 4.6, max: 5.7 }
  - { label: Mobile, min: 9.5, q1: 12.1, median: 14.2, q3: 16.8, max: 21, outliers: [26.5, 28.1], accent: amber }
  - { label: Data, min: 6, q1: 7.7, median: 8.4, q3: 9.9, max: 12.2 }
```

```chart
title: Support tickets by root cause
description: "The accent bars are the vital few — fix those and 80% of the volume is gone."
kind: pareto
items:
  - { label: Login, value: 142 }
  - { label: Billing, value: 96 }
  - { label: Export, value: 41 }
  - { label: Search, value: 23 }
  - { label: Mobile, value: 14 }
  - { label: Other, value: 9 }
```

```chart
title: Q3 engineering targets
description: "Measure against target inside poor / ok / good ranges, one row per metric."
kind: bullet
unit: "%"
bullets:
  - { label: Uptime, value: 99.7, target: 99.9, ranges: [99, 99.5, 100] }
  - { label: Test coverage, value: 72, target: 80, ranges: [50, 70, 100] }
  - { label: Cache hit rate, value: 91, target: 85, ranges: [60, 80, 100] }
  - { label: Error budget used, value: 64, target: 50, ranges: [50, 80, 100], accent: red }
```

```chart
title: Judge scores per dimension, old skill against new skill
description: "Two values per row on the 1–5 judge scale. The grey dot is the old skill, the accent dot is the new skill, and the change prints at the right."
kind: dumbbell
min: 1
max: 5
labels: [Opening, Ending, Structure fit, Substance, Fidelity, Diagram clarity]
series:
  - { label: Old skill, values: [3.5, 1.3, 3.6, 3.4, 3.7, 2.8] }
  - { label: New skill, values: [5.0, 4.6, 4.7, 4.3, 4.6, 3.6] }
```

```sankey
title: Where the cloud bill goes
description: "Node height and ribbon thickness are the same scale — the widest ribbon is where the money actually goes."
unit: k
links:
  - { from: Bill, to: Compute, value: 62 }
  - { from: Bill, to: Storage, value: 28 }
  - { from: Bill, to: Network, value: 10 }
  - { from: Compute, to: Serving, value: 38 }
  - { from: Compute, to: Batch, value: 24 }
  - { from: Storage, to: Hot, value: 19 }
  - { from: Storage, to: Archive, value: 9 }
```

```treemap
title: Cloud spend by service
description: "Area is the value — a treemap keeps working where a donut gives up at six slices."
unit: k
items:
  - { label: Compute, value: 62, desc: EC2 + Lambda }
  - { label: Storage, value: 28, desc: S3 and snapshots }
  - { label: Databases, value: 24 }
  - { label: Network, value: 16 }
  - { label: Observability, value: 11, accent: amber }
  - { label: CI runners, value: 9 }
```

```venn
title: Who owns the release process
sets:
  - { label: Platform, desc: runtime and CI }
  - { label: Product, desc: features and UX }
shared:
  - { sets: [Platform, Product], label: Release process }
```

```fishbone
title: Why checkout latency rose
description: "One effect at the head, cause categories as bones, specific causes along each bone."
effect: p95 checkout over 2s
causes:
  - { label: Code, items: [Sync capture call, N+1 cart query] }
  - { label: Infrastructure, items: [Undersized DB pool, No read replica] }
  - { label: Traffic, items: [Flash-sale spikes] }
  - { label: Process, items: [No load test before release] }
```

```chart
title: Queue vendors at a glance
kind: radar
labels: [Throughput, Latency, Cost, Ops burden, Ecosystem]
series:
  - { label: Kafka, accent: navy, values: [5, 4, 2, 2, 5] }
  - { label: SQS, accent: amber, values: [3, 3, 5, 5, 3] }
```

```chart
title: Fix candidates by effort and impact
description: "Bubble area is the affected traffic share; the dashed guides cut the plot into four quadrants."
kind: scatter
xLabel: Effort (weeks)
yLabel: Impact
points:
  - { x: 1, y: 8, size: 30, label: Cache headers }
  - { x: 3, y: 9, size: 80, label: Read replica }
  - { x: 2.5, y: 4, size: 15, label: Retry budget }
  - { x: 6, y: 3, size: 20, label: Full rewrite }
  - { x: 2, y: 2, label: New font }
guides:
  x: 4
  y: 5
  quadrants: [Do first, Plan well, Fill in, Avoid]
```

```slopegraph
title: Support volume by channel
description: "Each line is one channel between two years; the slope is the message, and the accented line carries the story."
left: "2023"
right: "2025"
unit: "%"
items:
  - { label: Email, from: 48, to: 22 }
  - { label: Chat, from: 20, to: 45, accent: teal }
  - { label: Phone, from: 32, to: 33 }
  - { label: Self-serve, from: 0, to: 12 }
```

## Latency budget

```chart
kind: waterfall
description: Where the checkout API's 250 ms budget goes, hop by hop.
unit: ms
budget: 250
items:
  - { label: DNS + TLS, value: 35 }
  - { label: Gateway, value: 20, desc: auth + routing }
  - { label: Orders service, value: 90 }
  - { label: Database, value: 70 }
  - { label: Serialization, value: 15 }
```

## Heatmap

```heatmap
title: p95 latency by region × hour
description: UTC hours, last 7 days.
unit: ms
xLabels: ["00", "04", "08", "12", "16", "20"]
rows:
  - { label: us-east-1, values: [122, 118, 145, 210, 265, 190] }
  - { label: eu-west-1, values: [110, 105, 168, 240, 195, 150] }
  - { label: ap-south-1, values: [180, 210, 310, 285, 240, 205] }
```

## Figure

```figure
src: https://chiltepin.dev/logo.png
alt: The Chiltepin logo
caption: "The Chiltepin logo, capped at 420 px."
width: 420
```

## Unified diff

```code
kind: diff
title: "fix: clamp retry backoff"
lang: TypeScript
code: |
  @@ -12,7 +12,7 @@
   function backoff(attempt: number): number {
  -  return 100 * attempt ** 2;
  +  return Math.min(30_000, 100 * attempt ** 2);
   }
```

## Before / after

```code
kind: compare
lines: true
caption: Backoff grows without bound on the left; the right caps it at 30 s.
blocks:
  - lang: TypeScript
    highlight: "2"
    code: |
      function backoff(attempt: number): number {
        return 100 * attempt ** 2;
      }
  - lang: TypeScript
    highlight: "2"
    code: |
      function backoff(attempt: number): number {
        return Math.min(30_000, 100 * attempt ** 2);
      }
```

## Runbook steps

```steps
title: Deploy a hotfix
description: The fast path for a production fix — branch, ship, tag.
items:
  - title: Branch from main
    body: Hotfixes always branch from the latest main.
    code: git checkout -b hotfix/fix-retry main
    lang: bash
  - title: Ship the fix
    body: Commit and push; CI runs the full suite.
    code: git push -u origin hotfix/fix-retry
    lang: bash
    note: CI must be green before the next step.
  - title: Tag and deploy
    code: git tag v1.4.1 && git push --tags
    lang: bash
```

## FAQ

```faq
title: Common questions
items:
  - q: Where does the content live?
    a: "In the .md files on disk — they are the single source of truth. Every diagram on this page is a typed YAML block."
    open: true
  - q: Do diagrams need a drawing tool?
    a: "No. Change the YAML and rerun chiltepin html — the SVG updates."
  - q: How do I validate a doc?
    a: Run chiltepin check and fix every diagnostic it reports.
```

## Capacity math

```envelope
title: Order-write capacity
description: The estimate that sizes the write path.
assumptions:
  - { label: Daily active users, value: 2M }
  - { label: Orders / user / day, value: "0.5" }
  - { label: Payload per order, value: 2 KB }
  - { label: Retention, value: 5 years }
steps:
  - { label: Orders per day, calc: "2M × 0.5", result: 1M/day }
  - { label: Write QPS, calc: "1M / 86,400 s", result: "≈ 12 rps" }
  - { label: Peak QPS, calc: "12 × 3 (peak factor)", result: "≈ 36 rps" }
  - { label: Storage per year, calc: "1M × 2 KB × 365", result: "≈ 730 GB/yr" }
result: { label: Provision for, value: "~75 rps write peak · ~4 TB over retention" }
```

## Service objectives

```slo
title: Orders API — SLOs
items:
  - { name: Availability, sli: Successful requests / total requests, target: 99.9%, current: 99.98%, window: 30d, budget: 0.15 }
  - { name: Latency, sli: Requests served under 400 ms (p99), target: 99%, current: 98.8%, window: 30d, budget: 0.6 }
  - { name: Freshness, sli: Order events indexed within 60 s, target: 99.5%, current: 97.9%, window: 7d, budget: 1.0 }
```

## Terminal session

```code
kind: terminal
title: deploy — production
session: |
  $ kubectl rollout status deploy/orders-api
  # wait for the rollout to settle before tagging
  Waiting for deployment "orders-api" rollout to finish: 2 of 4 updated replicas are available...
  deployment "orders-api" successfully rolled out
  $ kubectl get pods -l app=orders-api
  NAME                          READY   STATUS    RESTARTS   AGE
  orders-api-7d4b9c6f5d-2xkqp   1/1     Running   0          52s
  orders-api-7d4b9c6f5d-9mwlt   1/1     Running   0          48s
  $ git tag v2.3.0 && git push --tags
```

## SWOT

```swot
title: Taking Chiltepin to the enterprise
description: Where we stand before the enterprise push.
strengths:
  - Docs-as-code fits existing review workflows
  - 107 typed blocks cover most technical stories
  - Renders to HTML, slides, and PDF from one file
weaknesses:
  - No SSO / SCIM integration yet
  - Small team — support hours are limited
opportunities:
  - Compliance push makes auditable docs attractive
  - AI agents author blocks natively via the skill
threats:
  - Incumbent wikis bundle "good enough" diagrams
  - Long procurement cycles slow adoption
```

```scqa
title: Why this quarter goes to checkout
lede: The one decision this review needs.
situation: We process 12k orders a day across three regions.
complication: p95 checkout crossed 2s in March and conversion fell 3.1pp with it.
question: Where does the next quarter of platform work go?
answer: Move payment capture off the request path — it returns 1.8s of the 2.4s.
because:
  - Capture is 74% of p95 and is fully async-able
  - No schema change, so it ships inside one quarter
```

```scenarios
title: Three ways next year goes
description: The three cases span $13M of FY27 revenue.
drivers: [Capture moved async, Conversion recovery, Volume growth]
outcomeLabel: FY27 revenue
cases:
  - { label: Downside, values: ["Q4 slip", "+0.8pp", "5%"], outcome: "$18M", tone: neg }
  - { label: Base, values: ["Q3", "+2.1pp", "8%"], outcome: "$24M", tone: base }
  - { label: Upside, values: ["Q3", "+3.4pp", "15%"], outcome: "$31M", tone: pos }
```

```harvey
title: Queue vendor fit
description: "Ratings are judgements, 0-4; the WEIGHTED row is computed, so the recommendation and the arithmetic agree."
columns: [Kafka, SQS, RabbitMQ]
scale: [poor, excellent]
rows:
  - { label: Throughput, ratings: [4, 2, 3], weight: 2, note: sustained messages per second }
  - { label: Operational burden, ratings: [1, 4, 3], weight: 2 }
  - { label: Team familiarity, ratings: [2, 4, 3] }
  - { label: Ecosystem, ratings: [4, 3, 3] }
recommend: SQS
```

```wardley
title: Where to build, where to buy
description: "Build the scoring model, buy the warehouse — only the model is still evolving."
components:
  - { id: analyst, label: Analyst, x: 0.72, y: 0.96, kind: user }
  - { id: reports, label: Reporting UI, x: 0.42, y: 0.74 }
  - { id: model, label: Scoring model, x: 0.22, y: 0.54, kind: build, movement: 0.18 }
  - { id: warehouse, label: Warehouse, x: 0.78, y: 0.32, kind: commodity }
links:
  - { from: analyst, to: reports }
  - { from: reports, to: model }
  - { from: model, to: warehouse }
```


## Conversion funnel

```chart
kind: funnel
title: Signup → paid conversion
description: Last 90 days, all channels.
unit: users
items:
  - { label: Visited landing page, value: 48000 }
  - { label: Started signup, value: 9600, desc: email + password }
  - { label: Activated, value: 4300, desc: created a first doc }
  - { label: Upgraded to paid, value: 860 }
```

## OKRs

```okr
title: Q3 objectives
description: Two objectives, reviewed monthly.
items:
  - objective: Make onboarding effortless
    owner: Growth
    krs:
      - { kr: Time-to-first-doc under 5 minutes, progress: 0.7, status: on-track }
      - { kr: Activation rate from 45% to 60%, progress: 0.4, status: at-risk }
      - { kr: Ship 10 quick-start templates, progress: 1, status: done }
  - objective: Earn enterprise trust
    owner: Platform
    krs:
      - { kr: Ship SSO + audit log, progress: 0.85, status: on-track }
      - { kr: SOC 2 Type II report issued, progress: 0.2, status: off-track }
```

## Personas

```persona
title: Who we build for
personas:
  - name: Maya Chen
    role: Staff engineer
    quote: I want the diagram in the PR diff, not in a wiki.
    goals: [Docs that live with the code, Reviewable architecture changes]
    frustrations: [Stale wiki pages, Screenshots of whiteboards]
    tools: [VS Code, GitHub, Mermaid]
    accent: blue
  - name: Priya Patel
    role: Engineering manager
    quote: Every reorg breaks our onboarding docs.
    goals: [One source of truth per system, New joiners productive in week one]
    frustrations: ["Docs no one owns", Tribal knowledge in DMs]
    tools: [Linear, Notion, Slack]
    accent: teal
```

## Changelog

```changelog
title: Release history
releases:
  - version: 2.0.0
    date: 2026-06-24
    tag: breaking
    items:
      - { type: changed, text: "Config moved from .chiltepinrc to chiltepin.config.json" }
      - { type: removed, text: Dropped Node 18 support }
      - { type: security, text: Bumped yaml to patch CVE-2026-1234 }
  - version: 1.4.0
    date: 2026-05-12
    tag: minor
    items:
      - { type: added, text: Dark theme + custom theme files }
      - { type: fixed, text: Slide overflow on long tables }
  - version: 1.3.2
    date: 2026-04-03
    tag: patch
    items:
      - { type: fixed, text: Windows path handling in chiltepin check }
```

## Team

```team
title: Who owns what
members:
  - { name: Ana Ruiz, role: Tech lead, focus: Rendering pipeline, accent: navy }
  - { name: Sam Okafor, role: Backend, focus: Sync + integrations, accent: teal }
  - { name: Lena Fischer, role: Design, focus: Themes and house style, accent: purple }
  - { name: Tom Alvarez, role: CLI, focus: chiltepin commands and DX, accent: green }
  - { name: DevRel, initials: DR, role: Advocacy, focus: Docs and community, accent: amber }
```

## Design tokens

```palette
title: Brand palette
description: Core color tokens — reference by name, never by raw hex.
cols: 4
colors:
  - { name: Primary, value: "#0E54A1", usage: "Buttons, links, focus rings" }
  - { name: Ink, value: "#1F2937", usage: Body text and headings }
  - { name: Surface, value: "#F6F8FB", usage: Card and panel backgrounds }
  - { name: Positive, value: "#1F9747", usage: Success states }
  - { name: Warning, value: "#B45309", usage: Caution banners }
  - { name: Negative, value: "#B3261E", usage: Errors and destructive actions }
  - { name: Accent, value: "#5B4A8A", usage: Charts and highlights }
  - { name: Muted, value: "#8A8475", usage: Secondary text }
```

## Type scale

```typescale
description: The ramp from display headings down to code.
items:
  - { name: Display, size: 40, weight: 700, font: display, lineHeight: 1.1, note: hero headings }
  - { name: H1, size: 28, weight: 700, font: display, lineHeight: 1.2 }
  - { name: Body, size: 15, lineHeight: 1.6 }
  - { name: Caption, size: 12, weight: 500, note: secondary text }
  - { name: Code, size: 13, font: mono }
```

## Usage guidelines

```dodont
title: Button usage
description: How to place and label buttons.
dos:
  - { text: Use one primary button per view }
  - { text: Write labels as verbs, example: "Save changes" }
  - { text: Pair a destructive action with a confirm step }
donts:
  - { text: Stack two primary buttons side by side }
  - { text: Disable a button without explaining why, example: "tooltip: Add a line item first" }
```

## Component inventory

```inventory
title: Component status
description: Maturity of the shared component library.
items:
  - { name: Button, status: stable, tag: v2 }
  - { name: Data table, status: beta, note: Column-resize API may change before GA }
  - { name: Date picker, status: experimental }
  - { name: Modal (legacy), status: deprecated, note: Use Dialog instead }
  - { name: Charts, status: planned, note: Targeted for next quarter }
```

## Array walkthrough

```array
title: Binary search for 27 — step 2
description: mid lands on 19, so the search space halves to the right.
items:
  - { value: "3", tone: muted }
  - { value: "7", tone: muted }
  - { value: "12", label: lo }
  - { value: "19", tone: active, label: mid }
  - { value: "27", tone: target }
  - { value: "41", label: hi }
window: { from: 2, to: 5, label: search space }
```

## Linked list

```linkedlist
title: Reversing a list — step 2
description: prev trails curr; each step flips one next pointer.
nodes:
  - { value: "9", tone: visited, label: prev }
  - { value: "4", tone: active, label: curr }
  - { value: "7", label: next }
  - { value: "1" }
```

## Binary tree

```bintree
title: BST search for 27
description: The tinted chain is the comparison path down to the target.
nodes:
  - { id: root, value: "19", tone: visited }
  - { id: l, value: "8", parent: root, side: left }
  - { id: ll, value: "4", parent: l, side: left }
  - { id: lr, value: "12", parent: l, side: right }
  - { id: r, value: "31", parent: root, side: right, tone: active }
  - { id: rl, value: "27", parent: r, side: left, tone: target }
  - { id: rr, value: "40", parent: r, side: right }
```

## Hash table

```hashmap
description: "Chained buckets — hash(key) % 8; plum and grape collide in bucket 2."
buckets: 8
entries:
  - { key: apple, value: "3", bucket: 0 }
  - { key: plum, value: "9", bucket: 2, tone: active }
  - { key: grape, value: "1", bucket: 2 }
  - { key: fig, value: "7", bucket: 5, tone: muted }
```

## Agent loop

```agentloop
title: Support triage agent
description: "One loop turn — the agent reads the ticket, calls tools, and replies or escalates. The loop ends only two ways: a reply is sent or a human gets the ticket."
agent:
  name: Triage agent
  model: claude-sonnet-4-6
  note: Routes each ticket to a fix or a human.
env: Customer
tools:
  - { name: search_kb, desc: Search help-center articles }
  - { name: get_account, desc: Look up plan and billing state }
  - { name: create_ticket, desc: Escalate to a human queue }
memory:
  - conversation history
  - customer profile
stop: reply sent or ticket escalated
```

## Execution trace

```trace
title: Password reset — one episode
description: "One real episode: the agent checked delivery logs before blaming spam."
turns:
  - role: user
    text: I never get the reset email.
  - role: assistant
    thinking: Could be a bounce — check delivery logs before blaming spam.
    text: Let me check our email logs.
  - role: tool
    tool: email_logs.search
    args: '{ "to": "sam@example.com", "type": "password_reset" }'
    result: "1 result: bounced (mailbox full)"
  - role: assistant
    text: Your mailbox rejected the email — free up space and I will resend it.
```

## Prompt anatomy

```prompt
title: Support reply template
description: The system + user template behind every triage turn.
segments:
  - kind: system
    label: role + guardrails
    text: "You are a support agent for {{product}}. Answer from the docs only."
  - kind: user
    text: "Customer ({{plan}} plan) asks: {{question}}"
vars:
  - { name: product, desc: Product name from config }
  - { name: plan, desc: Plan tier of the signed-in customer }
  - { name: question, desc: The inbound message }
```

## Context budget

```context
title: Where the 200k window goes
description: Steady-state budget for one triage turn.
window: 200000
segments:
  - { label: system prompt, tokens: 6000, accent: navy }
  - { label: tool schemas, tokens: 14000, accent: teal }
  - { label: retrieval, tokens: 60000, accent: amber, desc: top-8 chunks }
  - { label: history, tokens: 70000, accent: purple }
```

## Section divider

```divider
kicker: PART 2
title: What we change
subtitle: The three fixes, in the order we ship them.
accent: navy
```

## Big number

```bignumber
value: "-75%"
label: Checkout p95 after moving capture off the request path
context: "2.4s → 600ms, measured over four weeks of production traffic"
delta: "-1.8s"
trend: down
accent: green
```

## Takeaways

```takeaways
items:
  - text: The synchronous capture call was the bottleneck
    detail: It accounted for 71% of the 2.4s checkout p95.
  - text: Moving it to a queue cut p95 by 75%
    detail: No other change shipped in the window.
  - text: Conversion recovered within two weeks
    detail: "+0.4pp against the pre-regression baseline."
  - text: The pattern generalises
    detail: Audit every synchronous third-party call on the hot path.
```

## Quality, UML, ML, and deck shapes

Thirteen blocks added in the September coverage sweep. Each is the example `chiltepin block <type>` prints.

### Audit findings

What a review found, worst first, with the evidence and the fix.

```audit
title: Security review — payments service
scope: payments-api, payments-worker
date: 2026-09-01
auditor: AppSec
findings:
  - { id: F1, title: Refund endpoint has no rate limit, severity: high, area: API, evidence: "POST /refunds accepted 500 req/s in the load test", fix: Add the shared limiter at 20 req/min per key, owner: payments, status: fixing }
  - { id: F2, title: Card BIN logged at INFO, severity: critical, area: Logging, evidence: "worker.log line 2231", fix: Mask to first 2 digits; add the log-scrub test, owner: payments, status: open }
  - { id: F3, title: Dependency openssl 3.0.8 has a known CVE, severity: medium, area: Supply chain, fix: Bump to 3.0.14, owner: platform, status: fixed }
  - { id: F4, title: Health endpoint leaks build SHA, severity: info, area: API, status: accepted }
```

### Readiness checklist

A standard applied once: each item a verdict with its proof, the pass rate derived.

```checklist
title: Production readiness — search-indexer
standard: PRR v4
groups:
  - label: Observability
    items:
      - "[pass] Dashboards for the four golden signals — grafana/search-indexer"
      - "[pass] Alerts route to the on-call — pagerduty svc P4"
      - "[partial] Traces sampled at 10% — target is 100% on errors"
  - label: Resilience
    items:
      - "[fail] Load test at 2× peak — not run since the Kafka move"
      - "[na] Multi-region failover — single-region service by design"
```

### Performance budget

Measured against budget; over, near, and ok are derived, not typed.

```perfbudget
title: Product page — web vitals
context: p75, mobile, 4G, 30-day field data
metrics:
  - { metric: LCP, budget: 2500, measured: 2140, unit: ms }
  - { metric: INP, budget: 200, measured: 260, unit: ms }
  - { metric: CLS, budget: 0.1, measured: 0.04 }
  - { metric: JS transferred, budget: 300, measured: 285, unit: KB }
  - { metric: Lighthouse perf, budget: 90, measured: 84, lowerIsBetter: false }
```

### Latency percentiles

The tail per endpoint on one axis, with the SLO drawn.

```percentiles
title: Checkout API latency — last 7 days
unit: ms
slo: 300
rows:
  - { label: POST /checkout, p50: 120, p90: 210, p95: 260, p99: 420, max: 1900 }
  - { label: GET /cart, p50: 18, p90: 35, p95: 48, p99: 90, max: 410 }
  - { label: POST /payments, p50: 240, p90: 380, p95: 470, p99: 900, max: 3100, accent: red }
```

### Threat model

STRIDE over a data flow with trust boundaries and the mitigations in a table.

```threatmodel
title: Login — STRIDE
boundaries:
  - { id: inet, col: 1, row: 1, cols: 1, rows: 1, label: Internet }
  - { id: dmz, col: 2, row: 1, cols: 2, rows: 1, label: Trusted network }
nodes:
  - { id: browser, col: 1, row: 1, name: Browser, kind: external }
  - { id: auth, col: 2, row: 1, name: Auth service }
  - { id: users, col: 3, row: 1, name: Users DB, kind: store }
edges:
  - { from: browser, to: auth, label: "POST /login", channel: tls }
  - { from: auth, to: users, label: SELECT by email, channel: internal }
threats:
  - { id: T1, target: browser, category: S, threat: Credential stuffing, mitigation: Rate limit + breached-password check, severity: high, status: mitigated }
  - { id: T2, target: auth, category: I, threat: Verbose error reveals whether the email exists, mitigation: One generic message, severity: medium, status: open }
  - { id: T3, target: users, category: T, threat: Password hash column altered by an admin, mitigation: Audit log + Argon2id, severity: high, status: accepted }
```

### Use cases

Who uses the system for what, and which cases include or extend others.

```usecase
system: Ticketing
actors:
  - { id: cust, name: Customer }
  - { id: agent, name: Support agent }
  - { id: pay, name: Payment gateway, kind: system, side: right }
cases:
  - { id: buy, name: Buy ticket }
  - { id: pay1, name: Pay by card }
  - { id: refund, name: Request refund }
  - { id: approve, name: Approve refund }
links:
  - cust -> buy
  - cust -> refund
  - agent -> approve
  - pay -> pay1
relations:
  - { from: buy, to: pay1, kind: include }
  - { from: refund, to: approve, kind: extend }
```

### Package diagram

Which module may depend on which.

```pkg
title: Backend module layout
packages:
  - { id: api, col: 1, row: 1, name: api, contains: [routes, middleware] }
  - { id: domain, col: 2, row: 1, name: domain, contains: [orders, payments, inventory] }
  - { id: infra, col: 3, row: 1, name: infra, contains: [postgres, kafka, stripe] }
  - { id: shared, col: 2, row: 2, name: shared, contains: [ids, money, clock] }
deps:
  - { from: api, to: domain, kind: use }
  - { from: domain, to: infra, kind: import, label: ports only }
  - { from: domain, to: shared }
  - { from: infra, to: shared }
```

### Timing diagram

Two lifelines stepping through states over the same sixty seconds.

```timing
title: Circuit breaker under a downstream outage
unit: s
lanes:
  - label: Breaker
    states:
      - { state: closed, from: 0, to: 12 }
      - { state: open, from: 12, to: 42, accent: red }
      - { state: half-open, from: 42, to: 46, accent: amber }
      - { state: closed, from: 46, to: 60 }
  - label: Downstream
    states:
      - { state: healthy, from: 0, to: 10 }
      - { state: down, from: 10, to: 44, accent: red }
      - { state: healthy, from: 44, to: 60 }
events:
  - { at: 12, label: 5 failures in 10 s }
  - { at: 46, label: probe ok }
constraints:
  - { from: 12, to: 42, label: open 30 s }
```

### Neural network

The shape of a model, one column per layer.

```neuralnet
title: Digit classifier
params: 1.2M
layers:
  - { label: Input, units: 784, kind: input, note: 28×28 pixels }
  - { label: Conv 3×3, units: 32, kind: conv, activation: ReLU }
  - { label: Max pool, units: 32, kind: pool }
  - { label: Dense, units: 128, kind: dense, activation: ReLU }
  - { label: Dropout 0.3, units: 128, kind: dropout }
  - { label: Output, units: 10, kind: output, activation: softmax }
```

### Model card

The handoff card for a deployed model.

```modelcard
name: support-intent-v3
version: 3.2.0
task: Text classification (support ticket intent)
architecture: DistilBERT fine-tune, 6 layers
params: 66M
owner: ML platform
license: Internal
intendedUse:
  - Route inbound tickets to one of 14 queues
  - Suggest a queue to an agent; never auto-close
outOfScope:
  - Any language other than English and Spanish
trainingData:
  - 410k tickets, 2024-01 to 2025-06, PII scrubbed
metrics:
  - { name: Macro F1, value: 0.91, split: test }
  - { name: Latency p95, value: 38 ms, split: prod, note: CPU, batch 1 }
limitations:
  - Confuses billing and refund intents on short tickets
```

### Mind map

Unordered ideas around one centre.

```mindmap
center: Onboarding v2
nodes:
  - { id: acct, label: Account, accent: blue }
  - { id: sso, parent: acct, label: SSO first }
  - { id: invite, parent: acct, label: Team invites }
  - { id: data, label: Data import, accent: teal }
  - { id: csv, parent: data, label: CSV }
  - { id: api, parent: data, label: API sync }
  - { id: learn, label: Learning, accent: amber }
  - { id: tour, parent: learn, label: Product tour }
  - { id: tmpl, parent: learn, label: Templates }
```

### Process chevrons

The phases of a process and where we are.

```chevrons
title: Incident lifecycle
current: 3
steps:
  - { label: Detect, desc: alert fires }
  - { label: Triage, desc: severity + owner }
  - { label: Mitigate, desc: stop the bleeding }
  - { label: Resolve, desc: root cause fixed }
  - { label: Review, desc: postmortem in 5 days }
```

### Roadmap

Themes by quarter with a now rule.

```roadmap
title: Platform roadmap 2026
periods: [Q1, Q2, Q3, Q4]
now: Q3
themes: [Reliability, Developer experience, Cost]
items:
  - { label: Multi-region Postgres, theme: Reliability, from: Q1, to: Q2, status: done }
  - { label: Chaos game days, theme: Reliability, from: Q3, status: current }
  - { label: Preview envs per PR, theme: Developer experience, from: Q2, to: Q3, status: current }
  - { label: Golden-path templates, theme: Developer experience, from: Q4, status: next }
  - { label: Spot instances for batch, theme: Cost, from: Q2, status: done }
  - { label: Egress cut 30%, theme: Cost, from: Q3, to: Q4, status: risk }
```

## Older spellings still work

Twelve old block types merged into canonical blocks; their fence tags remain
permanent aliases. They parse, validate, and render as before — `chiltepin check`
notes the mapping with a `W_ALIAS_TYPE` warning. The four fences below use the
old spellings on purpose:

```waterfall
title: "The old waterfall tag — now chart (kind: waterfall)"
unit: ms
items:
  - { label: Gateway, value: 20 }
  - { label: Service, value: 90 }
  - { label: Database, value: 70 }
```

```infra
title: "The old infra tag — now block (preset: infra)"
nodes:
  - { id: cdn, col: 1, row: 1, kind: cdn, name: CDN }
  - { id: api, col: 2, row: 1, kind: compute, name: Storefront API }
  - { id: db, col: 3, row: 1, kind: db, name: orders-db }
edges:
  - cdn -> api
  - api -> db
```

```dag
title: "The old dag tag — now flow (variant: dag)"
nodes:
  - { id: build, col: 1, row: 1, kind: start, label: Build }
  - { id: test, col: 2, row: 1, kind: process, label: Test }
  - { id: ship, col: 3, row: 1, kind: end, label: Ship }
edges:
  - build -> test
  - test -> ship
```

```tracker
title: "The old tracker tag — now statustable (variant: tracker)"
items:
  - { task: Adopt the canonical spellings, status: doing, priority: med }
  - { task: Rewrite old fences, status: todo, priority: low, owner: nobody — they keep working }
```
