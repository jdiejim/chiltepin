```meta
title: Aurora design system
subtitle: Tokens, type, usage rules, and component status for product teams.
tag: Design system · v2
status: example
```

## Color tokens

```palette
id: ds-tokens
title: Core palette
cols: 4
colors:
  - { name: Primary, value: "#0e54a1", usage: Buttons and links }
  - { name: Ink, value: "#1F2937", usage: Body text }
  - { name: Surface, value: "#F6F8FB", usage: Card backgrounds }
  - { name: Positive, value: "#1F9747", usage: Success states }
```

## Type scale

```typescale
id: ds-type
items:
  - { name: Display, size: 40, weight: 700, font: display }
  - { name: Heading, size: 24, weight: 700, font: display }
  - { name: Body, size: 15, lineHeight: 1.6 }
  - { name: Caption, size: 12, weight: 500, note: secondary text }
```

## Usage guidelines

```dodont
id: ds-button-usage
title: Button usage
dos:
  - { text: Use one primary button per view }
  - { text: Write labels as verbs, example: "Save changes" }
donts:
  - { text: Stack two primary buttons side by side }
  - { text: Disable a button without explaining why, example: "tooltip: Add a line item first" }
```

## Component status

```inventory
id: ds-components
title: Component inventory
items:
  - { name: Button, status: stable, tag: v2 }
  - { name: Data table, status: beta, note: API may change before GA }
  - { name: Date picker, status: experimental }
  - { name: Modal (legacy), status: deprecated, note: Use Dialog instead }
```

## Key screen

```wireframe
id: ds-key-screen
title: The settings pattern
screens:
  - device: browser
    title: Settings
    url: app.example.com/settings
    elements:
      - { type: nav, label: "Profile, Billing, Team" }
      - { type: header, label: Billing }
      - { type: list, rows: 3 }
      - { type: button, label: Update plan }
```
