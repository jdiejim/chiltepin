# Derivation — telematics trips pipeline

Part of the **chiltepin** skill. One request, from its facts to its outline.
No YAML on purpose: your request has other facts and gets another outline.

## The inventory

- Our fleet telematics platform: 140,000 vehicles; 2.1 billion pings a day
  become about 9.4 million trips.
- Stages: tracker fleet → ingest gateway → `pings.raw` (Kafka) → deduper →
  sessionizer → `trips-db` (Postgres); malformed pings go to `pings.dlq`.
- The sessionizer closes a trip after five idle minutes.
- Tables: vehicles, trips, trip_points. Invoices bill from `distance_m`.
- A replay procedure: three commands.
- Three SLOs with targets, current values, and budgets. Trip freshness is
  breached, which freezes sessionizer deploys until its budget recovers.

Readers: the on-call data engineer, who acts during a gap, and the billing
team, who must trust `distance_m`.

## Limits first

This pipeline is defined by its limits, so the derivation lists them
before any block. Each one gets what happens at the limit, and who chose it.

| Limit | At the limit | Who chose it |
|---|---|---|
| Pings arrive up to 48 h late | Dedupe keys on `(vehicle_id, recorded_at)` over 48 h; a later ping is not covered | not given → open question |
| 5 idle minutes close a trip | A long stop splits one drive into two trips: the lossy stage | not given → open question |
| Replay window 48 h | A replay past 48 h would bill a trip twice; the procedure refuses it | given: billing depends on it |
| `distance_m` is never recomputed | A billed distance never changes after the invoice | given: invoices bill from it |

Two limits have no owner in the request. They do not become caveats: they
become the open questions in the last section, each with the person who
answers it.

## Outline

- Opening: "A ping that arrives within 48 hours lands in exactly one trip,
  and nothing after that changes a billed distance. One freshness SLO is
  breached today."
- **Late pings are deduplicated, never double-counted** → `dfd`, with the
  dead-letter branch.
- **Invoices read a distance that never changes** → `erd`.
- **Replay a gap** → `steps`, with a verify step; a how-to inside an
  explanation takes a task label.
- **Trip freshness is outside its budget** → `slo`.
- **Sessionizer deploys wait for the freshness budget** → `faq`: when the
  freeze lifts, and who chose the 48 h and 5-minute limits. The data
  platform lead answers both.

## Left out

- `sankey` — volumes are two numbers, and prose states them.
- `sequence` — a pipeline has no request and reply to pair.
