```meta
title: Orders API reference
subtitle: The HTTP surface for creating and reading orders.
tag: API · v1
```

## Create an order

```endpoint
method: POST
path: /orders
description: Submit a cart and create a new order.
auth: Bearer token
params:
  - { name: idempotency-key, in: header, type: string, desc: Safe-retry key }
body:
  - { name: items, type: "Item[]", required: true, desc: Line items }
  - { name: coupon, type: string, desc: Optional discount code }
responses:
  - { status: 201, desc: Order created }
  - { status: 400, desc: Invalid cart }
  - { status: 401, desc: Missing or invalid token }
request: |
  { "items": [{ "sku": "A1", "qty": 2 }] }
response: |
  { "id": "ord_123", "status": "pending" }
```

## Request flow

```sequence
id: seq-orders
actors:
  - { id: client, name: Client }
  - { id: api, name: Orders API }
  - { id: db, name: orders-db }
messages:
  - { from: client, to: api, label: POST /orders, kind: sync }
  - { from: api, to: db, label: INSERT order }
  - { from: api, to: client, label: 201 Created, kind: response }
```

## Data touched

```erd
entities:
  - name: orders
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: status, type: text }
  - name: order_items
    columns:
      - { name: id, type: uuid, pk: true }
      - { name: order_id, type: uuid, fk: true }
      - { name: sku, type: text }
relations:
  - { from: order_items, to: orders, label: belongs to, card: "N:1" }
```

## Status codes

```table
columns: [Code, Meaning, When]
rows:
  - ["201", Created, "Order accepted"]
  - ["400", Bad request, "Cart failed validation"]
  - ["401", Unauthorized, "Missing or invalid token"]
```
