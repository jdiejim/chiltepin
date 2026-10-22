---
'chiltepin-render': minor
'chiltepin': minor
'chiltepin-studio': patch
---

`flow` never trims a node label: the cell width grows (one width per grid) until the longest name, sublabel, or decision text fits, and the agent card no longer cuts a two-word name to its first word. Auto-laid-out `flow`, `block` (grid), `c4`, `dfd`, and `state` diagrams with no `dir` switch to top-to-bottom when the left-to-right drawing would be wider than the 1600-unit stage (where a drawing starts to scroll) and top-to-bottom is narrower, so a long chain fits the page instead of hiding its right side. New command `chiltepin shots <file>` writes one PNG per diagram (`--json` for a machine-readable list) and flags a drawing that scrolls or shrinks hard on the page, with the fix in the block's data; `CHILTEPIN_CHROME` points `shots` and `pdf` at a Chromium already on the machine. The skill's review step now opens those images.
