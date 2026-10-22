# Generation eval — blind A/B judge

Give this to a FRESH agent per case pair. Substitute the request, the two
document paths, the two full-page screenshots, and the two diagram screenshot
lists. Assign A and B by a coin the judge never sees (the run that is A
changes from case to case), and keep the mapping outside the prompt.

The full-page screenshot is the 400 px page that `chiltepin review` writes
(`<slug>-page-400.png`), or a full-page capture of `chiltepin html <doc>` at
1280 px. `quality.mjs` writes one per document to `<run-dir>/pages/`.

---

You are reviewing two technical documents written for the same request. Each
is Markdown with typed diagram blocks. The page PNG is the whole rendered
document, as a reader sees it; the other PNG files are the rendered diagrams.
Read both documents in full and look at every screenshot (Read tool on each
PNG). Look at the page PNG first: judge the opening and the ending there. Do
not read any other file.

Request: <REQUEST>

Document A: <DOC_A>
Page A: <PAGE_A>
Diagrams A: <SHOTS_A>

Document B: <DOC_B>
Page B: <PAGE_B>
Diagrams B: <SHOTS_B>

Score each document from 1 (poor) to 5 (excellent) on:

- **fidelity** — the diagrams draw what the request describes: its named
  parts, its flows, its failure paths. Nothing the request does not support
  is presented as fact.
- **diagram clarity** — you can follow every arrow from source to target by
  eye; labels sit on their own arrow; no line runs through a box or on top of
  another line; the drawing answers its heading's question at a glance.
- **structure fit** — the document's shape follows this request's questions;
  it does not look like a fixed template that would fit any request.
- **substance** — every sentence and block carries a fact, decision, or
  consequence; no filler, no restating a diagram in prose, no generic
  placeholders. A sentence about the request itself ("The request names no
  model") is filler: the reader never saw the request.
- **opening** — the first screen states the answer: what the system or the
  decision is, in one or two sentences, before any background. A doc that
  opens with context, a definition, or a table of contents scores low.
- **ending** — the last section gives a next step or an owner: who does what
  next, or what to decide and by when. A doc that ends on a summary, a list
  of assumptions, or a restatement scores low.

Then pick the document a senior engineer would rather receive (`A`, `B`, or
`tie`). Judge only what is on the page. Ignore length unless it costs clarity.

Reply with JSON only:

```json
{
  "A": { "fidelity": 0, "clarity": 0, "structure": 0, "substance": 0, "opening": 0, "ending": 0 },
  "B": { "fidelity": 0, "clarity": 0, "structure": 0, "substance": 0, "opening": 0, "ending": 0 },
  "winner": "A",
  "why": "two sentences naming the decisive differences"
}
```
