# Derivation — orders store migration

Part of the **chiltepin** skill. One request, from its facts to its outline.
No YAML on purpose: your request has other facts and gets another outline.

## The inventory

- The `orders` table is 2.3 TB and 480M rows in the monolith's shared
  Postgres. Write p95 is 210 ms and rises about 8 ms a month; autovacuum
  runs 11 hours and blocks schema changes.
- Target: a dedicated cluster, partitioned by month, behind the existing
  `OrdersRepo` interface. Target write p95 under 40 ms.
- Phases are the literal values of the `orders_migration_phase` flag: dual
  write, backfill, shadow read, read new, write new, done. Each has an exit
  guard and a rollback edge; only "done" is irreversible.
- A four-step write-cutover runbook with exact commands and exit criteria.
- Four risks with likelihood, impact, mitigation, owner, and status.
- The storage lead approves each phase change.

## Two readers, two decisions

| Reader | Moment | Decision |
|---|---|---|
| Storage team | the cutover window | run the next phase, or roll back |
| Phase reviewers | before each flag change | approve the next phase |

Both decide at phase boundaries, not on a calendar.

## Outline

The opening: "We move `orders` to a dedicated, month-partitioned cluster
one flag phase at a time; every phase but the last can roll back. Write p95
is 210 ms and grows 8 ms a month, against a target under 40 ms."

- **Write p95 drops from 210 ms to under 40 ms** → `cvt`, today and target,
  each with its number.
- **Every phase but "done" rolls back** → `state`. The state names equal
  the flag values, so the diagram is the runbook's vocabulary.
- **Cut writes over in four checked steps** → `steps`, a task label, with
  exact commands and a verify step after each.
- **Backfill lag is the risk most likely to stop us** → `risk`, four rows.
- **Next gate: shadow read → read new** → `statustable`: the exit criteria,
  their current values, and the storage lead who approves the change.

## Left out

- `gantt` or `timeline` — the request gave no dates; phases advance on
  guards, not on a calendar.
- `options` — the decision to migrate is already made.

## Why it ends on the next gate

Reviewers return at every phase. The last section names the next gate and
what must be true to pass it; the `risk` register sits just before it.
