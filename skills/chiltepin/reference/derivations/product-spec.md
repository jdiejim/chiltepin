# Derivation — garden plot transfer

Part of the **chiltepin** skill. One request, from its facts to its outline.
No YAML on purpose: your request has other facts and gets another outline.

## The inventory

- Our community-garden app manages 140 gardens; the median waitlist is 23
  people.
- Today a plot changes hands by email; position in line is not enforced.
- The feature: a self-serve transfer for the leaving member, automatic
  offers down the waitlist, the coordinator as an approval gate only.
- Rules: 72 hours per offer, at most three offers, then the plot goes
  dormant for review. Declining keeps your position. One plot per member
  per garden. The leaving holder keeps access for up to 14 days.
- Three acceptance criteria in given / when / then form.
- Scope: two capabilities in v1, three out, each with a reason.

Reader: the product team and the engineers, at scope sign-off. They decide
what ships in v1.

## The answer is a proposal

Nothing is built yet, so the opening's first sentence says so and `meta.status` is
`proposal`: "We propose that a leaving member starts the transfer, and the
plot is offered down the waitlist without email. Each offer lasts 72 hours,
and after three declined offers the plot goes dormant for the coordinator."

## The limits, and who chose them

The 72-hour window and the three-offer cap keep a transfer out of the
planting season. Nobody in the request owns them, so the reason goes once
in the flow's `note` and the owner becomes an open question.

## Outline

- **The leaving member starts it; the coordinator only approves** →
  `userstory`, one role and three criteria.
- **An offer moves down the line every 72 hours** → `flow`: the approval,
  the offer loop drawn whole, the cap, two exits. "Declined" back to the
  next offer is a plain `->`; only "expired with no taker" is an error exit.
- **Three rules hold at every step** → `spec`, only the rules the flow
  cannot draw: a decline keeps your place, one plot per member per garden,
  and the leaving holder's access for 14 days.
- **In v1, and not yet** → `table`, in and out per capability.
- **Open at sign-off** → `faq`: who owns the 72-hour and three-offer
  values, and whether the dormant review needs a deadline.

## Left out

- `state` — the plot's lifecycle is not the question; the offer flow is.
- `wireframe` — the request gave no screens.
