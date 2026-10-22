```meta
title: Slide alignment demo
subtitle: How vertical alignment works — auto by default, forced with a {top}/{center}/{bottom} marker.
tag: DEMO · ALIGN
```

# Auto-centered

One short block and no marker, so this slide is **centered** automatically.

```stats
stats:
  - { value: "1", label: Block, trend: flat }
  - { value: "0", label: Markers, trend: flat }
```

# Auto top-aligned

This slide has prose **and** two blocks, so it auto **top-aligns** — dense content
reads better flowing from the top than floating in the middle.

```list
style: accent
items:
  - { lead: No marker here either, text: Alignment is chosen by how heavy the slide is. }
  - { lead: Two blocks plus prose, text: "Heavy, so the slide top-aligns." }
```

```table
columns: [Weight, Alignment]
rows:
  - ["Light (≤1 block, little prose)", Centered]
  - [Heavy (2+ blocks or lots of prose), Top]
```

# Forced top {top}

Same light content as the first slide, but `{top}` in the heading forces it to the
top regardless of weight.

```stats
stats:
  - { value: "{top}", label: Marker used, trend: flat }
```

# Forced centered {center}

```callout
tone: tip
body: "{center} pins a slide to the middle even if it's heavy."
```

# Forced bottom {bottom}

```callout
tone: success
body: "{bottom} drops the content to the bottom of the slide."
```
