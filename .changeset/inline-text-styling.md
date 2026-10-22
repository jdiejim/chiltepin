---
'chiltepin-core': minor
'chiltepin-render': minor
'chiltepin': minor
'chiltepin-studio': patch
---

Prose, table cells, and callout bodies take four inline forms, and the source stays plain Markdown. `==text==` draws a highlight: a wash of the accent behind ink text. `[text]{.teal}` draws text in one of the six category hues, on its tint. `[Beta]{.pill}` draws the status chip; `.todo`, `.done`, `.current`, and `.blocked` pick its outline. `[Ctrl]{.kbd}` draws a key cap, and `:check:` draws a line icon at the size and colour of the text. The class list is closed: the renderer maps an allowed class to its own CSS class, and any other class shows the plain text. The forms render in pages, decks, the PDF, the site, and Studio. A highlight, a hue, and a chip keep their fill in print, and each reads in black and white.

The shared icon set grows from 21 to 63 line icons (arrows, plus, alert, ban, bug, rocket, sparkle, cloud, cpu, globe, mail, phone, chat, calendar, search, settings, code, terminal, git-branch, package, chart, trends, dollar, target, heart, thumbs, bulb, book, home, folder, image, play, pause, refresh, download, upload, external). The `list` and `drivers` `icon` fields take the same names, and `chiltepin block list` prints them. Some paths adapt Lucide (ISC); `THIRD_PARTY_NOTICES.md` has the notice, and the Studio bundle ships it.

Two new warnings come from `lintDocument`, so `check` and Studio both show them. `W_INLINE_UNKNOWN` names an unknown icon, an unknown span class, a span with two styles, or an unknown `icon` field, with a suggestion. `W_HIGHLIGHT_OVERUSE` fires at three highlights in one section. The lint reads prose and every block field in the new core list `INLINE_MD_FIELDS`. Heading anchors, the contents list, the site search index, and the page description keep the plain words. `review` no longer measures an inline icon as a drawing. The skill teaches the forms in `reference/writing.md`, and the showcase has a "Text styling" section.
