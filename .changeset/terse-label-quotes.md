---
'chiltepin-core': patch
'chiltepin-studio': patch
---

A terse edge or message line quoted whole for YAML (`'a -> b: "yes"'`) no longer keeps the inner quote marks in its label. One pair of matching quotes around the label is removed, so the line reads the same as the unquoted mapping form.
