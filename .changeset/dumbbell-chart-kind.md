---
'chiltepin-core': minor
'chiltepin-render': minor
'chiltepin': patch
'chiltepin-studio': patch
---

`chart` gets `kind: dumbbell`. It draws one row per label and one dot per series on a shared value axis, with a connector from the lowest dot to the highest. The first series is a neutral dot, the last series is the accent, and a series between them takes a category hue. At the right, each row prints "first → last" and a signed change (`+1.5`, `−0.4`), so a row that falls reads as clearly as a row that rises.

`chart` gets the optional `min` field, the floor of the dumbbell value axis. With `max`, it sets a fixed scale such as 1–5. Without them, the axis comes from the data and includes 0 only when the data is near 0. A value past `min` or `max` stays on the axis end with a chevron and prints its true value. Long row labels wrap, and dots that touch move apart above and below the track. The drawing aims at a width that fits a 400 px phone with no sideways scroll.

The skill routes two values per row on one scale to the dumbbell `chart`, and keeps `slopegraph` for changes in rank order. The showcase and `chiltepin demo` show a dumbbell example.
