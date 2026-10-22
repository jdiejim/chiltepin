```meta
title: Clinic booking use cases
subtitle: Patients book and cancel online, and every booking checks identity and insurance cover before it holds a slot; check-in stays at the desk.
tag: Explanation
status: example
```

Patients and the front desk book through one portal, and each booking runs the same two checks before it holds a slot. A booking that cannot pass both checks in 30 seconds (assumed) holds nothing and asks the patient to call the desk.

## Every booking checks identity and cover before it holds a slot

Booking is the case this page is about. It always finds a free slot, verifies the patient, and asks the insurer for cover. When no slot is free, the patient can join the waiting list instead. A cancellation verifies the patient too, and a late one adds a fee.

```usecase
id: booking
title: The booking portal, and who takes part in each case
system: Booking portal
focus: book
actors:
  - { id: patient, name: Patient }
  - { id: desk, name: Receptionist }
  - { id: timer, name: Reminder timer, kind: time }
  - { id: sms, name: SMS gateway }
  - { id: insurer, name: Insurer API }
cases:
  - { id: book, name: Book appointment }
  - { id: slot, name: Find free slot }
  - { id: verify, name: Verify identity }
  - { id: cover, name: Check insurance cover }
  - { id: wait, name: Join waiting list }
  - { id: cancel, name: Cancel appointment }
  - { id: fee, name: Charge late-cancel fee }
  - { id: remind, name: Send reminder, note: "24 h before the visit" }
  - { id: checkin, name: Check in at the desk }
links:
  - patient -> book
  - patient -> cancel
  - desk -> book
  - desk -> cancel
  - desk -> checkin
  - timer -> remind
  - sms -> remind
  - insurer -> cover
relations:
  - { from: book, to: slot, kind: include }
  - { from: book, to: verify, kind: include }
  - { from: book, to: cover, kind: include }
  - { from: wait, to: book, kind: extend, label: no free slot }
  - { from: cancel, to: verify, kind: include }
  - { from: fee, to: cancel, kind: extend, label: under 24 h before }
```

The SMS gateway and the insurer API stand on the right because they only help a case that a person or the timer starts. The desk books by phone through the same case, so a phone booking runs the same checks as an online one.

## A practice manager can do everything a receptionist can, and more

Staff permissions grow by role. A practice manager is a kind of receptionist: the manager inherits every desk case and adds two of their own. Payment at the desk takes one of two forms.

```usecase
id: roles
title: Desk roles and the two ways to pay
system: Booking portal
actors:
  - { id: desk, name: Receptionist }
  - { id: manager, name: Practice manager }
  - { id: terminal, name: Card terminal, kind: system }
  - { id: insurer, name: Insurer API }
cases:
  - { id: pay, name: Take payment }
  - { id: card, name: Pay by card }
  - { id: claim, name: Bill the insurer }
  - { id: waive, name: Waive late-cancel fee }
  - { id: hours, name: Edit clinic hours }
links:
  - desk -> pay
  - manager -> waive
  - manager -> hours
  - terminal -> card
  - insurer -> claim
relations:
  - { from: manager, to: desk, kind: generalize }
  - { from: card, to: pay, kind: generalize }
  - { from: claim, to: pay, kind: generalize }
```

## Open decisions

```faq
items:
  - q: What happens when the insurer API does not answer in 30 seconds?
    a: "Not decided. The product owner chooses between a held slot with a pending flag and no slot at all."
    open: true
  - q: Who sets the late-cancel window of 24 hours, and may a clinic change it?
    a: "Not decided. The practice managers' group proposes one rule for all clinics."
    open: true
  - q: Does a waiting-list offer verify identity again before it books?
    a: "Not decided. The booking team lead decides before the waiting list ships."
    open: true
```
