---
'chiltepin-core': minor
'chiltepin-render': minor
'chiltepin-studio': patch
---

Charts show the true numbers. A negative value in a `bar`, `line`, `area`, `stacked`, `scatter` or `radar` chart is drawn below a zero line, and a negative waterfall step goes down, so a bridge totals the signed sum. Only the part-of-whole kinds clamp a negative part, and they still print the true value; a gauge or bullet past its scale prints its real number.

One number format serves every numeric block. Ticks share one suffix per axis (`0 · 2M · 4M`), value labels are compact (`1.25M`, `−340k`), exact values are grouped (`2,055,000`), and a byte unit scales (`3.2 GB`).

Chart axes size to their labels. The y gutter is as wide as the widest tick label. Category labels wrap to two lines, thin out on a line chart, or turn, and a `bar` chart with more than ten categories or long labels draws horizontal bars. A value label wider than its bar is dropped.

A `funnel` band is truly proportional, and a label that does not fit its band sits beside it. Each stage also prints its share of the first stage.

Series take the six category hues. Past six series, a line adds a dash and a marker shape and a bar draws hollow. A donut folds slices past six into one "Other". `mindmap` branches take the hue they name, and each branch now gets its own tone.

`okr` prints the true progress (`135%`) and draws a target tick past 100%; every track in a card has the same length. `at risk` is amber.

`bintree` lays nodes out in key order, so no two nodes overlap, and sizes every node from the widest value.

`percentiles` turns its axis log when one tail is over 30 times the smallest median, and labels it. On a linear axis a far tail ends in an arrow with its true value. Dots that would overlap move off the line.

`stats` items take a new `better: up | down` field. The arrow comes from the sign of the delta; the colour comes from `better`. Without `better`, the delta stays neutral, so a latency drop is never red.

`perfbudget` says "below" for a missed floor, prints the true ratio (`5×`) on a cut bar, and shows a near row in amber.

`sankey` ribbons are translucent tints of their source hue, and ribbon values never sit on a stage label or bar. `pyramid` uses one hue ramp in the diagram frame and wraps its `desc`. `roadmap` columns fit the page (at least 56px), months group under quarters past eight periods, the now line sits under the chips, and a short chip's label runs on beside it. `storymap` columns flex to the page width. `chevrons` take their width and text budget from the page. `heatmap` uses quartile steps when one outlier would flatten the rest.

These renderers measure text with the shared pixel estimate (`fitText`, `ellipsize`). A label grows a box or wraps first. A label that must still be cut ends with "…", keeps the whole text in its tooltip, and is reported as a cut with its data path.
