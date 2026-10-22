# Chiltepin blocks — Narrative & prose

Part of the **chiltepin** skill (the hub is `SKILL.md`, two folders up).
Run `chiltepin block <type>` for the fields and an example; `chiltepin block`
lists every block by family. Schemas reject unknown fields.

**Shape**: Structure & emphasis — text that must stand out from the page
(`callout`, `pullquote`, `bignumber`, `takeaways`), plus the document frame
(`meta`, `divider`, `prose`, `figure`) and one Containment block (`layers`)
for ordered conceptual tiers.
**Answers**: What must the reader notice or remember? What does this term
mean (`glossary`, `faq`)?
**Not this family**: a row of KPIs → `stats` (tables-data.md); a procedure →
`steps` (flows.md); weighing a choice → `options` (business.md) or
`proscons` (planning.md); an ordinary bullet list → `list` (planning.md).

### Narrative & prose

#### `meta` — document cover (first block only)
Title, subtitle, tag pill, and an optional logo (absolute https URL).
Answers: what is this document? One `meta` per doc, always first; `divider`
for a cover inside the doc.
#### `prose` — structured prose (heading / paragraph / list / quote)
Headings, paragraphs, lists, and quotes carried as data. Answers: what is
the context? Plain Markdown outside blocks does the same job; use `prose`
when the text must live inside a block, such as a `gallery` cell.
#### `callout` — note / tip / warning / danger
One aside with a tone band. Bare text with no `field:` lines is the body.
Answers: what must the reader notice here? `callout` for one aside;
`takeaways` for the closing list; `faq` for several questions.
#### `glossary` — term / definition rows
Term → definition rows. Answers: what does this word mean in this doc?
The object form adds `avoid`, the words the doc must not use instead;
`chiltepin check` flags an avoided word anywhere in the doc's prose
(`W_PROSE_TERM_DRIFT`). This makes the glossary the approved term list.
#### `figure` — an image with a caption
A real image with alt text and a caption. Answers: what did it look like?
`figure` only for screenshots, photos, and exports from other tools.
Anything the renderer can draw belongs in a typed diagram block.
#### `faq` — Q&A accordions (native details, no JS)
One accordion per question; `open: true` starts one expanded. Blank lines in
an answer become paragraphs. Answers: what do readers ask?
`faq`, not `glossary`, for questions; `callout` for a single aside.
#### `divider` — a full-width section break ("PART 2")
A band with a mono kicker, a title, and a subtitle. Answers: where does the
next part start? In a deck, put a `divider` alone under its own `##`
heading and it becomes an interstitial slide.
#### `bignumber` — one hero metric that carries the slide
One value with a label, context, and a delta. Quote numeric-looking values
(`"-75%"`). Answers: what is the one number? The trend arrow is neutral
gray on purpose: "down" is often good. `bignumber` for ONE number; `stats`
for a row of KPIs.
#### `takeaways` — the 2-6 things to remember
Numbered bold one-liners, each with an optional detail line. Answers: what
should the reader remember? The natural closing slide of a deck.
`takeaways` to close; `list` for ordinary bullets inside a document.
#### `pullquote` — a standout quote
Bare text is the quote; lead with `text:` / `attribution:` for fields.
Answers: whose words frame this section? `pullquote` for a quote; `callout`
for an aside.
#### `layers` — a layered explanation (N numbered layers)
Numbered tiers, each with a kicker, a source, a question, and a body.
Answers: which tier answers which question? `layers`, not `table`, when the
content reads as ordered tiers (an L1 / L2 / L3 model); `block` with
`layers:` when arrows join the tiers.
