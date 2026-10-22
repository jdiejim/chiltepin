---
'chiltepin-core': minor
'chiltepin-render': minor
'chiltepin': minor
'chiltepin-studio': patch
---

The page now has one heading system: your `##` and `###` headings. A block `title` becomes its figure caption, "Fig. N · title", in the frame's head row or on a caption line above the block. Figures take numbers in document order. A `lede` shows above the figure. Pages no longer show the "SECTION NN · TYPE" label; decks keep it.

Each `##` and `###` heading gets a stable id and a `#` link. The ids come from the new `headingSlug` and `headingIds` exports in `chiltepin-core`, with block ids reserved. A long page gets a table of contents with a figure list: a sticky rail at 1200px and wider, and a collapsed list on narrower screens. The page also gets a "Back to top" link.

The `meta` block takes new optional fields: `status` (draft, proposal, review, accepted, superseded, deprecated, example), `owners`, `reviewers`, `updated`, and `version`. The cover shows them in a meta row and a facts strip, with "N min read · N figures". The page emits a `description` meta tag and Open Graph tags from the subtitle.

On a phone, the gutters are 16px. A diagram never shrinks below 0.62 of its size: its stage scrolls sideways and fades at the hidden edge. Tables, the status table, and the journey scroll in their own box, so the page never scrolls sideways. Layers, risk, stories, pattern, and typescale rows stack.

In print and PDF, nothing clips. Scroll boxes print in full and wrap, and code wraps. Figures, callouts, code, and tables stay together, and a heading stays with the block after it. The SVG text halo is off on paper, so the PDF text layer no longer holds each label twice. `chiltepin pdf` uses the page's A4 size and margins, and adds a running header with the doc title, a "page X / Y" footer, and PDF bookmarks.

The error colour is now a crimson, so it is clearly different from the accent. A new warn role, built on the amber hue, colours warn callouts, warn options and cells, the SLO warn tier, and amber status chips. Status chips named by colour use the category hues. A success callout is green. Agenda owners and mitigating risks are muted chips. An error edge has a cross before its arrowhead, so it reads as an error in greyscale.

Block fixes: a long bignumber value steps down in size. Typescale draws each style at its true size and says when it scales one down. The journey curve aligns with its stage columns, reads −1…1 around a midline, and sits in a frame. A wide diagram in a gallery takes the whole row, and captions in a row align. Palette swatches have an edge ring, alpha colours show a checkerboard, and an unresolved `var()` shows a hatched swatch. Long do/don't examples and anatomy segments wrap. `felogic` with `variant: be` is labelled "Backend logic".
