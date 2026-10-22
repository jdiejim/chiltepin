```meta
title: Three system designs, one request at a time
subtitle: One numbered step decides each design — the cache read for short links, the topic hop for chat, the job queue for video.
tag: EXAMPLE
status: example
```

Each diagram numbers one request on its edges, and the text walks the same numbers. In each design one step sets the latency or the failure: a 1 ms cache read, a topic hop, or a job queue. All numbers on this page are assumed.

## A short link resolves with one cache read, and the write path fills that cache

```block
id: shortener
title: Short links — read path and write path
nodes:
  - { id: dns, col: 1, row: 1, kind: dns, name: DNS, tech: Route 53 }
  - { id: web, col: 1, row: 2, kind: browser, name: Browser }
  - { id: lb, col: 2, row: 2, kind: lb, name: Load balancer, tech: ALB · TLS }
  - { id: redirect, col: 3, row: 1, kind: server, name: redirect-api, tech: Go, replicas: 4 }
  - { id: links, col: 3, row: 3, kind: server, name: links-api, tech: Go, replicas: 2 }
  - { id: idgen, col: 3, row: 4, kind: service, name: id-generator, tech: Snowflake ids }
  - { id: cache, col: 4, row: 1, kind: cache, name: link cache, tech: Redis }
  - { id: ro, col: 4, row: 2, kind: replica, name: links replicas, tech: Postgres · 2 }
  - { id: pg, col: 4, row: 3, kind: db, name: links primary, tech: Postgres 16 }
edges:
  - { from: web, to: dns, label: resolve sho.rt, step: 1, path: read }
  - { from: web, to: lb, label: GET /aB3x, step: 2, path: read }
  - { from: lb, to: redirect, step: 3, path: read }
  - { from: redirect, to: cache, label: GET aB3x, step: 4, path: read }
  - { from: redirect, to: ro, label: on miss, step: 5, path: read }
  - { from: web, to: lb, label: POST /links, step: 6, path: write }
  - { from: lb, to: links, step: 7, path: write }
  - { from: links, to: idgen, label: next id, step: 8, path: write }
  - { from: links, to: pg, label: INSERT, step: 9, path: write }
  - { from: links, to: cache, label: SET aB3x, step: 10, path: write }
  - pg --> ro: replicates
```

Steps 1–3 find the service. The browser keeps the DNS answer for 300 s, so most redirects skip step 1. The load balancer ends TLS and picks one of the four redirect servers in under 2 ms.

Step 4 is the read that sets the latency. At a 95 % hit rate the cache answers in 1 ms, and the redirect leaves the server in 3 ms at p99. Step 5 runs only on a miss: the server reads a replica, which adds about 5 ms.

Steps 6–10 are the write path, and step 10 closes the gap in the read path. A replica runs up to 200 ms behind the primary. Without step 10, a link read inside that window misses the cache and the replica and returns 404. The id generator in step 8 is the single failure point of the write path: when it stops, new links fail and redirects continue.

## A chat message reaches an online user through one topic hop

```block
id: chat
title: Chat — one message from sender to recipient
nodes:
  - { id: alice, col: 1, row: 1, kind: mobile, name: Sender app }
  - { id: chatA, col: 2, row: 1, kind: server, name: chat server A, tech: WebSocket }
  - { id: presence, col: 2, row: 2, kind: cache, name: presence, tech: Redis }
  - { id: inbox, col: 3, row: 1, kind: topic, name: inbox topic, tech: Kafka }
  - { id: store, col: 3, row: 2, kind: shards, name: message store, tech: Cassandra · 16 shards }
  - { id: chatB, col: 4, row: 1, kind: server, name: chat server B, tech: WebSocket }
  - { id: pusher, col: 4, row: 2, kind: worker, name: push worker, tech: Go }
  - { id: bob, col: 5, row: 1, kind: mobile, name: Recipient app }
  - { id: apns, col: 5, row: 2, kind: external, name: Push gateway, tech: APNs · FCM }
edges:
  - 1. alice -> chatA: send frame
  - 2. chatA -> store: append
  - 3. chatA -> presence: find server of B
  - 4. chatA --> inbox: publish
  - 5. inbox --> chatB: consume
  - 6. chatB -> bob: deliver
  - 7. inbox --> pusher: B is offline
  - 8. pusher -> apns: notify
```

Steps 1–2 make the message durable before anything else happens. Chat server A appends it to the message store with a quorum write of 4 ms, then acknowledges the sender. A crash after step 2 loses no message: the recipient app fetches it by the last id it saw.

Steps 3–6 are the online path, about 40 ms end to end at p99. Step 4 is the only hop between the two servers: chat server A never calls chat server B. The presence lookup in step 3 names the inbox partition of B, so only chat server B consumes the message in step 5.

Steps 7–8 run when presence has no server for B. The push worker sends a notification, and the app fetches the message when it opens. The push gateway takes 1–10 s and drops some notifications, so a push never carries the message text.

## A video upload never passes through the API, and the job queue absorbs the spike

```block
id: video
title: Video — upload path and playback path
nodes:
  - { id: creator, col: 1, row: 1, kind: mobile, name: Creator app }
  - { id: viewers, col: 1, row: 3, kind: users, name: Viewers }
  - { id: upload, col: 2, row: 1, kind: service, name: upload-api, tech: signed URLs }
  - { id: raw, col: 2, row: 2, kind: bucket, name: raw uploads, tech: S3 }
  - { id: cdn, col: 2, row: 3, kind: cdn, name: CDN, tech: CloudFront }
  - { id: jobs, col: 3, row: 2, kind: queue, name: transcode jobs, tech: SQS }
  - { id: tx, col: 4, row: 2, kind: worker, name: transcoders, tech: FFmpeg on GPU, replicas: 8 }
  - { id: meta, col: 5, row: 1, kind: db, name: video metadata, tech: Postgres }
  - { id: thumbs, col: 5, row: 2, kind: function, name: thumbnailer, tech: Lambda }
  - { id: out, col: 5, row: 3, kind: bucket, name: renditions, tech: S3 · HLS }
edges:
  - { from: creator, to: upload, label: POST /videos, step: 1, path: upload }
  - { from: upload, to: meta, label: row uploading, step: 2, path: upload }
  - { from: creator, to: raw, label: PUT parts, step: 3, path: upload }
  - { from: raw, to: jobs, label: object created, step: 4, path: upload, kind: dashed }
  - { from: jobs, to: tx, label: next job, step: 5, path: upload, kind: dashed }
  - { from: tx, to: out, label: HLS ladder, step: 6, path: upload }
  - { from: tx, to: meta, label: mark ready, step: 7, path: upload }
  - { from: tx, to: thumbs, label: keyframes }
  - { from: thumbs, to: out, label: posters }
  - { from: viewers, to: cdn, label: GET playlist, step: 8, path: playback }
  - { from: cdn, to: out, label: origin pull, step: 9, path: playback }
```

Steps 1–3 keep video bytes off the API servers. The upload API only writes a row and signs a URL, in 20 ms. The app then sends the file in 8 MB parts straight to object storage in step 3, and a failed part retries alone.

Steps 4–5 put a queue between the uploads and the GPUs. At 18:00 uploads rise to 20× the morning rate. The queue gets deeper, and the time to ready grows from 2 to 25 minutes, but no upload fails. Steps 6–7 write the renditions and mark the row ready; the thumbnailer runs beside them and has no step.

Steps 8–9 are the playback path. The CDN serves 98 % of the segments from its cache, so step 9 runs for about one segment in fifty.

## Each design fails at a different step

```table
id: failures
title: Where each design breaks, and what the user sees
columns: [Design, Step, What fails, What the user sees, Response]
rows:
  - [Short links, "8", The id generator stops, New links fail; redirects work, Two generators with split id ranges]
  - [Short links, "5", Replica lag passes 200 ms, A fresh link returns 404, Step 10 fills the cache on write]
  - [Chat, "4", The inbox topic stalls, Messages arrive late, The app fetches by last seen id]
  - [Chat, "8", The push gateway drops a notification, No banner; the message waits, The app syncs when it opens]
  - [Video, "5", GPU capacity runs out, Ready time grows to 25 min, Autoscale on queue depth]
```

## Three decisions are still open

```faq
title: Open before the designs ship
items:
  - q: Do short links need a second id generator?
    a: "The links team decides after the failover test on 4 Nov."
    open: true
  - q: Does chat keep presence in Redis, or move it into the chat servers?
    a: "The chat lead decides when presence reads pass 50 000 per second."
  - q: Do transcoders scale on queue depth or on the time of day?
    a: "The video platform lead decides after two weeks of queue-depth data."
```

```statustable
title: Follow-up work
columns: [Task, Owner, Update]
statuses:
  - { label: to do, color: neutral }
  - { label: in progress, color: warn }
rows:
  - { cells: [Write-through cache on link create, Links team, Code review this week], status: in progress }
  - { cells: [Fetch by last seen id on app open, Chat team, Not started], status: to do }
  - { cells: [Queue-depth alarm at 10 000 jobs, Video platform, Not started], status: to do }
```
