# STE discipline — style rules for Chiltepin text

Aerospace maintenance manuals follow rules like these so that a technician who
reads English as a second language cannot read a step in two ways. Our failure
mode is the same: text that looks fluent but means several things. These rules
adapt ASD-STE100 Simplified Technical English to software documentation. They
trade style for one property: each sentence has exactly one reading.

## Vocabulary and terms

- One word, one meaning. If `build` names a command, do not also use it for
  the compiled output.
- One concept, one word. If the doc says `endpoint`, it never says `route`,
  `path`, or `handler` for the same thing.
- Project terms live in a `glossary` block. That block is the approved term
  list for the doc. For every term outside it, use ordinary English.
- Prefer the short common word: use, not utilize; before, not prior to; end,
  not terminate; about, not approximately.

## Sentences

- Length limits: instructions, 20 words at most; descriptive sentences, 25.
- Write one instruction per sentence.
- Instructions are always active voice: "Run `chiltepin check`", never "`chiltepin check`
  should be run". Passive voice is allowed only in descriptive text, and only
  when the actor is truly unknown or irrelevant.
- Use simple tenses: past, present, future. One exception: incident and
  status prose may use the present perfect for a state that started in the
  past and still holds ("Checkout has failed since 09:00"). `W_PROSE_TENSE`
  flags it; keep the sentence. No continuous forms.
- Put the main action first and the condition after it: "Rerun the build if
  the check fails."
- Keep articles and relative pronouns: "Run the check that validates the doc",
  not "Run check validates doc". When you drop these small words, the sentence
  becomes ambiguous.
- Keep noun clusters to 3 words at most. Write "the handler that refreshes
  authentication tokens", not "authentication token refresh handler".
- Do not use an -ing word as a noun or modifier where a verb or clause works.
  Write "when the parser fails", not "on parsing failure".

## Paragraphs

- Descriptive paragraphs hold 6 sentences at most; procedural paragraphs, 3
  (`W_PROSE_LONG_PARAGRAPH` uses the same caps). Most need 2–4.
- Give each paragraph one topic. Announce the topic in the first sentence.
- Put warnings and prerequisites before the step they apply to, never after.

## Rhythm

Short sentences are the rule. A page of them still reads as a list unless
each one connects to the last.

- Open a section by linking it to the previous one: the result it builds
  on, or the question it leaves open.
- Write at most one "so" clause per paragraph. A chain of "X, so Y, not Z"
  sentences reads as a template.
- Write "because" when the cause is the news; lead with the consequence
  when the consequence is the news.
- Give a paragraph one of three supports: an example, a number, or a
  contrast. Not all three, and not none.
- Vary the sentence openings. Three sentences in a row that start with the
  same subject read as a list; join two, or start one with its condition.

## Where each level applies

**Full STE** — procedural and machine-adjacent text: `steps` blocks, CLI help,
`chiltepin check` diagnostics, error messages, MCP tool descriptions, and the skill's
own instructions. A reader parses this text under pressure, and the reader is
sometimes another model. Every rule above applies.

**STE-lite** — `prose`, `callout`, and `pullquote` content, and plain Markdown
paragraphs. Every rule applies except the restricted vocabulary. Prose carries
tradeoffs and consequences; a controlled word list flattens that. Keep the
sentence limits, active voice, and simple tenses, and keep one word per
concept.

**STE-lite, completeness first** — block text fields (`description`, `lede`,
`body`, `note`, `subtitle`, `summary`). The form rules apply, but never delete
a fact to satisfy a length rule. Split a long sentence into two sentences.
Keep every component, value, and condition the field states.

**Not applied** — marketing copy, changelog voice, code comments. Diagram data
(node names, messages, edge labels, states, values) is never edited for style:
the diagram is the data, and it must stay complete.

## Worked pairs

**Pair 1 — a restated diagram (`docs/reference/showcase.md`).**

```
Before: A controller calls OrderService, which loads via an OrderRepository,
charges through a PaymentGateway interface (Stripe/Adyen adapters), and
egresses to Postgres, the event bus, and external gateways.

After:  A Stripe outage needs one config change and no deploy. Every payment
provider sits behind the PaymentGateway interface.
```

The before repeats what the diagram already shows. The after states the
consequence that the diagram cannot show, then the one structural fact
behind it.

**Pair 2 — a lede with three jobs (`resources/orders-api.md`).**

```
Before: Time runs downward. Solid arrows are synchronous requests; dashed are
responses. The order row exists as PENDING only inside the transaction — it is
CONFIRMED before commit, or rolled back to CANCELLED on decline.

After:  An order is never visible as PENDING outside the transaction: it
commits as CONFIRMED or rolls back to CANCELLED. Clients can treat every read
as final.
```

The before teaches notation, describes arrows, and buries the invariant. The
after does one job: the guarantee, and what it lets clients do.

**Pair 3 — the wrapper opener (`docs/reference/showcase.md`).**

```
Before: The blocks below are rendered from typed YAML fences. Edit the source
.md file, rerun `chiltepin html`, and the HTML updates accordingly.

After:  Edit a YAML block to change its diagram. Then run `chiltepin html`. The
.md file is the only source; there is no rendered state to fix by hand.
```

The before is passive, restates the page, and stacks two instructions into one
sentence. The after gives one instruction per sentence, plus the fact that
makes the edit safe.

**Pair 4 — choppy to connected.**

```
Before: The broker redelivers the job after 60 s. The job runs for 90 s.
The worker sends the email. The ledger write happens after the send. The
second worker sends it again.

After:  The broker redelivers a job after 60 s, but a batch runs for 90 s.
Because the worker writes the ledger only after the send, a second worker
finds no record and sends the email again.
```

The before is five true sentences with no links between them; the reader
must build the mechanism. The after keeps every fact and states the one
cause that matters with "because".

## Constraints on how we use STE

- ASD-STE100 is free to obtain but not free to redistribute. Never copy the
  specification text or its ~900-word approved dictionary into this repo. We
  apply the rules and keep our own term list.
- Never claim Chiltepin output "is STE" or "is STE-compliant". Write
  "STE-informed" or "follows STE writing discipline". Certified compliance
  requires the real dictionary, and we do not ship it.
