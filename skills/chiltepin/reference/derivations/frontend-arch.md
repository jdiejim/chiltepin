# Derivation — offline-first field app

Part of the **chiltepin** skill. One request, from its facts to its outline.
No YAML on purpose: your request has other facts and gets another outline.

## The inventory

- Our inspection app for wind-turbine technicians, on phones, inside
  towers. Up to 9 hours offline; 60% of sessions never reach the network.
- A React SPA behind a service worker, not SSR. A 180 KB gzip budget on
  first load; all reads and writes go through IndexedDB.
- Named modules: `App`, `SyncProvider` (the only network importer), `Shell`,
  five pages, `ChecklistForm`, `PhotoCapture`, `outboxStore`, `useOutbox`.
- One screen that matters: the inspection screen with a queued-writes badge.
- Record states: draft, queued, syncing, synced, conflict. Median time in
  queued: 3.4 hours.
- Five routes, each with its offline behaviour.

Reader: a frontend engineer about to add a screen. Their next action is a
pull request that must stay offline-safe.

## The outline before, and after

A first draft takes its headings from the blocks: "Module tree", "Record
lifecycle", "Routes". Read alone, they say nothing about offline safety.
The rebuilt outline states claims, in the order the engineer needs them:

| Heading | Block | Why it is here |
|---|---|---|
| Only `SyncProvider` touches the network | `frontend` | The module tree, with the one import rule as its focus. |
| The badge, not a spinner, shows unsent work | `wireframe` | Sync state stays ambient on the one screen that matters. |
| A record waits 3.4 hours in queued, and the UI treats that as saved | `state` | Five states, a conflict loop, a measured dwell time. |
| Every route works with no network | `table` | Plain facts per route. |
| Before you open the pull request | `checklist` | The rules a new screen must pass. |

The opening: "Every screen reads and writes IndexedDB, and only
`SyncProvider` talks to the network. Technicians work up to 9 hours
offline, and 60% of sessions never connect."

## Left out

- `c4` — one container; a boundary around one box says nothing.
- `sequence` for data fetch — no request reaches the network in the common
  case, and the `state` already shows sync.

## Why it ends on a checklist

The reader's next step is a pull request. The checklist turns the import
rule, the 180 KB budget, and queued-is-saved into items they can verify.
