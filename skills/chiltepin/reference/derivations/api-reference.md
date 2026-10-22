# Derivation — screenshot capture API

Part of the **chiltepin** skill. One request, from its facts to its outline.
No YAML on purpose: your request has other facts and gets another outline.

## The inventory

- The capture API renders a URL to PNG, WebP, or PDF. Base URL and bearer
  auth are given.
- Three operations: create a capture, fetch one, list them — each with its
  parameters, statuses, and a real request and response.
- Captures are async: the POST returns 202; the file arrives by webhook or
  by polling. Render time is 2–8 s.
- Webhooks are signed (HMAC-SHA256 with a timestamp) and redelivered five
  times over 30 minutes; delivery is at-least-once.
- `result_url` is signed and expires after 24 hours.
- Five error statuses, each with the action the client takes.
- Rate limit: 10 requests per second, bursts to 50. Credits are spent only
  on success.

Reader: an integrator, writing the client code now. They act on each
section as they read it.

## Why the headings are task labels

In a reference doc the integrator scans for the task in front of them, so
headings name tasks. A claim heading would make them read to find the call.

The opening still answers first: "POST a URL and get 202 at once; the file
follows in 2–8 s by signed webhook, or by polling. The limit is 10 requests
per second, with bursts to 50."

| Heading | Block | The fact that picked it |
|---|---|---|
| Create a capture · Fetch a capture · List captures | `endpoint` × 3 | Three operations with real payloads. |
| Receive the webhook | `sequence` | The calls compose in order, with an async hop and a redelivery. |
| Handle errors | `table` | Plain facts per status: meaning and the client's action. |
| Before you go live | `checklist` | Verify the HMAC signature, dedupe on capture id, refetch an expired `result_url`. |

Prose under "Receive the webhook" carries the idempotency rule and why
polling is a fallback, not a race.

## The last section

The integrator's next step is going live. The doc ends on what they verify
first: each item is a thing they do, not a caveat they read.

## Left out

- `code` blocks — the snippets live inside the endpoint cards.
- `glossary` — the request used no domain terms beyond "capture".

## What would change the shape

- An OpenAPI spec exists → start with `chiltepin sync openapi`.
- Twenty operations → split the reference per resource.
