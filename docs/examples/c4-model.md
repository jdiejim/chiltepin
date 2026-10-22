```meta
title: Clinic booking, from context to code
subtitle: One Booking API owns every appointment. It holds a slot for 10 minutes while the patient pays, and the clinic records system stays the source of truth for visits.
tag: ARCHITECTURE · C4 MODEL
status: example
owners: [Booking team]
updated: 2026-10-21
```

Our booking platform lets patients book, move and cancel clinic appointments, and every write goes through one Booking API. The API holds a slot for 10 minutes while the patient pays a deposit, so two patients never pay for the same slot. The names, numbers and vendors in this doc are invented for the example.

## Patients and receptionists use one platform; three outside systems do the rest

Each level of this doc answers one question. At the top, the question is who uses the platform and what it depends on. The platform owns bookings only: patient records, card payments and text messages stay with the systems that already do them well.

```c4
id: booking-context
title: Who uses the booking platform, and what it depends on
level: context
nodes:
  - { id: patient, kind: person, name: Patient, desc: "Books, moves and cancels appointments." }
  - { id: desk, kind: person, name: Receptionist, desc: "Runs the clinic calendar and books walk-ins." }
  - { id: platform, kind: system, name: Booking platform, desc: "Finds free slots, takes deposits and confirms appointments." }
  - { id: records, kind: external, name: Clinic records system, desc: "Holds patient records and clinician calendars." }
  - { id: pay, kind: external, name: Payment provider, desc: "Takes and refunds card deposits." }
  - { id: sms, kind: external, name: SMS gateway, desc: "Delivers text messages to phones." }
edges:
  - { from: patient, to: platform, label: Books appointments using }
  - { from: desk, to: platform, label: Manages clinic calendars using }
  - { from: platform, to: records, label: Reads calendars from and writes visits to }
  - { from: platform, to: pay, label: Takes deposits using }
  - { from: platform, to: sms, label: Sends reminders using }
  - { from: sms, to: patient, label: Texts reminders to }
```

## One Booking API owns every write; reminders leave through a queue

One level down, the question is what runs and who calls whom. The web and mobile apps hold no booking rules: they call the Booking API, and the API alone writes to the bookings database. Reminders go on a queue, so a slow SMS gateway never slows a booking down.

```c4
id: booking-containers
title: The deployable parts of the booking platform
level: container
boundary: { label: Booking platform }
nodes:
  - { id: patient, kind: person, name: Patient, desc: "Books, moves and cancels appointments." }
  - { id: desk, kind: person, name: Receptionist, desc: "Runs the clinic calendar and books walk-ins." }
  - { id: web, kind: container, family: web, name: Web app, tech: "TypeScript, React", desc: "Lets patients book and lets receptionists run the calendar." }
  - { id: mobile, kind: container, family: mobile, name: Mobile app, tech: "Kotlin, Swift", desc: "Lets patients book, move and cancel on a phone." }
  - { id: api, kind: container, name: Booking API, tech: "Go, REST", desc: "Owns every booking: slots, holds, deposits and confirmations." }
  - { id: db, kind: store, name: Bookings database, tech: PostgreSQL 16, desc: "Appointments, slot holds and payment state." }
  - { id: queue, kind: container, family: queue, name: Reminder queue, tech: Amazon SQS, desc: "Keeps each reminder until it is due." }
  - { id: worker, kind: container, name: Reminder worker, tech: Go, desc: "Sends each reminder 24 h and 2 h before the visit." }
  - { id: records, kind: external, name: Clinic records system, desc: "Holds patient records and clinician calendars." }
  - { id: pay, kind: external, name: Payment provider, desc: "Takes and refunds card deposits." }
  - { id: sms, kind: external, name: SMS gateway, desc: "Delivers text messages to phones." }
edges:
  - { from: patient, to: web, label: Books appointments using, tech: HTTPS }
  - { from: patient, to: mobile, label: Books appointments using }
  - { from: desk, to: web, label: Manages clinic calendars using, tech: HTTPS }
  - { from: web, to: api, label: Makes API calls to, tech: JSON/HTTPS }
  - { from: mobile, to: api, label: Makes API calls to, tech: JSON/HTTPS }
  - { from: api, to: db, label: Reads from and writes to, tech: SQL }
  - { from: api, to: records, label: Reads calendars from and writes visits to, tech: FHIR/HTTPS }
  - { from: api, to: pay, label: Takes deposits using, tech: HTTPS }
  - { from: api, to: queue, label: Schedules reminders on, tech: SQS, kind: dashed }
  - { from: queue, to: worker, label: Delivers due reminders to, tech: SQS, kind: dashed }
  - { from: worker, to: sms, label: Sends texts through, tech: HTTPS }
  - { from: sms, to: patient, label: Texts reminders to }
```

## Inside the Booking API, each vendor sits behind its own adapter

Inside the Booking API, the question is where each rule lives. The controller only routes requests. The slot rules live in the hold manager, and each outside system has one adapter, so a change of payment vendor touches one component.

```c4
id: booking-components
title: The components of the Booking API
level: component
boundary: { label: Booking API }
nodes:
  - { id: web, kind: container, family: web, name: Web app, tech: "TypeScript, React", desc: "Lets patients book and lets receptionists run the calendar." }
  - { id: mobile, kind: container, family: mobile, name: Mobile app, tech: "Kotlin, Swift", desc: "Lets patients book, move and cancel on a phone." }
  - { id: ctl, kind: component, name: Booking controller, tech: Go HTTP handler, desc: "Takes book, move and cancel requests." }
  - { id: slots, kind: component, name: Slot finder, tech: Go, desc: "Finds free slots in clinician calendars." }
  - { id: hold, kind: component, name: Hold manager, tech: Go, desc: "Holds a slot for 10 minutes, then confirms or frees it." }
  - { id: payc, kind: component, name: Payment client, tech: Go, desc: "Takes and refunds deposits." }
  - { id: rec, kind: component, name: Records adapter, tech: Go FHIR client, desc: "Reads calendars and writes confirmed visits." }
  - { id: db, kind: store, name: Bookings database, tech: PostgreSQL 16, desc: "Appointments, slot holds and payment state." }
  - { id: records, kind: external, name: Clinic records system, desc: "Holds patient records and clinician calendars." }
  - { id: pay, kind: external, name: Payment provider, desc: "Takes and refunds card deposits." }
edges:
  - { from: web, to: ctl, label: Makes API calls to, tech: JSON/HTTPS }
  - { from: mobile, to: ctl, label: Makes API calls to, tech: JSON/HTTPS }
  - { from: ctl, to: slots, label: Asks for free slots from }
  - { from: ctl, to: hold, label: Holds and confirms slots with }
  - { from: ctl, to: payc, label: Takes deposits with }
  - { from: slots, to: rec, label: Reads calendars through }
  - { from: hold, to: db, label: Reads from and writes to, tech: SQL }
  - { from: payc, to: pay, label: Charges cards with, tech: HTTPS }
  - { from: rec, to: records, label: Reads calendars from and writes visits to, tech: FHIR/HTTPS }
```

## A booking takes the deposit before it writes the visit

The last question is the order of the calls when a patient books. The hold already exists: the hold manager made it when the patient picked the slot. Payment comes first, so the clinic records system never holds a visit that nobody paid for.

```c4
id: booking-dynamic
title: Book and pay for an appointment
level: component
boundary: { label: Booking API }
nodes:
  - { id: web, kind: container, family: web, name: Web app, tech: "TypeScript, React", desc: "Lets patients book and lets receptionists run the calendar." }
  - { id: ctl, kind: component, name: Booking controller, tech: Go HTTP handler, desc: "Takes book, move and cancel requests." }
  - { id: payc, kind: component, name: Payment client, tech: Go, desc: "Takes and refunds deposits." }
  - { id: hold, kind: component, name: Hold manager, tech: Go, desc: "Holds a slot for 10 minutes, then confirms or frees it." }
  - { id: rec, kind: component, name: Records adapter, tech: Go FHIR client, desc: "Reads calendars and writes confirmed visits." }
  - { id: pay, kind: external, name: Payment provider, desc: "Takes and refunds card deposits." }
  - { id: db, kind: store, name: Bookings database, tech: PostgreSQL 16, desc: "Appointments, slot holds and payment state." }
  - { id: records, kind: external, name: Clinic records system, desc: "Holds patient records and clinician calendars." }
edges:
  - { from: web, to: ctl, label: Submits the held slot to, tech: JSON/HTTPS, step: 1 }
  - { from: ctl, to: payc, label: Takes the deposit with, step: 2 }
  - { from: payc, to: pay, label: Charges the card with, tech: HTTPS, step: 3 }
  - { from: ctl, to: hold, label: Confirms the held slot with, step: 4 }
  - { from: hold, to: db, label: Marks the booking paid in, tech: SQL, step: 5 }
  - { from: hold, to: rec, label: Writes the confirmed visit through, step: 6 }
  - { from: rec, to: records, label: Creates the visit in, tech: FHIR/HTTPS, step: 7 }
```

## Two decisions are still open

Both decisions change the dynamic view above, so each has one owner and a date.

```statustable
title: Open decisions
columns: [Decision, Owner, Due]
statuses:
  - { label: Open, color: warn }
  - { label: Proposed, color: info }
rows:
  - { cells: ["Keep the hold at 10 minutes, or give 15 minutes to card checks that ask for a code", Booking team, 2026-11-04], status: Open }
  - { cells: ["When the clinic records system is down, queue the visit write or refund the deposit", Clinic integration team, 2026-11-11], status: Proposed }
```
