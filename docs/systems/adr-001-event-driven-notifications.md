```meta
title: ADR-001 — Event-driven notifications
subtitle: "A notification system in the cloud — SPA front end, stateless API, a managed event bus, a worker, and a database. Producers publish to the bus; the worker fans out per-user feeds and pushes live updates over SSE."
tag: ADR · Accepted · 2026-06-13
```

## Status

**Accepted** — 2026-06-13. Supersedes the original "API calls the notifications
service directly" sketch.

## Context

We need in-app notifications: a bell with a live unread count and a feed. Many
back-end actions (an order ships, someone is mentioned, a payment fails) should
turn into a notification, and the browser should update **without polling**. The
producers shouldn't have to know about — or wait for — notification delivery.

```callout
tone: note
title: Decision
body: "Producers publish domain events to a managed pub/sub topic. A worker fans them out to per-user feed rows and pushes them to open browsers over SSE. Yes — we use a managed bus (with a DLQ), not direct service-to-service calls."
```

## Cloud architecture

```block
preset: infra
id: infra-landscape
title: Cloud landscape
systemLabel: Notifications · us-east-1
lede: Event-driven and fully managed. The API only publishes; delivery happens off the request path.
layers:
  - { label: Edge }
  - { label: Compute }
  - { label: Messaging }
  - { label: Data }
nodes:
  - { id: spa, layer: 0, kind: client, name: Web SPA, tech: React on CDN }
  - { id: gw, layer: 0, kind: gateway, name: API Gateway, tech: HTTPS · SSE }
  - { id: api, layer: 1, kind: service, name: Notifications API, tech: stateless }
  - { id: worker, layer: 1, kind: consumer, name: Fan-out worker, tech: subscriber }
  - { id: topic, layer: 2, kind: topic, name: domain.events, tech: managed pub/sub }
  - { id: dlq, layer: 2, kind: queue, name: retry / DLQ, tech: redelivery }
  - { id: db, layer: 3, kind: db, name: Notifications DB, tech: per-user feed }
  - { id: cache, layer: 3, kind: cache, name: Unread counts, tech: fast read }
edges:
  - { from: spa, to: gw }
  - { from: gw, to: api }
  - { from: api, to: topic, label: publish }
  - { from: topic, to: worker, label: deliver }
  - { from: worker, to: dlq, label: on failure, kind: dashed }
  - { from: worker, to: db, label: write feed }
  - { from: worker, to: cache, label: bump count }
  - { from: worker, to: gw, label: push (SSE), kind: dashed }
```

## How the back end uses the event engine

The API is a **pure producer** — it publishes one event and returns. Everything
after the publish is choreography: no service calls another directly. New
consumers (an email digest, say) attach to the same topic without touching
producers.

```block
preset: event
id: event-flow
title: Producers → topic → consumers
lede: One publisher, many consumers. Adding a channel means adding a subscriber, not editing every service.
nodes:
  - id: orders
    col: 1
    row: 3
    kind: producer
    name: Orders svc
  - id: billing
    col: 1
    row: 2
    kind: producer
    name: Billing svc
  - id: social
    col: 1
    row: 1
    kind: producer
    name: Social svc
  - id: topic
    col: 3
    row: 2
    kind: topic
    name: domain.events
  - id: digest
    col: 3
    row: 4
    kind: consumer
    name: Email digest
  - id: worker
    col: 3
    row: 1
    kind: consumer
    name: Fan-out worker
  - id: dlq
    col: 4
    row: 1
    kind: queue
    name: retry / DLQ
edges:
  - { from: orders, to: topic }
  - { from: billing, to: topic }
  - { from: social, to: topic }
  - { from: topic, to: digest }
  - { from: topic, to: worker }
  - { from: worker, to: dlq, label: nack → retry, kind: dashed }
groups:
  - col: 1
    row: 1
    rows: 3
    label: Producers
```

## Data model

The worker writes one row per recipient into `notifications`, and looks up
`devices` to know where to push. A `cache` keyed by `user_id` holds the unread
count so the bell never scans the table.

```erd
id: db-schema
title: Notifications DB
description: Per-user feed rows, plus device registrations for push delivery.
entities:
  - name: users
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: email, type: citext }
  - name: notifications
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: user_id, type: uuid, fk: true }
      - { name: event_id, type: uuid }
      - { name: type, type: text }
      - { name: body, type: text }
      - { name: read_at, type: timestamptz }
      - { name: created_at, type: timestamptz }
  - name: devices
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: user_id, type: uuid, fk: true }
      - { name: platform, type: text }
      - { name: push_token, type: text }
relations:
  - { from: users, to: notifications, card: "1:N", label: receives }
  - { from: users, to: devices, card: "1:N", label: registers }
```

## One event, delivered live

```sequence
id: seq-realtime
lede: A back-end event reaches the bell without the front end ever polling.
actors:
  - { id: Svc, name: Domain svc, sub: producer }
  - { id: Bus, name: Event bus, sub: managed pub/sub }
  - { id: Worker, name: Fan-out worker, sub: subscriber }
  - { id: DB, name: Notifications DB, sub: per-user feed }
  - { id: GW, name: API Gateway, sub: SSE stream }
  - { id: FE, name: Web SPA, sub: bell + feed }
messages:
  - { from: Svc, to: Bus, label: publish event, kind: async, summary: "A domain action publishes one event and the request returns immediately — delivery is off the hot path." }
  - { from: Bus, to: Worker, label: deliver, kind: sync, summary: "The bus pushes the event to the worker subscription. Delivery is at-least-once." }
  - { from: Worker, to: DB, label: insert notification, kind: sync, summary: "The worker fans the event out to each recipient and writes their feed row. Writes are idempotent on event id." }
  - { from: Worker, to: GW, label: push (SSE), kind: async, summary: "For users with an open tab, the worker emits an SSE message onto their gateway stream." }
  - { from: GW, to: FE, label: notification event, kind: async, summary: "The browser receives the event on its EventSource and updates the store — no refresh, no poll." }
  - { from: FE, to: GW, label: GET /notifications, kind: sync, summary: "On reconnect (tab was closed), the SPA fetches what it missed. SSE for live, REST for catch-up." }
  - { from: GW, to: FE, label: 200 feed, kind: response, summary: "Backfill the missed unread items, then resume the live stream." }
foot:
  - { label: Transport, value: SSE (live) + REST (catch-up) }
  - { label: Delivery, value: at-least-once + idempotent writes }
```

## How the front end works — and refreshes

One hook owns a single SSE connection and writes to one store. The bell and the
feed both **read** from that store, so the unread badge and the list never drift.
There's no polling: the live path is SSE, and REST is only used to backfill after
a reconnect.

```felogic
id: felogic-fe
title: Front-end logic & the refresh path
lede: A single hook owns the SSE connection and the store; components only read.
groups:
  - { id: app, label: Web SPA (browser), col: 1, row: 1, cols: 3, rows: 3, color: "#0e54a1" }
nodes:
  - id: bell
    col: 1
    row: 1
    kind: component
    name: Bell + badge
    note: unread count
  - id: feed
    col: 1
    row: 2
    kind: component
    name: Notification feed
  - id: hook
    col: 2
    row: 1
    kind: hook
    name: useNotifications
  - id: store
    col: 2
    row: 2
    kind: state
    name: notifications store
  - id: client
    col: 2
    row: 3
    kind: apiclient
    name: SSE + REST client
  - id: gw
    col: 3
    row: 2
    kind: external
    name: API Gateway
edges:
  - { from: bell, to: store, kind: reads }
  - { from: feed, to: store, kind: reads }
  - { from: hook, to: store, kind: uses }
  - { from: hook, to: client, kind: uses }
  - { from: client, to: gw, kind: egress, label: SSE stream }
  - { from: client, to: gw, kind: api, label: GET /notifications }
```

The same notifications surface in two places — a desktop dropdown and the phone:

```wireframe
id: ui-mockups
title: What the user sees
lede: One feed, two surfaces. The bell badge is the unread count pushed over SSE.
screens:
  - device: browser
    title: Notification center
    url: app.example.com/inbox
    label: Desktop — notification center
    elements:
      - { type: nav, label: "Home, Inbox, Settings" }
      - { type: header, label: Notifications }
      - { type: badge, label: "3 new", tone: danger, align: r }
      - { type: list, rows: 4 }
      - { type: button, label: Mark all as read }
  - device: phone
    title: "9:41"
    label: iPhone — live bell + feed
    elements:
      - { type: header, label: Alerts }
      - { type: badge, label: "3", tone: danger, align: r }
      - { type: card, rows: 3 }
      - { type: tabs, label: "Home, Search, Bell, You" }
```

## Do we need a queue?

Yes — a managed bus with retry/DLQ is the whole point of the design. The
alternative (producers calling the notifications API synchronously) couples every
service to notification uptime and puts delivery on the request path.

```proscons
id: queue-decision
title: Managed bus vs. direct calls
lede: The core decision behind this ADR.
prosLabel: Managed bus + worker (chosen)
consLabel: Direct synchronous calls
pros:
  - Producers don't wait for delivery — the request path stays fast
  - One publisher feeds many consumers (bell, email digest) with no producer changes
  - Retries and a dead-letter queue absorb downstream outages
  - Traffic spikes are buffered instead of overloading the API and DB
cons:
  - Every producer must know and call the notifications API
  - A slow or down notifications service slows the caller
  - Adding a new channel means editing every producer
  - A spike hits the database directly with no buffer
```

```callout
tone: tip
title: The "other stuff" a bus brings
body: "At-least-once delivery means consumers must be idempotent — dedupe on event id. Add a dead-letter queue for poison messages, and a cache for unread counts so the bell doesn't hit the DB on every page load."
```

## Consequences

```statustable
variant: tracker
id: consequences
items:
  - { task: "Define the domain.events schema (event id, type, recipients)", status: todo, priority: high, owner: platform }
  - { task: "Make the worker idempotent — dedupe on event id", status: todo, priority: high, owner: backend }
  - { task: "Provision the managed topic + DLQ in IaC", status: doing, priority: high, owner: infra }
  - { task: "SSE reconnect + REST backfill in the SPA", status: todo, priority: med, owner: frontend }
  - { task: "Load-test fan-out at 10x peak before GA", status: todo, priority: med }
```

```table
columns: [Field, Description]
rows:
  - [name, Display name]
  - [id, Stable identifier]
```
