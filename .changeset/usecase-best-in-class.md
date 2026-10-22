---
'chiltepin-core': minor
'chiltepin-render': minor
'chiltepin': patch
'chiltepin-studio': patch
---

`usecase` diagrams get a new layout. Cases read left to right: a case an actor starts sits in the first column, and an included case, an extension or a specialised case sits one column right of the case it belongs to, level with it. The renderer builds several column plans, orders each one to keep line crossings rare, and keeps the plan that scores best on the lines as drawn. A line never passes a case, an actor or the subject's name: it bends once through a free gap of the column it crosses, and two lines never share one track.

Primary actors stand left of the subject and supporting actors right of it, with no `side` needed. An actor that joins only included or extending cases, or a system that helps a case another actor starts, stands right. A name that ends in system, service, gateway, server, api, database, platform, engine or bot draws as a dashed `«system»` box with the name inside. A person is a stick figure in the people hue, and a time actor is a clock in the compute hue.

`relations` with `kind: generalize` can join two actors: the child actor stands under its parent with a hollow triangle. Several specialisations of one case share one trunk and one triangle. An `«extend»` label shows its condition on a second line.

A new optional `focus` field names the one case the doc is about; that case takes the accent. Each case ellipse grows to hold its full name and note. The legend lists only the relation kinds in play, with what each one means.

`usecase` now reports a link, relation or `focus` that names no actor or case (`E_SCHEMA`), because the renderer dropped such a line with no message. The skill entry and the catalog example show the new fields.
