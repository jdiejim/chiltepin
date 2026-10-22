```meta
title: Marketplace platform
subtitle: The request path, the event backbone, the data plane, and the third parties at the edge — on one page.
tag: EXAMPLE
```

One `block` diagram carries the whole platform. Groups mark each plane. Node kinds draw as the shapes a design review expects: a load-balancer bar, cylinders, pipes, clouds. Replicas stack as cards, and dense flows get numbers and a legend.

## The platform on one page

```block
id: platform
preset: infra
title: Marketplace — request path, event backbone, data plane
groups:
  - { id: clients, col: 1, row: 1, cols: 1, rows: 3, label: Clients }
  - { id: edge, col: 2, row: 1, cols: 1, rows: 3, label: Edge }
  - { id: services, col: 3, row: 1, cols: 1, rows: 4, label: Services }
  - { id: async, col: 4, row: 2, cols: 1, rows: 2, label: Event backbone }
  - { id: data, col: 5, row: 1, cols: 1, rows: 4, label: Data plane }
  - { id: outside, col: 6, row: 1, cols: 1, rows: 4, label: Third parties }
nodes:
  - { id: users, col: 1, row: 1, kind: users, name: Shoppers }
  - { id: mobile, col: 1, row: 2, kind: mobile, name: Mobile app, tech: iOS · Android }
  - { id: web, col: 1, row: 3, kind: browser, name: Web app, tech: Next.js }
  - { id: cdn, col: 2, row: 1, kind: cdn, name: CDN, tech: Cloudflare }
  - { id: waf, col: 2, row: 2, kind: waf, name: WAF, tech: rate limits }
  - { id: lb, col: 2, row: 3, kind: lb, name: Load balancer, tech: L7 · TLS }
  - { id: auth, col: 3, row: 1, kind: service, name: auth, tech: Go, replicas: 2 }
  - { id: catalog, col: 3, row: 2, kind: service, name: catalog, tech: Go, replicas: 3 }
  - { id: orders, col: 3, row: 3, kind: service, name: orders, tech: Go, replicas: 3 }
  - { id: payments, col: 3, row: 4, kind: service, name: payments, tech: Kotlin, replicas: 2 }
  - { id: kafka, col: 4, row: 2, kind: kafka, name: events, tech: Kafka · 12 partitions }
  - { id: workers, col: 4, row: 3, kind: worker, name: workers, tech: fulfilment · email, replicas: 4 }
  - { id: redis, col: 5, row: 1, kind: redis, name: cache, tech: Redis cluster }
  - { id: pg, col: 5, row: 2, kind: shards, name: orders-db, tech: Postgres · 4 shards }
  - { id: pgro, col: 5, row: 3, kind: replica, name: orders-db, tech: read replicas }
  - { id: search, col: 5, row: 4, kind: store, name: search, tech: OpenSearch }
  - { id: s3, col: 6, row: 1, kind: bucket, name: object store, tech: S3 · images · receipts }
  - { id: wh, col: 6, row: 2, kind: warehouse, name: warehouse, tech: BigQuery }
  - { id: twilio, col: 6, row: 3, kind: external, name: Twilio · SES }
  - { id: stripe, col: 6, row: 4, kind: external, name: Stripe }
edges:
  - users -> mobile
  - users -> web
  - web -> cdn: static assets
  - cdn --> s3: origin
  - mobile -> waf
  - web -> waf
  - waf -> lb: filtered traffic
  - lb -> auth: verify session
  - lb -> catalog
  - lb -> orders
  - catalog -> redis: read-through
  - catalog -> search: query
  - orders -> pg: writes
  - pg --> pgro: replicate
  - catalog --> pgro: read
  - orders -> payments: charge
  - payments --> stripe: capture
  - orders -> kafka: order events
  - kafka --> workers: consume
  - workers --> twilio: notify
  - kafka --> wh: CDC
```

Every node is one line of YAML. The renderer chose the shapes, routed the arrows, numbered the labelled flows, and built the legend.
