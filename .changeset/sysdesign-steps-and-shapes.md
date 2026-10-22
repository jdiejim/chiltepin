---
'chiltepin-core': minor
'chiltepin-render': minor
'chiltepin': patch
'chiltepin-studio': patch
---

A `block` edge takes an optional `step` (a whole number from 1 to 99). The renderer draws it as a circled numeral just before the edge label, as one unit on the edge, so the prose can walk the request by number. The terse form `3. api -> cache: read` sets the step on a `block` edge, and every older terse line keeps its meaning.

A `block` edge takes an optional `path` name (`read`, `write`). Edges with one name draw in one category hue, with their numerals and arrowheads, and the legend names each path. Error edges stay red on any path.

A `cache` now draws as one memory card with contacts along its base, and a `worker` as a card with a gear and its own `WORKER` chip. A pile of cards now means only `replicas`. Arrows end on the drawn shape of a function, a padlock and a sharded store. The kind chip of a cloud, a replica set and a sharded store sits inside the shape, and a gateway bar spans its fan-out when one client calls it twice.
