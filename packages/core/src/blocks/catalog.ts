/**
 * The block catalog — per-block starter templates, one-line descriptions, and
 * the 12-way family grouping. Pure data (compile-time exhaustive
 * `Record<BlockType, …>` maps), shared by the CLI (`chiltepin new`, `chiltepin block`,
 * `chiltepin demo`) and any editing UI.
 */

import { BLOCK_TYPES, type BlockType } from '../types.js';

/** A ready-to-render fenced starter template per block type. */
export const BLOCK_TEMPLATES: Record<BlockType, string> = {
  meta: '```meta\ntitle: New document\nsubtitle: One-line description.\ntag: DESIGN DOC\nstatus: draft\nowners: [Platform team]\nupdated: 2026-10-21\n```\n',
  callout:
    '```callout\ntone: warn\ntitle: Replays past 48 hours bill twice\nbody: Replay only gaps younger than 48 hours. Older trips are already on an invoice.\n```\n',
  table:
    '```table\ncolumns:\n  - Endpoint\n  - { label: p95, type: num, unit: ms }\n  - { label: Cached, type: check }\nrows:\n  - ["`GET /orders/{id}`", 38, yes]\n  - ["`POST /captures`", 120, no]\n  - ["`GET /orders`", 1240, partial]\nnote: Cached means the CDN layer answers; p95 is measured client side.\n```\n',
  sequence:
    '```sequence\nid: seq-place-order\nactors:\n  - { id: web, name: checkout-web }\n  - { id: api, name: orders-api }\nmessages:\n  - web -> +api: POST /orders\n  - alt: stock reserved\n  - api --> web: 201 Created\n  - else: out of stock\n  - api --> -web: 409 Conflict\n  - end\n```\n',
  erd:
    '```erd\nid: erd-example\nentities:\n  - name: users\n    columns:\n      - { name: id, type: uuid, pk: true }\n  - name: orders\n    columns:\n      - { name: id, type: uuid, pk: true }\n      - { name: user_id, type: uuid, fk: true }\nrelations:\n  - users ||--o{ orders: places\n```\n',
  userstory:
    '```userstory\nid: US-142\nrole: returning shopper\nwant: save a card at checkout\nsoThat: I skip card entry on my next order\ncriteria:\n  - { given: a saved card, when: I check out, then: the card is preselected }\n```\n',
  timeline:
    '```timeline\nitems:\n  - "[done] 2026-08 · Dual write · Both stores take every order"\n  - "[current] 2026-09 · Backfill · 480M rows copy in batches"\n  - "[next] 2026-10 · Read new · Reads switch behind the flag"\n```\n',
  kanban:
    '```kanban\ncolumns:\n  - label: Now\n    cards:\n      - { title: Rate-limit POST /refunds }\n  - label: Next\n    cards:\n      - { title: Mask card BINs in worker logs }\n  - label: Later\n    cards:\n      - { title: Multi-region failover drill }\n```\n',
  prose:
    '```prose\ntitle: Why refunds are async\nblocks:\n  - { type: h, text: The constraint }\n  - { type: p, text: The acquirer confirms a refund within 48 hours. }\n  - { type: ul, items: [The API returns 202 at once, A webhook reports the result, Support sees the state in the console] }\n```\n',
  glossary:
    '```glossary\nterms:\n  - { term: Idempotency, def: Doing a thing twice has the same effect as doing it once. }\n  - { term: SLO, def: Service-level objective the team commits to. }\n```\n',
  proscons:
    '```proscons\ntitle: Synchronous vs async\nprosLabel: Synchronous\nconsLabel: Asynchronous\npros:\n  - Easy to reason about\n  - One transaction\ncons:\n  - Latency-bound\n  - Single point of failure\n```\n',
  cvt:
    '```cvt\ntitle: Migration plan\ncurrent:\n  label: Today\n  items: [Single monolith, Shared database, Manual deploys]\ntarget:\n  label: Target\n  items: [Modular services, Per-service stores, Automated deploys]\nnote: Migrate one service per quarter.\n```\n',
  stats:
    '```stats\ntitle: This quarter\nstats:\n  - { value: 12.4k, label: Active users, delta: "+18%", better: up }\n  - { value: 99.95%, label: Uptime, delta: "0", better: up }\n  - { value: 142ms, label: p95 latency, delta: "-22ms", better: down }\n```\n',
  code:
    '```code\ncols: 2\nlines: true\nblocks:\n  - title: add.ts\n    lang: TypeScript\n    highlight: "2"\n    code: |\n      export function add(a: number, b: number): number {\n        return a + b;\n      }\n  - title: add.test.ts\n    code: expect(add(2, 2)).toBe(4);\n```\n',
  agenda:
    '```agenda\nitems:\n  - { time: "09:00", duration: 30m, title: Intros, owner: Host }\n  - { time: "09:30", duration: 45m, title: Status updates, desc: Each team for 5 min }\n  - { time: "10:15", duration: 15m, title: Wrap-up }\n```\n',
  tree:
    '```tree\nnodes:\n  - { id: src, label: src }\n  - { id: components, parent: src, label: components }\n  - { id: hooks, parent: src, label: hooks }\n  - { id: index, parent: src, label: index.ts, note: entry point }\n```\n',
  pyramid:
    '```pyramid\nlevels:\n  - { label: Vision, desc: Long-term direction }\n  - { label: Strategy, desc: How we get there }\n  - { label: Tactics, desc: This quarter }\n  - { label: Tasks, desc: This week }\n```\n',
  flow:
    '```flow\ntitle: Refund approval in the support console\nnodes:\n  - { id: req, kind: start, label: Refund requested }\n  - { id: amt, kind: decision, label: Under $400? }\n  - { id: clerk, kind: human, label: Billing clerk reviews }\n  - { id: issue, kind: process, label: Issue refund }\n  - { id: paid, kind: end, label: Refund paid }\n  - { id: denied, kind: end, label: Refund denied }\nedges:\n  - req -> amt\n  - amt -> issue: "yes"\n  - amt -> clerk: "no"\n  - clerk -> issue: approves\n  - clerk -x-> denied: rejects\n  - issue -> paid\n```\n',
  state:
    '```state\ntitle: Order lifecycle\nstates:\n  - { id: s0, col: 1, row: 1, kind: start }\n  - { id: pending, col: 2, row: 1, kind: wait, name: PENDING }\n  - { id: confirmed, col: 3, row: 1, kind: active, name: CONFIRMED }\n  - { id: end, col: 4, row: 1, kind: terminal }\ntransitions:\n  - { from: s0, to: pending, event: create }\n  - { from: pending, to: confirmed, event: pay }\n  - { from: confirmed, to: end, event: ship }\n```\n',
  dfd:
    '```dfd\ntitle: Order intake data flow\nnodes:\n  - { id: shop, kind: external, name: Storefront }\n  - { id: val, kind: process, name: Validate order, num: 1 }\n  - { id: store, kind: store, name: orders-db }\nedges:\n  - { from: shop, to: val, label: order form }\n  - { from: val, to: store, label: valid order }\n```\n',
  journey:
    '```journey\ntitle: Onboarding journey\nstages:\n  - { label: Discover }\n  - { label: Sign up }\n  - { label: Activate }\n  - { label: Pay }\nrows:\n  - { label: Touchpoint, cells: [Landing, Form, Email, Checkout] }\n  - { label: Friction, cells: [Low, Med, Low, Med] }\nemotion: [0.7, 0.4, 0.6, 0.8]\n```\n',
  gantt:
    '```gantt\ntitle: Orders store migration\nperiods: [Q1, Q2, Q3, Q4]\ntasks:\n  - { label: Schema design, start: 0, span: 1, kind: done }\n  - { label: Dual write and backfill, start: 1, span: 2, kind: active }\n  - { label: Read cutover, start: 3, span: 1 }\n  - { label: Old table dropped, start: 3, span: 1, kind: milestone }\n```\n',
  graph:
    '```graph\ntitle: Dijkstra from the depot — after two visits\nnodes:\n  - { id: depot, col: 1, row: 1, label: Depot, state: visited }\n  - { id: north, col: 2, row: 1, label: North hub, state: visited }\n  - { id: south, col: 2, row: 2, label: South hub, state: frontier }\n  - { id: port, col: 3, row: 1, label: Port, state: frontier }\nedges:\n  - { from: depot, to: north, weight: 4 }\n  - { from: depot, to: south, weight: 6 }\n  - { from: north, to: port, weight: 5 }\n  - { from: south, to: port, weight: 2, dir: undirected }\n```\n',
  quadrant:
    '```quadrant\ntitle: Effort vs impact\nxAxis: { label: Effort, low: Low, high: High }\nyAxis: { label: Impact, low: Low, high: High }\nitems:\n  - { x: 0.2, y: 0.8, label: Cache product pages }\n  - { x: 0.8, y: 0.8, label: Rewrite search }\n  - { x: 0.2, y: 0.2, label: Rename settings tabs }\n  - { x: 0.8, y: 0.2, label: Port legacy reports }\n```\n',
  swimlane:
    '```swimlane\ntitle: Refund handoffs\nlanes: [Customer, Support, Finance]\nphases:\n  - { label: Intake, from: 1, to: 2 }\n  - { label: Payout, from: 3 }\nsteps:\n  - req: Request refund · Customer · start\n  - { id: check, lane: Support, kind: decision, label: Order eligible?, phase: Intake }\n  - { id: pay, lane: Finance, label: Issue refund, note: within 2 days, accent: true, phase: Payout }\n  - done: Receive refund · Customer · end\nlinks:\n  - req -> check\n  - check -> pay: eligible\n  - pay --> done: notifies\n```\n',
  c4:
    '```c4\ntitle: Checkout containers\nlevel: container\nboundary: { label: Checkout platform }\nnodes:\n  - { id: user, kind: person, name: Shopper, desc: Buys from the web store. }\n  - { id: web, kind: container, family: web, name: Web store, tech: Next.js, desc: Shows the cart and takes the order. }\n  - { id: api, kind: container, name: Orders API, tech: Go, desc: Prices and confirms orders. }\n  - { id: db, kind: store, name: Orders DB, tech: Postgres, desc: Orders and payment state. }\n  - { id: pay, kind: external, name: Card acquirer, desc: Authorises card payments. }\nedges:\n  - { from: user, to: web, label: Places orders using, tech: HTTPS }\n  - { from: web, to: api, label: Submits orders to, tech: JSON/HTTPS }\n  - { from: api, to: db, label: Reads from and writes to, tech: SQL }\n  - { from: api, to: pay, label: Authorises payments with, tech: HTTPS }\n```\n',
  uml:
    '```uml\ntitle: Class model\nclasses:\n  - { id: order, col: 1, row: 1, name: Order, attrs: ["id: UUID", "status: Status", "total: Money"], methods: ["place()", "cancel()"] }\n  - { id: item, col: 2, row: 1, name: OrderItem, attrs: ["id: UUID", "sku: String", "qty: int"] }\n  - { id: status, col: 1, row: 2, name: Status, stereotype: enumeration, attrs: ["PENDING", "CONFIRMED", "CANCELLED"] }\nrels:\n  - { from: order, to: item, kind: composition }\n  - { from: order, to: status, kind: association, label: has }\n```\n',
  frontend:
    '```frontend\ntitle: React component tree\nnodes:\n  - { id: app, kind: root, name: App }\n  - { id: layout, parent: app, kind: layout, name: Layout }\n  - { id: home, parent: layout, kind: page, name: Home }\n  - { id: orders, parent: layout, kind: page, name: Orders }\n  - { id: card, parent: orders, kind: component, name: OrderCard }\n  - { id: useOrder, parent: orders, kind: hook, name: useOrder }\n  - { id: store, parent: app, kind: store, name: cart, note: Zustand }\n```\n',
  cluster:
    '```cluster\ntitle: Production cluster\nclusters:\n  - { id: api, label: api namespace, kind: namespace }\n  - { id: data, label: data namespace, kind: namespace }\nservices:\n  - { id: web, cluster: api, label: web, kind: service, tech: Next.js, replicas: 3 }\n  - { id: orders, cluster: api, label: orders, kind: service, tech: Go, replicas: 4 }\n  - { id: pg, cluster: data, label: postgres, kind: store, tech: Postgres 16, replicas: 1 }\n  - { id: redis, cluster: data, label: redis, kind: cache, tech: Redis 7, replicas: 2 }\nedges:\n  - { from: web, to: orders }\n  - { from: orders, to: pg }\n  - { from: orders, to: redis }\n```\n',
  block:
    '```block\ntitle: Placing an order, step by step\ngroups:\n  - { col: 1, row: 1, cols: 1, rows: 2, label: Edge }\n  - { col: 2, row: 1, cols: 2, rows: 2, label: orders VPC }\nnodes:\n  - { id: cdn, col: 1, row: 1, kind: cdn, name: storefront CDN, tech: Cloudflare }\n  - { id: gw, col: 1, row: 2, kind: gateway, name: api-gateway, tech: Envoy }\n  - { id: api, col: 2, row: 1, kind: service, name: orders-api, tech: Go, replicas: 3 }\n  - { id: worker, col: 3, row: 1, kind: worker, name: fulfilment-worker, tech: Go }\n  - { id: pg, col: 2, row: 2, kind: db, name: orders-db, tech: Postgres 16 }\n  - { id: q, col: 3, row: 2, kind: queue, name: order-events, tech: NATS }\nedges:\n  - 1. cdn -> gw: forwards /api\n  - 2. gw -> api: routes POST /orders\n  - 3. api -> pg: writes order\n  - 4. api --> q: publishes order.placed\n  - 5. q --> worker: delivers order.placed\n```\n',
  felogic:
    '```felogic\ntitle: Frontend modules\nnodes:\n  - { id: hook, col: 1, row: 1, kind: hook, name: useOrders }\n  - { id: svc, col: 2, row: 1, kind: service, name: ordersService }\n  - { id: iface, col: 3, row: 1, kind: interface, name: OrdersClient }\n  - { id: impl, col: 4, row: 1, kind: strategy, name: HttpOrdersClient }\n  - { id: api, col: 5, row: 1, kind: external, name: Orders API }\nedges:\n  - { from: hook, to: svc }\n  - { from: svc, to: iface, kind: uses }\n  - { from: impl, to: iface, kind: implements }\n  - { from: impl, to: api, kind: egress, label: HTTPS }\n```\n',
  wireframe:
    '```wireframe\ntitle: What the user sees\nscreens:\n  - device: browser\n    title: Dashboard\n    url: app.example.com\n    label: Desktop\n    elements:\n      - { type: nav, label: "Home, Inbox, Settings" }\n      - { type: header, label: Notifications }\n      - { type: list, rows: 4 }\n      - { type: button, label: Mark all as read }\n  - device: phone\n    title: "9:41"\n    label: iPhone\n    elements:\n      - { type: header, label: Alerts }\n      - { type: card, rows: 3 }\n      - { type: tabs, label: "Home, Search, Bell, You" }\n```\n',
  endpoint:
    '```endpoint\nmethod: POST\npath: /orders\ntitle: Create an order\ndescription: Submit a cart and create a new order.\nauth: Bearer token\nparams:\n  - { name: idempotency-key, in: header, type: string, desc: Safe-retry key }\nbody:\n  - { name: items, type: "Item[]", required: true, desc: Line items }\n  - { name: coupon, type: string, desc: Optional discount code }\nresponses:\n  - { status: 201, desc: Order created }\n  - { status: 400, desc: Invalid cart }\n  - { status: 401, desc: Missing or invalid token }\nrequest: |\n  { "items": [{ "sku": "A1", "qty": 2 }] }\nresponse: |\n  { "id": "ord_123", "status": "pending" }\n```\n',
  pullquote:
    '```pullquote\ntext: We never hold a balance that we cannot rebuild from the journal.\nattribution: Payments Core, design review\n```\n',
  layers:
    '```layers\ntitle: The model in three layers\nitems:\n  - { kicker: L1, title: Identity, source: JWT, question: "Are you signed in?", body: Validate the token and resolve the user. }\n  - { kicker: L2, title: Scope, source: Lookup, question: "Which sites?", body: Confirm the request is in range. }\n  - { kicker: L3, title: Permission, source: App DB, question: "May you do this?", body: Check the action against the matrix. }\n```\n',
  matrix:
    '```matrix\ntitle: Who can do what\ncorner: Role / App\ncols: [Billing, Reports, Admin]\nrows:\n  - { label: Owner, cells: [Full, Full, Full] }\n  - { label: Manager, cells: [Full, Read, "—"] }\n  - { label: Viewer, cells: [Read, Read, "—"] }\n```\n',
  anatomy:
    '```anatomy\ntitle: Anatomy of a permission\nseparator: ":"\nparts:\n  - { label: App, value: meridian, note: Which product. }\n  - { label: Feature, value: billing, note: The area within the app. }\n  - { label: Action, value: invoices.read, note: The specific capability. }\n```\n',
  composition:
    '```composition\ntitle: How access is decided\nresult: May read invoices\ngates:\n  - { label: Identity, desc: A valid signed-in user. }\n  - { label: Scope, desc: The request is in range. }\n  - { label: Permission, desc: The action is granted. }\n```\n',
  drivers:
    '```drivers\ntitle: What shaped the design\nitems:\n  - { title: Single sign-on, body: One login carries the user everywhere., tag: "HOW: token", icon: lock }\n  - { title: Read per site, body: Access is scoped to the sites a user belongs to., tag: "WHERE: site group", icon: location }\n  - { title: Governed roles, body: "An external IGA requests, approves, and certifies access.", tag: "WHO: role groups", icon: shield }\n  - { title: Per-app permissions, body: The same role does different things in each app., tag: "WHAT: matrix", icon: grid }\n```\n',
  options:
    '```options\ntitle: Approaches explored\nitems:\n  - { kicker: Option 1, title: App-managed roles, how: Roles live in our own DB; SSO only handles sign-in., pros: [Full control], cons: [Second source of truth, Custom tooling to govern], verdict: "REJECTED — fails the constraint", tone: rejected }\n  - { kicker: Option 2, title: Global role groups, how: Site groups for read; one global group per role., pros: [Fewest groups, Scales linearly], cons: ["A role applies at every site"], verdict: "VIABLE — kept as fallback", tone: viable }\n  - { kicker: Option 3, title: Per-site role groups, how: One group per persona per site., pros: [Least privilege by construction, Clean per-site audit], cons: [Most groups to manage], verdict: "CHOSEN — matches the constraints", tone: chosen }\n```\n',
  spec:
    '```spec\ntitle: Per-site role groups\nrows:\n  - { label: Groups, value: "SiteN-Users (read) + SiteN-<Persona> per staffed plant." }\n  - { label: Roles, value: "Each group reads as (site, role); the token carries the full scope." }\n  - { label: Resolution, steps: [Decode token, "Read (site, role)", Check matrix] }\n  - { label: Cost, value: "Up to Sites x Roles groups; adding a role multiplies them." }\n```\n',
  list:
    '```list\ntitle: What the outbox guarantees\nstyle: accent\nitems:\n  - { lead: No lost events, text: "The event row commits in the same transaction as the order." }\n  - { lead: At-least-once delivery, text: "The relay retries until Kafka acknowledges the event." }\n  - { lead: Order per order_id, text: "The relay publishes rows in commit order for each order_id." }\n```\n',
  stories:
    '```stories\ntitle: Backlog\nitems:\n  - { id: US-1, title: One-step checkout, role: shopper, want: pay for my cart in one step, soThat: I finish faster, priority: High, points: 5, open: true, criteria: [{ given: I have items, when: I submit valid payment, then: an order is created }] }\n  - { id: US-2, title: Save payment method, role: returning shopper, want: store a card, soThat: I skip re-entry, priority: Med, points: 3 }\n```\n',
  pattern:
    '```pattern\nname: Repository\ncategory: Backend\nintent: Hide persistence behind a collection-like interface so the domain never sees the database.\nforces: [Swap the data store, Unit-test without a DB, No query leaks into the domain]\nparticipants:\n  - { name: OrderRepository, role: interface the service depends on }\n  - { name: PgOrderRepository, role: Postgres implementation }\n  - { name: OrderService, role: caller (domain logic) }\nconsequences:\n  pros: [Swappable storage, Testable with a fake, Clear seam]\n  cons: [Another layer, Risk of anemic pass-through methods]\n```\n',
  gallery:
    '```gallery\ntitle: Bug gallery\ncols: 2\ndescription: A grid of code snippets — great for a comparison or a "spot the bug" set.\nitems:\n  - title: "N+1 query"\n    lang: JavaScript\n    caption: "1000 users = 1001 queries. Fix: JOIN or batch."\n    code: |\n      users.forEach(async u => {\n        await db.query("SELECT * FROM orders WHERE user_id=?", u.id);\n      });\n  - title: "Off-by-one"\n    lang: JavaScript\n    caption: "arr[arr.length] is undefined. Fix: < not <=."\n    code: |\n      for (let i = 0; i <= arr.length; i++)\n        process(arr[i]);\n  - title: "Secrets in code"\n    lang: JavaScript\n    caption: "Committed to the repo. Fix: env vars + a scanner."\n    code: |\n      const API_KEY = "sk-live-abc123";\n```\n',
  chart:
    '```chart\ntitle: p95 latency by week\nkind: line\nunit: ms\nlabels: [W1, W2, W3, W4]\nseries:\n  - { label: /orders, values: [240, 220, 185, 150] }\n  - { label: /search, values: [310, 285, 260, 230] }\n```\n',
  figure:
    '```figure\nsrc: https://example.com/architecture.png\nalt: The deployment topology\ncaption: "The production topology: CDN, gateway, and two service tiers."\nwidth: 560\n```\n',
  steps:
    '```steps\ntitle: Deploy a hotfix\nitems:\n  - title: Branch from main\n    body: Hotfixes always branch from the latest main.\n    code: git checkout -b hotfix/fix-retry main\n    lang: bash\n  - title: Ship the fix\n    body: Commit and push; CI runs the full suite.\n    code: git push -u origin hotfix/fix-retry\n    lang: bash\n    note: CI must be green before the next step.\n  - title: Tag and deploy\n    code: git tag v1.4.1 && git push --tags\n    lang: bash\n```\n',
  faq:
    '```faq\ntitle: Open before launch\nitems:\n  - q: Who sets the 0.85 decline threshold?\n    a: "The fraud risk lead, after the shadow run ends on 4 Nov."\n    open: true\n  - q: Do we keep the rules-only fallback after launch?\n    a: "Platform decides once the model meets its 40 ms deadline at p99 for a week."\n  - q: Who owns the review queue at night?\n    a: Not decided. The support lead answers by 28 Oct.\n```\n',
  envelope:
    '```envelope\ntitle: Write-path capacity\nassumptions:\n  - { label: Daily active users, value: 5M }\n  - { label: Writes / user / day, value: "4" }\nsteps:\n  - { label: Writes per day, calc: "5M × 4", result: 20M/day }\n  - { label: Write QPS, calc: "20M / 86,400 s", result: "≈ 230 rps" }\n  - { label: Peak QPS, calc: "230 × 3 (peak factor)", result: "≈ 700 rps" }\nresult: { label: Provision for, value: "~1,400 rps (2× peak headroom)" }\n```\n',
  slo:
    '```slo\ntitle: Orders API — objectives\nitems:\n  - { name: Availability, sli: Successful requests / total requests, target: 99.9%, current: 99.97%, window: 30d, budget: 0.25 }\n  - { name: Latency, sli: Requests served under 400 ms (p99), target: 99%, current: 98.9%, window: 30d, budget: 0.7 }\n```\n',
  swot:
    '```swot\ntitle: Entering the enterprise segment\nstrengths:\n  - Fastest onboarding in the category\n  - Strong developer community\nweaknesses:\n  - No SSO / SCIM yet\n  - Small support team\nopportunities:\n  - Competitor sunsetting its legacy plan\n  - Compliance push creates demand\nthreats:\n  - Incumbent bundling a free tier\n  - Procurement cycles slow adoption\n```\n',
  okr:
    '```okr\ntitle: Q3 objectives\nitems:\n  - objective: Make onboarding effortless\n    owner: Growth\n    krs:\n      - { kr: Time-to-first-doc under 5 minutes, progress: 0.7, status: on-track }\n      - { kr: Activation rate from 45% to 60%, progress: 0.4, status: at-risk }\n  - objective: Earn enterprise trust\n    owner: Platform\n    krs:\n      - { kr: Ship SSO + audit log, progress: 1, status: done }\n      - { kr: SOC 2 Type II report issued, progress: 0.2, status: off-track }\n```\n',
  persona:
    '```persona\ntitle: Who we build for\npersonas:\n  - name: Maya Chen\n    role: Staff engineer\n    quote: I want the diagram in the PR diff, not in a wiki.\n    goals: [Docs that live with the code, Reviewable architecture changes]\n    frustrations: [Stale wiki pages, Screenshots of whiteboards]\n    tools: [VS Code, GitHub]\n  - name: Priya Patel\n    role: Engineering manager\n    quote: Every reorg breaks our onboarding docs.\n    goals: [One source of truth per system]\n    frustrations: ["Docs no one owns"]\n    tools: [Linear, Notion]\n```\n',
  changelog:
    '```changelog\ntitle: Release history\nreleases:\n  - version: 2.0.0\n    date: 2026-06-24\n    tag: breaking\n    items:\n      - { type: changed, text: "Config moved from .rc to chiltepin.config.json" }\n      - { type: removed, text: Dropped Node 18 support }\n  - version: 1.4.0\n    date: 2026-05-12\n    tag: minor\n    items:\n      - { type: added, text: Dark theme }\n      - { type: fixed, text: Slide overflow on long tables }\n```\n',
  team:
    '```team\ntitle: Who owns what\nmembers:\n  - { name: Ana Ruiz, role: Tech lead, focus: Rendering pipeline }\n  - { name: Sam Okafor, role: Backend, focus: Sync + integrations }\n  - { name: Lena Fischer, role: Design, focus: Themes and house style }\n```\n',
  heatmap:
    '```heatmap\ntitle: p95 latency by region\nunit: ms\nxLabels: ["00", "06", "12", "18"]\nrows:\n  - { label: us-east-1, values: [120, 135, 210, 265] }\n  - { label: eu-west-1, values: [110, 150, 240, 190] }\n  - { label: ap-south-1, values: [180, 220, 310, 280] }\n```\n',
  scorecard:
    '```scorecard\ntitle: Queue technology choice\ncriteria:\n  - { label: Throughput, weight: 2 }\n  - { label: Operational cost }\n  - { label: Team familiarity }\noptions:\n  - { label: Kafka, scores: [5, 2, 3], note: self-hosted }\n  - { label: SQS, scores: [3, 5, 4], note: managed }\n```\n',
  risk:
    '```risk\ntitle: Launch risks\nitems:\n  - { risk: Traffic spike overwhelms the API, likelihood: med, impact: high, mitigation: Autoscaling + load-shedding at the gateway., owner: Platform, status: mitigating }\n  - { risk: Data migration misses edge cases, likelihood: low, impact: high, mitigation: Dry-run against a prod snapshot., owner: Data, status: open }\n  - { risk: Docs lag the release, likelihood: med, impact: low, status: accepted }\n```\n',
  palette:
    '```palette\ntitle: Brand palette\ncols: 4\ncolors:\n  - { name: Primary, value: "#0E54A1", usage: Buttons and links }\n  - { name: Ink, value: "#1F2937", usage: Body text }\n  - { name: Surface, value: "#F6F8FB", usage: Card backgrounds }\n  - { name: Positive, value: "#1F9747", usage: Success states }\n```\n',
  typescale:
    '```typescale\ntitle: Type scale\nitems:\n  - { name: Display, size: 40, weight: 700, font: display }\n  - { name: Body, size: 15, lineHeight: 1.6 }\n  - { name: Caption, size: 12, weight: 500, note: secondary text }\n  - { name: Code, size: 13, font: mono }\n```\n',
  dodont:
    '```dodont\ntitle: Button usage\ndos:\n  - { text: Use one primary button per view }\n  - { text: Write labels as verbs, example: "Save changes" }\ndonts:\n  - { text: Stack two primary buttons side by side }\n  - { text: Disable a button without explaining why, example: "tooltip: Add a line item first" }\n```\n',
  inventory:
    '```inventory\ntitle: Component status\nitems:\n  - { name: Button, status: stable, tag: v2 }\n  - { name: Data table, status: beta, note: API may change before GA }\n  - { name: Date picker, status: experimental }\n  - { name: Modal (legacy), status: deprecated, note: Use Dialog instead }\n  - { name: Charts, status: planned }\n```\n',
  array:
    '```array\ntitle: Binary search — step 2\nitems:\n  - { value: "3", tone: visited }\n  - { value: "7", tone: visited }\n  - { value: "12", label: lo }\n  - { value: "19", tone: active, label: mid }\n  - { value: "27", tone: target }\n  - { value: "41", label: hi }\nwindow: { from: 2, to: 5, label: search space }\n```\n',
  linkedlist:
    '```linkedlist\ntitle: Reversing a list — step 2\nnodes:\n  - { value: "9", tone: visited, label: prev }\n  - { value: "4", tone: active, label: curr }\n  - { value: "7", label: next }\n  - { value: "1" }\n```\n',
  bintree:
    '```bintree\ntitle: BST search for 27\nnodes:\n  - { id: root, value: "19", tone: visited }\n  - { id: l, value: "8", parent: root, side: left }\n  - { id: r, value: "31", parent: root, side: right, tone: active }\n  - { id: rl, value: "27", parent: r, side: left, tone: target }\n  - { id: rr, value: "40", parent: r, side: right }\n```\n',
  hashmap:
    '```hashmap\ntitle: Chained hash table\nbuckets: 5\nentries:\n  - { key: apple, value: "3", bucket: 0 }\n  - { key: plum, value: "9", bucket: 2, tone: active }\n  - { key: grape, value: "1", bucket: 2 }\n  - { key: fig, value: "7", bucket: 4, tone: muted }\n```\n',
  agentloop:
    '```agentloop\ntitle: Support triage agent\nagent:\n  name: Triage agent\n  model: claude-sonnet-4-6\n  note: Routes each ticket to a fix or a human.\nenv: Customer\ntools:\n  - { name: search_kb, desc: Search help-center articles }\n  - { name: get_account, desc: Look up plan and billing state }\n  - { name: create_ticket, desc: Escalate to a human queue }\nmemory:\n  - conversation history\n  - customer profile\nstop: reply sent or ticket escalated\n```\n',
  trace:
    '```trace\ntitle: Password reset — one episode\nturns:\n  - role: user\n    text: I never get the reset email.\n  - role: assistant\n    thinking: Could be a bounce — check delivery logs before blaming spam.\n    text: Let me check our email logs.\n  - role: tool\n    tool: email_logs.search\n    args: \'{ "to": "sam@example.com", "type": "password_reset" }\'\n    result: "1 result: bounced (mailbox full)"\n  - role: assistant\n    text: Your mailbox rejected the email — free up space and I will resend it.\n```\n',
  prompt:
    '```prompt\ntitle: Support reply template\nsegments:\n  - kind: system\n    label: role + guardrails\n    text: "You are a support agent for {{product}}. Answer from the docs only."\n  - kind: user\n    text: "Customer ({{plan}} plan) asks: {{question}}"\nvars:\n  - { name: product, desc: Product name from config }\n  - { name: plan, desc: Plan tier of the signed-in customer }\n  - { name: question, desc: The inbound message }\n```\n',
  context:
    '```context\ntitle: Where the window goes\nwindow: 200000\nsegments:\n  - { label: system prompt, tokens: 6000 }\n  - { label: tool schemas, tokens: 14000 }\n  - { label: retrieval, tokens: 60000 }\n  - { label: history, tokens: 70000 }\n```\n',
  archmap:
    '```archmap\ntitle: Target platform architecture\ncols: 3\nareas:\n  - label: Customer channels\n    items:\n      - Web storefront\n      - { name: Mobile app, status: target }\n  - label: Commerce\n    items:\n      - Catalog\n      - Checkout\n      - { name: Promotions, status: gap }\n  - label: Platform services\n    desc: Shared capabilities every domain builds on.\n    items:\n      - Identity\n      - { name: Event bus, status: new }\n      - { name: Legacy ESB, status: deprecated }\n```\n',
  divider:
    '```divider\nkicker: PART 2\ntitle: What we change\nsubtitle: The three fixes, in the order we ship them.\n```\n',
  bignumber:
    '```bignumber\nvalue: "-75%"\nlabel: Checkout p95 after moving capture off the request path\ncontext: "2.4s → 600ms, measured over four weeks of production traffic"\ndelta: "-1.8s"\ntrend: down\n```\n',
  takeaways:
    '```takeaways\ntitle: Takeaways\nitems:\n  - text: The synchronous capture call was the bottleneck\n    detail: It accounted for 71% of the 2.4s checkout p95.\n  - text: Moving it to a queue cut p95 by 75%\n  - text: Conversion recovered within two weeks\n    detail: "+0.4pp against the pre-regression baseline."\n```\n',
  statustable:
    '```statustable\ntitle: Workstream status\ncolumns: [Task, Update]\nstatuses:\n  - { label: in review, color: purple }\n  - { label: waiting on vendor, color: neutral }\n  - { label: shipped, color: success }\nrows:\n  - { cells: [Payment retries, Backoff logic merged; canary running since Monday], status: shipped }\n  - cells: [Vendor SSO, Contract countersigned; sandbox creds due this week]\n    status: waiting on vendor\n    subtasks:\n      - { cells: [SAML metadata exchange, Our metadata sent Tuesday], status: shipped }\n      - { cells: [Provisioning sync, Blocked on sandbox credentials], status: waiting on vendor }\n  - { cells: [Rate-limit rework, PR up for second review], status: in review }\n```\n',
  cycle:
    '```cycle\ntitle: Build–measure–learn\nsteps:\n  - { label: Build, desc: Ship the smallest testable change }\n  - { label: Measure, desc: Watch the one metric the change should move }\n  - { label: Learn, desc: Keep the change or roll it back }\ncenter: every release\n```\n',
  benchmark:
    '```benchmark\ntitle: Retrieval engines, measured\nmetricLabel: Benchmark\nsubjects:\n  - { label: Ours, sub: v2.1, featured: true }\n  - { label: Hosted vector DB }\n  - { label: BM25 baseline, tone: muted }\nrows:\n  - { label: Answer accuracy, sub: internal QA set, cells: ["82.4%", "79.1%", "74.8%"] }\n  - { label: p95 latency, sub: 500 rps soak, better: low, cells: ["310 ms", "420 ms", "290 ms"] }\n  - label: Cost per 1k queries\n    variants: [cached, cold]\n    better: low\n    cells:\n      - ["$0.14", "$0.90"]\n      - ["$0.21", "$1.10"]\n      - ["$0.18", "—"]\nnote: Single region, same corpus, October run.\n```\n',
  sankey:
    '```sankey\ntitle: Where the cloud bill goes\nunit: "k"\nlinks:\n  - { from: Bill, to: Compute, value: 62 }\n  - { from: Bill, to: Storage, value: 28 }\n  - { from: Bill, to: Network, value: 10 }\n  - { from: Compute, to: Batch, value: 24 }\n  - { from: Compute, to: Serving, value: 38 }\n```\n',
  gitgraph:
    '```gitgraph\ntitle: Release model\nbranches:\n  - { name: main }\n  - { name: feature }\ncommits:\n  - { label: baseline }\n  - { branch: feature, label: spike }\n  - { branch: feature, label: review fixes }\n  - { merge: feature, label: ship it, tag: v1.2.0, kind: release }\n```\n',
  treemap:
    '```treemap\ntitle: Cloud spend by service\nunit: k\nitems:\n  - { label: Compute, value: 62, desc: EC2 + Lambda }\n  - { label: Storage, value: 28 }\n  - { label: Network, value: 10 }\n  - { label: Observability, value: 7, accent: amber }\n```\n',
  packet:
    '```packet\ntitle: Request header\nwidth: 32\nfields:\n  - { label: Version, bits: 4, value: "1" }\n  - { label: Flags, bits: 4 }\n  - { label: Length, bits: 24 }\n  - { label: Request id, bits: 32, accent: teal }\n```\n',
  venn:
    '```venn\ntitle: Who owns what\nsets:\n  - { label: Platform, desc: runtime and CI }\n  - { label: Product, desc: features }\nshared:\n  - { sets: [Platform, Product], label: Release process }\n```\n',
  wardley:
    '```wardley\ntitle: Where to build\ncomponents:\n  - { id: user, label: Analyst, x: 0.75, y: 0.96, kind: user }\n  - { id: reports, label: Reporting, x: 0.45, y: 0.7 }\n  - { id: store, label: Warehouse, x: 0.82, y: 0.35, kind: commodity }\nlinks:\n  - { from: user, to: reports }\n  - { from: reports, to: store }\n```\n',
  harvey:
    '```harvey\ntitle: Vendor fit\ncolumns: [Kafka, SQS, RabbitMQ]\nscale: [poor, excellent]\nrows:\n  - { label: Throughput, ratings: [4, 2, 3], weight: 2 }\n  - { label: Ops burden, ratings: [1, 4, 3] }\n  - { label: Team familiarity, ratings: [2, 4, 3] }\nrecommend: SQS\n```\n',
  scqa:
    '```scqa\nsituation: We process 12k orders a day across three regions.\ncomplication: p95 checkout crossed 2s in March and conversion fell 3.1pp.\nquestion: Where does the next quarter of platform work go?\nanswer: Move payment capture off the request path — it returns 1.8s of the 2.4s.\nbecause:\n  - Capture is 74% of p95 and is fully async-able\n  - No schema change, so it ships in one quarter\n```\n',
  scenarios:
    '```scenarios\ntitle: Three ways next year goes\ndrivers: [Volume growth, Price, Churn]\ncases:\n  - { label: Downside, values: ["-5%", flat, "12%"], outcome: "$18M", tone: neg }\n  - { label: Base, values: ["8%", "+2%", "9%"], outcome: "$24M", tone: base }\n  - { label: Upside, values: ["15%", "+4%", "7%"], outcome: "$31M", tone: pos }\n```\n',
  fishbone:
    '```fishbone\ntitle: Why checkout latency rose\neffect: p95 checkout over 2s\ncauses:\n  - { label: Code, items: [Sync capture call, N+1 cart query] }\n  - { label: Infrastructure, items: [Undersized DB pool] }\n  - { label: Traffic, items: [Flash-sale spikes] }\n```\n',
  storymap:
    '```storymap\ntitle: Checkout story map\nbackbone:\n  - { label: Browse, note: Find the product }\n  - { label: Pay }\nslices:\n  - { label: MVP, cells: [[Search box], ["Card payment"]] }\n  - { label: Later, cells: [["Filters", "Saved carts"], []] }\n```\n',
  eventcontract:
    '```eventcontract\nname: order.placed\nversion: v2\nchannel: orders\nsummary: A customer completed checkout and the order is accepted.\nproducers: [checkout]\nconsumers: [billing, fulfilment, analytics]\ndelivery: at-least-once\nordering: per-key\nkey: order_id\nretention: 7d\nschema:\n  - order_id uuid required — The order this event is about\n  - customer_id uuid required — The buyer\n  - total money required — Grand total after discounts\n  - coupon string — Discount code applied, if any\nheaders:\n  - trace_id string required — W3C trace id\nexample: |\n  { "order_id": "ord_123", "customer_id": "cus_9", "total": "42.00 EUR" }\nerrors:\n  - DuplicateOrder — the same order_id was already processed\nnote: Consumers must be idempotent on order_id.\n```\n',
  saga:
    '```saga\ntitle: Place order\nmode: orchestration\ncoordinator: Order service\nsteps:\n  - reserve: Reserve stock · inventory · release stock\n  - charge: Charge card · payments · refund card\n  - ship: Book shipment · shipping · cancel shipment\n  - notify: Send confirmation · notifications\nfailAt: ship\n```\n',
  slopegraph:
    '```slopegraph\ntitle: Support volume by channel\nleft: "2023"\nright: "2025"\nunit: "%"\nitems:\n  - { label: Email, from: 48, to: 22 }\n  - { label: Chat, from: 20, to: 45, accent: teal }\n  - { label: Phone, from: 32, to: 33 }\n```\n',
  spans:
    '```spans\ntitle: GET /orders/{id}\nunit: ms\nspans:\n  - api/get: GET /orders/{id} · 0 · 120\n  - api/auth: verify token · 4 · 10 · get\n  - db/q1: SELECT orders · 18 · 40 · get\n  - { id: cache, service: cache, name: "GET order:42", start: 62, duration: 3, parent: get, kind: cache }\n  - { id: pay, service: payments, name: GET /payments/42, start: 68, duration: 46, parent: get, kind: client, error: true }\n```\n',
  rollout:
    '```rollout\ntitle: Checkout v2\nstrategy: canary\nstages:\n  - "[done] 1% · Smoke · 15m — no 5xx"\n  - "[current] 10% · Canary · 30m — error rate < 0.5%"\n  - "[next] 50% · Half · 1h — p95 < 300ms"\n  - "[next] 100% · Full"\nrollback: Flip the flag off; the old version keeps serving.\n```\n',
  neuralnet:
    '```neuralnet\ntitle: Digit classifier\nparams: 1.2M\nlayers:\n  - { label: Input, units: 784, kind: input, note: 28×28 pixels }\n  - { label: Conv 3×3, units: 32, kind: conv, activation: ReLU }\n  - { label: Max pool, units: 32, kind: pool }\n  - { label: Dense, units: 128, kind: dense, activation: ReLU }\n  - { label: Dropout 0.3, units: 128, kind: dropout }\n  - { label: Output, units: 10, kind: output, activation: softmax }\n```\n',
  modelcard:
    '```modelcard\nname: support-intent-v3\nversion: 3.2.0\ntask: Text classification (support ticket intent)\narchitecture: DistilBERT fine-tune, 6 layers\nparams: 66M\nowner: ML platform\nlicense: Internal\nintendedUse:\n  - Route inbound tickets to one of 14 queues\n  - Suggest a queue to an agent; never auto-close\noutOfScope:\n  - Any language other than English and Spanish\ntrainingData:\n  - 410k tickets, 2024-01 to 2025-06, PII scrubbed\nmetrics:\n  - { name: Macro F1, value: 0.91, split: test }\n  - { name: Latency p95, value: 38 ms, split: prod, note: CPU, batch 1 }\nlimitations:\n  - Confuses billing and refund intents on short tickets\n```\n',
  mindmap:
    '```mindmap\ncenter: Onboarding v2\nnodes:\n  - { id: acct, label: Account }\n  - { id: sso, parent: acct, label: SSO first }\n  - { id: invite, parent: acct, label: Team invites }\n  - { id: data, label: Data import, accent: teal }\n  - { id: csv, parent: data, label: CSV }\n  - { id: api, parent: data, label: API sync }\n  - { id: learn, label: Learning }\n  - { id: tour, parent: learn, label: Product tour }\n  - { id: tmpl, parent: learn, label: Templates }\n```\n',
  audit:
    '```audit\ntitle: Security review — payments service\nscope: payments-api, payments-worker\ndate: 2026-09-01\nauditor: AppSec\nfindings:\n  - { id: F1, title: Refund endpoint has no rate limit, severity: high, area: API, evidence: "POST /refunds accepted 500 req/s in the load test", fix: Add the shared limiter at 20 req/min per key, owner: payments, status: fixing }\n  - { id: F2, title: Card BIN logged at INFO, severity: critical, area: Logging, evidence: "worker.log line 2231", fix: Mask to first 2 digits; add the log-scrub test, owner: payments, status: open }\n  - { id: F3, title: Dependency openssl 3.0.8 has a known CVE, severity: medium, area: Supply chain, fix: Bump to 3.0.14, owner: platform, status: fixed }\n  - { id: F4, title: Health endpoint leaks build SHA, severity: info, area: API, status: accepted }\n```\n',
  checklist:
    '```checklist\ntitle: Production readiness — search-indexer\nstandard: PRR v4\ngroups:\n  - label: Observability\n    items:\n      - "[pass] Dashboards for the four golden signals — grafana/search-indexer"\n      - "[pass] Alerts route to the on-call — pagerduty svc P4"\n      - "[partial] Traces sampled at 10% — target is 100% on errors"\n  - label: Resilience\n    items:\n      - "[fail] Load test at 2× peak — not run since the Kafka move"\n      - "[na] Multi-region failover — single-region service by design"\n```\n',
  perfbudget:
    '```perfbudget\ntitle: Product page — web vitals\ncontext: p75, mobile, 4G, 30-day field data\nmetrics:\n  - { metric: LCP, budget: 2500, measured: 2140, unit: ms }\n  - { metric: INP, budget: 200, measured: 260, unit: ms }\n  - { metric: CLS, budget: 0.1, measured: 0.04 }\n  - { metric: JS transferred, budget: 300, measured: 285, unit: KB }\n  - { metric: Lighthouse perf, budget: 90, measured: 84, lowerIsBetter: false }\n```\n',
  percentiles:
    '```percentiles\ntitle: Checkout API latency — last 7 days\nunit: ms\nslo: 300\nrows:\n  - { label: POST /checkout, p50: 120, p90: 210, p95: 260, p99: 420, max: 1900 }\n  - { label: GET /cart, p50: 18, p90: 35, p95: 48, p99: 90, max: 410 }\n  - { label: POST /payments, p50: 240, p90: 380, p95: 470, p99: 900, max: 3100, accent: red }\n```\n',
  usecase:
    '```usecase\nsystem: Ticketing\nfocus: buy\nactors:\n  - { id: cust, name: Customer }\n  - { id: agent, name: Support agent }\n  - { id: gw, name: Payment gateway, kind: system }\ncases:\n  - { id: buy, name: Buy ticket }\n  - { id: pay, name: Pay by card }\n  - { id: promo, name: Apply promo code }\n  - { id: refund, name: Request refund }\n  - { id: approve, name: Approve refund }\nlinks:\n  - cust -> buy\n  - cust -> refund\n  - agent -> approve\n  - gw -> pay\n  - gw -> approve\nrelations:\n  - { from: buy, to: pay, kind: include }\n  - { from: promo, to: buy, kind: extend, label: code entered }\n```\n',
  pkg:
    '```pkg\ntitle: Backend module layout\npackages:\n  - { id: api, col: 1, row: 1, name: api, contains: [routes, middleware] }\n  - { id: domain, col: 2, row: 1, name: domain, contains: [orders, payments, inventory] }\n  - { id: infra, col: 3, row: 1, name: infra, contains: [postgres, kafka, stripe] }\n  - { id: shared, col: 2, row: 2, name: shared, contains: [ids, money, clock] }\ndeps:\n  - { from: api, to: domain, kind: use }\n  - { from: domain, to: infra, kind: import, label: ports only }\n  - { from: domain, to: shared }\n  - { from: infra, to: shared }\n```\n',
  timing:
    '```timing\ntitle: Circuit breaker under a downstream outage\nunit: s\nlanes:\n  - label: Breaker\n    states:\n      - { state: closed, from: 0, to: 12 }\n      - { state: open, from: 12, to: 42, accent: red }\n      - { state: half-open, from: 42, to: 46, accent: amber }\n      - { state: closed, from: 46, to: 60 }\n  - label: Downstream\n    states:\n      - { state: healthy, from: 0, to: 10 }\n      - { state: down, from: 10, to: 44, accent: red }\n      - { state: healthy, from: 44, to: 60 }\nevents:\n  - { at: 12, label: 5 failures in 10 s }\n  - { at: 46, label: probe ok }\nconstraints:\n  - { from: 12, to: 42, label: open 30 s }\n```\n',
  threatmodel:
    '```threatmodel\ntitle: Login — STRIDE\nboundaries:\n  - { id: inet, col: 1, row: 1, cols: 1, rows: 1, label: Internet }\n  - { id: dmz, col: 2, row: 1, cols: 2, rows: 1, label: Trusted network }\nnodes:\n  - { id: browser, col: 1, row: 1, name: Browser, kind: external }\n  - { id: auth, col: 2, row: 1, name: Auth service }\n  - { id: users, col: 3, row: 1, name: Users DB, kind: store }\nedges:\n  - { from: browser, to: auth, label: "POST /login", channel: tls }\n  - { from: auth, to: users, label: SELECT by email, channel: internal }\nthreats:\n  - { id: T1, target: browser, category: S, threat: Credential stuffing, mitigation: Rate limit + breached-password check, severity: high, status: mitigated }\n  - { id: T2, target: auth, category: I, threat: Verbose error reveals whether the email exists, mitigation: One generic message, severity: medium, status: open }\n  - { id: T3, target: users, category: T, threat: Password hash column altered by an admin, mitigation: Audit log + Argon2id, severity: high, status: accepted }\n```\n',
  chevrons:
    '```chevrons\ntitle: Incident lifecycle\ncurrent: 3\nsteps:\n  - { label: Detect, desc: alert fires }\n  - { label: Triage, desc: severity + owner }\n  - { label: Mitigate, desc: stop the bleeding }\n  - { label: Resolve, desc: root cause fixed }\n  - { label: Review, desc: postmortem in 5 days }\n```\n',
  roadmap:
    '```roadmap\ntitle: Platform roadmap 2026\nperiods: [Q1, Q2, Q3, Q4]\nnow: Q3\nthemes: [Reliability, Developer experience, Cost]\nitems:\n  - { label: Multi-region Postgres, theme: Reliability, from: Q1, to: Q2, status: done }\n  - { label: Chaos game days, theme: Reliability, from: Q3, status: current }\n  - { label: Preview envs per PR, theme: Developer experience, from: Q2, to: Q3, status: current }\n  - { label: Golden-path templates, theme: Developer experience, from: Q4, status: next }\n  - { label: Spot instances for batch, theme: Cost, from: Q2, status: done }\n  - { label: Egress cut 30%, theme: Cost, from: Q3, to: Q4, status: risk }\n```\n',
};

/**
 * The YAML body of a block's starter template, with the surrounding
 * ` ```type ` … ` ``` ` fences stripped — i.e. exactly what `parseDocument`
 * would report as the block's `raw`. Every template in
 * {@link BLOCK_TEMPLATES} is a single fenced block ending in a newline, so
 * this is a pure slice of its interior lines.
 *
 * @param type - The block type.
 * @returns The fence-less template body (no trailing newline).
 */
export function templateBody(type: BlockType): string {
  const lines = BLOCK_TEMPLATES[type].replace(/\n$/, '').split('\n');
  return lines.slice(1, -1).join('\n');
}

/**
 * A block family — the same 12-way split the skill's `reference/blocks/`
 * folder uses, so `chiltepin block` grouping and `chiltepin demo <family>` line up with
 * the family reference files an agent reads.
 */
export type BlockFamily =
  | 'narrative'
  | 'tables-data'
  | 'api'
  | 'architecture'
  | 'flows'
  | 'data-model'
  | 'charts'
  | 'planning'
  | 'business'
  | 'design-system'
  | 'algorithms'
  | 'agentic'
  | 'quality';

/** The families in display order, with their human labels. */
export const BLOCK_FAMILIES: ReadonlyArray<{ readonly id: BlockFamily; readonly label: string }> = [
  { id: 'narrative', label: 'Narrative & prose' },
  { id: 'tables-data', label: 'Tables & code' },
  { id: 'api', label: 'API' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'flows', label: 'Flows & state' },
  { id: 'data-model', label: 'Data model' },
  { id: 'charts', label: 'Charts & overviews' },
  { id: 'planning', label: 'Planning & backlogs' },
  { id: 'business', label: 'Business & decisions' },
  { id: 'design-system', label: 'Design system' },
  { id: 'algorithms', label: 'Algorithms' },
  { id: 'agentic', label: 'AI & agents' },
  { id: 'quality', label: 'Quality & audits' },
];

/** True when `value` names a block family. */
export function isBlockFamily(value: string): value is BlockFamily {
  return BLOCK_FAMILIES.some((f) => f.id === value);
}

/**
 * Which family each block belongs to — compile-time exhaustive over
 * {@link BlockType}. Each family has one selection sheet in the skill's
 * `reference/blocks/` (the `charts-overviews.md` file is the `charts` family).
 */
export const BLOCK_FAMILY: Record<BlockType, BlockFamily> = {
  meta: 'narrative',
  callout: 'narrative',
  prose: 'narrative',
  glossary: 'narrative',
  figure: 'narrative',
  faq: 'narrative',
  pullquote: 'narrative',
  table: 'tables-data',
  stats: 'tables-data',
  code: 'tables-data',
  slo: 'tables-data',
  endpoint: 'api',
  layers: 'narrative',
  c4: 'architecture',
  uml: 'architecture',
  frontend: 'architecture',
  cluster: 'architecture',
  block: 'architecture',
  felogic: 'architecture',
  archmap: 'architecture',
  sequence: 'flows',
  flow: 'flows',
  state: 'flows',
  dfd: 'flows',
  swimlane: 'flows',
  steps: 'flows',
  erd: 'data-model',
  tree: 'charts',
  pyramid: 'charts',
  journey: 'charts',
  gantt: 'charts',
  graph: 'charts',
  quadrant: 'charts',
  chart: 'charts',
  heatmap: 'charts',
  userstory: 'planning',
  timeline: 'planning',
  kanban: 'planning',
  proscons: 'planning',
  cvt: 'planning',
  agenda: 'planning',
  list: 'planning',
  stories: 'planning',
  pattern: 'planning',
  gallery: 'planning',
  changelog: 'planning',
  risk: 'planning',
  statustable: 'planning',
  cycle: 'flows',
  benchmark: 'tables-data',
  sankey: 'charts',
  gitgraph: 'flows',
  treemap: 'charts',
  packet: 'api',
  venn: 'charts',
  wardley: 'business',
  harvey: 'business',
  scqa: 'business',
  scenarios: 'business',
  matrix: 'business',
  anatomy: 'business',
  composition: 'business',
  drivers: 'business',
  options: 'business',
  spec: 'business',
  envelope: 'business',
  swot: 'business',
  okr: 'business',
  persona: 'business',
  team: 'business',
  scorecard: 'business',
  wireframe: 'design-system',
  palette: 'design-system',
  typescale: 'design-system',
  dodont: 'design-system',
  inventory: 'design-system',
  array: 'algorithms',
  linkedlist: 'algorithms',
  bintree: 'algorithms',
  hashmap: 'algorithms',
  agentloop: 'agentic',
  trace: 'agentic',
  prompt: 'agentic',
  context: 'agentic',
  divider: 'narrative',
  bignumber: 'narrative',
  takeaways: 'narrative',
  fishbone: 'charts',
  storymap: 'planning',
  eventcontract: 'api',
  saga: 'flows',
  slopegraph: 'charts',
  spans: 'flows',
  rollout: 'planning',
  neuralnet: 'agentic',
  modelcard: 'agentic',
  mindmap: 'charts',
  audit: 'quality',
  checklist: 'quality',
  perfbudget: 'quality',
  percentiles: 'quality',
  usecase: 'architecture',
  pkg: 'architecture',
  timing: 'flows',
  threatmodel: 'quality',
  chevrons: 'planning',
  roadmap: 'planning',
};

/** The block types of one family, in {@link BLOCK_TYPES} (registry) order. */
export function familyBlocks(family: BlockFamily): readonly BlockType[] {
  return BLOCK_TYPES.filter((t) => BLOCK_FAMILY[t] === family);
}

/**
 * Human display name per block, keyed exhaustively by {@link BlockType} —
 * what an editing UI shows instead of the type slug (e.g. `erd` →
 * "Entity-relationship diagram"). Short, accurate, first word capitalised.
 */
export const BLOCK_LABELS: Record<BlockType, string> = {
  meta: 'Document cover',
  callout: 'Callout',
  table: 'Table',
  sequence: 'Sequence diagram',
  erd: 'Entity-relationship diagram',
  userstory: 'User story',
  timeline: 'Timeline',
  kanban: 'Kanban board',
  prose: 'Structured prose',
  glossary: 'Glossary',
  proscons: 'Pros & cons',
  cvt: 'Current vs target',
  stats: 'KPI cards',
  code: 'Code snippets',
  agenda: 'Meeting agenda',
  tree: 'File tree',
  pyramid: 'Pyramid',
  flow: 'Flowchart',
  state: 'State machine',
  dfd: 'Data-flow diagram',
  journey: 'User journey',
  gantt: 'Gantt chart',
  graph: 'Node-link graph',
  quadrant: 'Quadrant chart',
  swimlane: 'Swimlane diagram',
  c4: 'C4 architecture',
  uml: 'UML class diagram',
  frontend: 'Component tree',
  cluster: 'Cluster topology',
  block: 'Block diagram',
  felogic: 'Frontend logic graph',
  wireframe: 'Wireframe',
  endpoint: 'API endpoint',
  pullquote: 'Pull quote',
  layers: 'Layered explanation',
  matrix: 'Capability matrix',
  anatomy: 'Anatomy breakdown',
  composition: 'Access composition',
  drivers: 'Design drivers',
  options: 'Options considered',
  spec: 'Spec sheet',
  list: 'Fancy list',
  stories: 'Story backlog',
  pattern: 'Design pattern',
  gallery: 'Card gallery',
  chart: 'Data chart',
  figure: 'Figure',
  steps: 'How-to steps',
  faq: 'FAQ',
  envelope: 'Back-of-envelope math',
  slo: 'SLOs & error budgets',
  swot: 'SWOT analysis',
  okr: 'OKRs',
  persona: 'User personas',
  changelog: 'Changelog',
  team: 'Team cards',
  heatmap: 'Heatmap',
  scorecard: 'Decision scorecard',
  risk: 'Risk register',
  palette: 'Color palette',
  typescale: 'Type scale',
  dodont: "Do / don't guide",
  inventory: 'Component inventory',
  array: 'Array walkthrough',
  linkedlist: 'Linked list',
  bintree: 'Binary tree',
  hashmap: 'Hash map',
  agentloop: 'Agent loop',
  trace: 'Agent trace',
  prompt: 'Prompt anatomy',
  context: 'Context-window budget',
  archmap: 'Capability map',
  divider: 'Section divider',
  bignumber: 'Big number',
  takeaways: 'Takeaways',
  statustable: 'Status table',
  cycle: 'Cycle',
  benchmark: 'Benchmark table',
  sankey: 'Flow volumes',
  gitgraph: 'Branch graph',
  treemap: 'Treemap',
  packet: 'Packet layout',
  venn: 'Venn overlap',
  wardley: 'Wardley map',
  harvey: 'Rated comparison',
  scqa: 'Executive summary',
  scenarios: 'Scenario table',
  fishbone: 'Fishbone diagram',
  storymap: 'Story map',
  eventcontract: 'Event contract',
  saga: 'Saga',
  slopegraph: 'Slopegraph',
  spans: 'Trace waterfall',
  rollout: 'Rollout plan',
  neuralnet: 'Neural network',
  modelcard: 'Model card',
  mindmap: 'Mind map',
  audit: 'Audit findings',
  checklist: 'Checklist',
  perfbudget: 'Performance budget',
  percentiles: 'Latency percentiles',
  usecase: 'Use case diagram',
  pkg: 'Package diagram',
  timing: 'Timing diagram',
  threatmodel: 'Threat model',
  chevrons: 'Process chevrons',
  roadmap: 'Roadmap',
};

/** One-line "what it's for" per block, keyed exhaustively by {@link BlockType}. */
export const BLOCK_DESCRIPTIONS: Record<BlockType, string> = {
  meta: 'Document cover — title, subtitle, tag, status, owners, reviewers, date, version, and an optional logo.',
  callout: 'A single aside — note, tip, warning, or danger.',
  table: 'Genuinely tabular data; cells can carry a tone.',
  sequence: 'Messages between actors over time (lifelines + returns).',
  erd: 'Entities, columns, keys, and crow’s-foot relationships.',
  userstory: 'One agile story — role / want / soThat + acceptance criteria + links.',
  timeline: 'Phases in order with status dots (done / current / next / future).',
  kanban: 'Flexible named columns of cards (Now / Next / Later).',
  prose: 'Structured prose (headings, paragraphs, lists, quotes) as data.',
  glossary: 'Term → definition rows.',
  proscons: 'Two columns weighed against each other — pros vs cons.',
  cvt: 'Current → target, before / after panels.',
  stats: 'KPI cards with a delta; `better: up | down` colours the delta good or bad.',
  code: 'Code the reader will copy or diff: highlighted snippets with `highlight` line ranges, `lines` numbers, and a `cols` grid; `kind: compare` sets before / after side by side, `kind: diff` a unified diff, `kind: terminal` a shell session.',
  agenda: 'A meeting agenda — time, duration, owner, topic per row.',
  tree: 'An indented file / folder hierarchy; `variant: issue` renders a MECE issue tree.',
  pyramid: 'A layered pyramid, widening top → bottom.',
  flow: 'A decision flowchart with branches and error exits; `variant: dag` renders a pipeline DAG.',
  state: 'A state machine — states + event transitions.',
  dfd: 'Data-flow — processes, external entities, and datastores.',
  journey: 'A user journey across stages, with an emotion curve.',
  gantt: 'A schedule — task bars across date columns.',
  graph: 'A generic node-link graph with colour-cycled groups.',
  quadrant: 'A 2×2 matrix (e.g. effort vs impact) with plotted items.',
  swimlane: 'Who does which step, in what order — one lane per owner, columns from the links, phase bands.',
  c4: 'C4 model — context, container and component levels, and the dynamic view.',
  uml: 'A class diagram — attributes, methods, UML relationships.',
  frontend: 'A top-down component tree (root / layout / page / hook / store).',
  cluster: 'Kubernetes-style namespaces holding services, with replicas.',
  block: 'Generic boxes-and-arrows architecture (grid or layered bands); `preset: infra | event | ddd | network` picks the domain styling.',
  felogic: 'Frontend module graph — components, hooks, interfaces, strategies; `variant: be` renders the backend flavour (controller / service / repository).',
  wireframe: 'Low-fi UI mockups inside device frames (desktop / browser / phone).',
  endpoint: 'A Swagger-style API endpoint card.',
  pullquote: 'A standout pull-quote with optional attribution.',
  layers: 'N numbered layers, each answering one question (L1 / L2 / L3).',
  matrix: 'A role × resource capability grid; cells tint by permission level.',
  anatomy: 'The labelled parts of a delimited string (app:feature:action).',
  composition: 'Effective access as intersected gates (A ∩ B ∩ C = result).',
  drivers: 'A grid of factor cards — the forces that shaped a design.',
  options: 'Approaches explored — pros / cons / verdict; the chosen one highlighted.',
  spec: 'A labelled spec sheet — label → value rows (a value can be a step-flow).',
  list: 'A fancy bullet list — accent / check / icon / number marker styles.',
  stories: 'A collapsible backlog of user stories (accordions) in one section.',
  pattern: 'A design-pattern card — intent · forces · participants · consequences.',
  gallery: 'A responsive grid of cards — code snippets or notes (e.g. a bug gallery or comparison).',
  chart:
    'A data chart — bar / line / area / scatter / donut / pie / gauge / radar / waterfall / funnel / histogram / bell / boxplot / pareto / bullet / dumbbell, pure SVG, series coloured by accent.',
  figure: 'An image with a caption in a bordered card (optional pixel width cap).',
  steps: 'A numbered how-to / runbook stepper — title, body, command, note per step.',
  faq: 'Q&A accordions — native details/summary, no JavaScript.',
  envelope: 'Back-of-envelope capacity math — assumptions, derivation rows, a highlighted bottom line.',
  slo: 'Service-level objectives — SLI, target vs current, and an error-budget burn bar.',
  swot: 'A classic SWOT 2×2 — strengths, weaknesses, opportunities, threats as tinted quadrant cards.',
  okr: 'Objectives and key results — one card per objective, a status-coloured progress bar per KR.',
  persona: 'User persona cards — avatar, role, quote, goals, frustrations, and tools.',
  changelog: 'Release history on a vertical rail — version pills, dates, and typed change chips.',
  team: 'Compact people cards — initials avatar, name, role, and focus area.',
  heatmap: 'A numeric grid with an intensity ramp — rows × columns of tiles tinted by value.',
  scorecard: 'A weighted decision matrix — criteria rows × option columns, totals footer, winner highlighted.',
  risk: 'A risk register — severity derived from likelihood × impact, with mitigation, owner, and status.',
  palette: 'Color-token swatches on a card grid — hex value, name, and usage per color.',
  typescale:
    'A live type specimen — one row per style, the sample rendered at its real size, weight, and font.',
  dodont: 'Do / don’t guideline cards — a green DO and a red DON’T column, with optional mono examples.',
  inventory:
    'A component / feature status board — compact rows with a color-coded stable / beta / experimental / deprecated / planned chip.',
  array:
    'Array cells for algorithm walkthroughs — tones, pointer labels below cells, and a dashed index-window highlight.',
  linkedlist:
    'A pointer-chain diagram (singly or doubly) — boxed nodes, next/prev arrows, node markers, and a ∅ terminator.',
  bintree:
    'A binary tree — nodes placed by parent + side, tinted to show search paths, traversals, and heap shapes.',
  hashmap:
    'Hash buckets with chained entries — collision chains read left → right as key/value pills; tones highlight probes.',
  agentloop:
    'The canonical LLM agent loop — environment → agent (model chip) → tools, with memory and a stop condition.',
  trace:
    'An agent execution transcript — user / assistant / tool / system turns, with thinking and tool args → result.',
  prompt:
    'Prompt anatomy — stacked role segments (system / user / assistant / tool) with highlighted {{variable}} chips and a legend.',
  context:
    'A context-window token budget — one stacked bar sized against the window, with free space and over-budget overflow.',
  archmap:
    'A target-architecture capability map — tinted domain areas packed with small status-coded capability tiles (current / target / new / gap / deprecated).',
  divider:
    'A full-width section break — kicker, display title, optional subtitle on an accent-washed band; a clean interstitial slide in decks.',
  bignumber:
    'One hero metric at presentation scale — a display-size value with an optional delta + trend arrow, a one-line claim, and a context line.',
  takeaways:
    'The 2-6 things to remember — numbered rows at presentation scale, each a bold one-liner with an optional detail; a deck’s closing slide.',
  statustable:
    'Task table with an update column, user-defined colored status pills, and optional subtasks per row; `variant: tracker` renders the classic task-tracker list.',
  cycle:
    'A closed loop of stages arranged in a circle — build–measure–learn, PDCA, an incident loop; step descriptions become a numbered legend.',
  benchmark:
    'Measured results side by side — subject columns (one can be outlined as the focus) × metric rows, best in each row derived and highlighted, several conditions per row supported.',
  sankey:
    'A flow diagram weighted by volume — node height and ribbon thickness are the value, so the widest ribbon leaving a stage is where the volume actually goes.',
  gitgraph:
    'A branching and release model — lanes for branches, dots for commits, curves where one forks and merges back; tags mark releases.',
  treemap:
    'Proportional composition as nested tiles — area is the value, so thirty items stay readable where a donut gives up at six.',
  packet:
    'A wire format laid out bit by bit — fields wrap across rows of `width` bits, the way an RFC header diagram reads.',
  venn:
    'Two or three overlapping sets, with the shared regions labelled — scope, ownership, responsibility.',
  wardley:
    'A Wardley map — components placed by visibility to the user and by evolution (genesis → commodity), joined into a value chain.',
  harvey:
    'A rated comparison — options across the top, criteria down the side, a Harvey ball for each judgement; the recommended column is marked.',
  scqa:
    'An executive summary in Minto order — situation, complication, question, and the answer the deck exists to deliver.',
  scenarios:
    'Base, upside and downside against the same drivers — assumptions in columns, with the outcome each set produces on its own row.',
  fishbone:
    'Cause & effect (Ishikawa) — one effect at the head, cause categories as bones off the spine, specific causes as items along each bone.',
  storymap:
    'User story map — the ordered backbone of activities across the top, release slices as rows of cards under each step.',
  eventcontract:
    'An async event contract card — name, channel, producers → consumers, delivery guarantees, and the payload fields with the partition key marked; the twin of endpoint.',
  saga:
    'A distributed transaction — forward steps left to right with the compensation under each, and the compensating flow drawn back from the step that fails.',
  slopegraph:
    'Ranked before / after — one line per item between two labeled columns; the slopes show what rose, fell, or held.',
  spans:
    'A distributed-trace waterfall — one lane per service, each span a bar on a shared time axis, nested by parent; the critical path is marked.',
  rollout:
    'A progressive-delivery plan — stages left to right with their traffic share, hold time, and the gate each must pass; the rollback move as the footer.',
  neuralnet:
    'A layered neural network — one column per layer with unit counts, kinds (input / conv / dense / attention / output) and activations; dense wiring drawn between layers.',
  modelcard:
    'An ML model card — identity, intended use and out-of-scope, training data, metrics per split, limitations; the endpoint card for a model.',
  mindmap:
    'A radial mind map — one centre, branches fanning left and right, sub-branches hanging off each; accent per branch.',
  audit:
    'An audit findings register — severity-ranked rows with evidence, fix, owner and status, and a count strip per severity.',
  checklist:
    'A pass / fail checklist with evidence — items or grouped items with a verdict chip and the evidence behind each; pass rate derived.',
  perfbudget:
    'Performance budgets against measured values — one bar per metric with the budget mark; over / near / within derived.',
  percentiles:
    'Latency percentiles per row — p50 · p90 · p95 · p99 · max as a dot-and-whisker on one axis, with the SLO line.',
  usecase:
    'A UML use-case diagram — actors outside the system boundary, use cases inside, include / extend / generalize relations.',
  pkg:
    'A UML package diagram — tabbed folders with their members on a grid, dashed import / use dependencies between them.',
  timing:
    'A UML timing diagram — one lane per lifeline stepping through states over a shared time axis, with events and duration constraints.',
  threatmodel:
    'A STRIDE threat model — data-flow shapes inside dashed trust boundaries, plain hops marked, and a threats table keyed to nodes and edges.',
  chevrons:
    'A process chevron strip — N steps left to right with the current one highlighted and a line of detail under each.',
  roadmap:
    'A roadmap — themes as rows, periods as columns, items as status-tinted chips spanning their periods, with a "now" rule.',
};
