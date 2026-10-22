import { HUES } from './svg/hues.js';

/**
 * The house CSS — ported verbatim from `resources/doc-studio.jsx`.
 *
 * All output is namespaced under `.docskin` so the stylesheet can coexist with
 * a host page's own styles. Every colour is a CSS variable on `:root`. Dark is
 * the default look; `data-theme="light"` (or print) switches to the light set.
 *
 * Exported as a single string so it can be inlined into a `<style>` tag in the
 * standalone HTML produced by {@link renderDocument} (or copied verbatim into
 * a static stylesheet).
 */
/**
 * The two token sets. Dark is the look: the bare `:root` carries it, so every
 * page, deck, site page, and Studio canvas is dark unless something says
 * otherwise. Light is the explicit choice — `data-theme="light"` on the root
 * (or on a `.docskin`), `colorScheme: light` in the config — and the print
 * look, always. `systemSchemeCss` is appended only when a page asks to follow
 * the reader's OS (`colorScheme: system`).
 *
 * Hex lives only in these two constants and the base block below; every rule
 * after them names a role (`var(--ink)`), never a value (`no-hex.test.ts`).
 */
export const LIGHT_SET = `  /* The skin's role tokens (packages/render/DESIGN.md). Renderers name the
     role, never the value; the dark set overrides these on :root. */
  --paper:#f7f6f2; --paper-2:#efede8; --ink:#1f2430; --muted:#4f5868; --soft:#5f6876;
  --rule:rgba(31,36,48,.14); --rule-solid:#807b70; --rule-table:rgba(31,36,48,.32);
  --accent:#b04a25; --accent-tint:rgba(176,74,37,.09); --link:#2f5c8f;
  --negative:#ad1f45; --negative-tint:rgba(173,31,69,.08);
  /* Tone steps between paper-2 and ink (heatmap ramp: paper → paper-2 → ink-3 → ink-2 → ink). Fills only, never text. */
  --ink-2:#5d6067; --ink-3:#9c9d9e;
  /* Chart series ramp: five desaturated hues for categorical series. Text never sits on them directly — use a paper mask. */
  --series-1:#788a6a; --series-2:#5e7a9b; --series-3:#a37c45; --series-4:#9c6b50; --series-5:#6e6479;
  /* Category hues (DESIGN.md › Two channels): one per node family, picked by kind or group, never per node.
     Each clears 4.5:1 as small text on paper, paper-2 and its own tint. The tint is opaque (hue over paper)
     so a node fill still hides what runs beneath it. */
  --hue-blue:#30609a; --hue-green:#3a6c45; --hue-amber:#7f5e1a; --hue-violet:#664ea0; --hue-teal:#296966; --hue-rose:#9e3f74;
  --hue-blue-tint:#e5e9ea; --hue-green-tint:#e6eae2; --hue-amber-tint:#ece8df; --hue-violet-tint:#eae7eb; --hue-teal-tint:#e4e9e5; --hue-rose-tint:#efe6e7;
  /* Warn: "near the limit", never an error. Built on the amber hue so it reads apart from negative and accent. */
  --warn:var(--hue-amber); --warn-tint:var(--hue-amber-tint);
  /* The code surface is the one deliberate dark panel in both themes; every token colour clears 4.5:1 on it. */
  --code-bg:#1f2430; --code-fg:#f7f6f2; --code-muted:#9aa3b5; --code-rule:rgba(247,246,242,.12);
  --code-kw:#d7a8e8; --code-str:#b5cfa6; --code-num:#e8c58f; --code-fn:#8fbde6; --code-ty:#e6cf8f; --code-com:#9aa3b5;
  --code-add:#b5cfa6; --code-add-bg:rgba(181,207,166,.14); --code-del:#e6b3ab; --code-del-bg:rgba(230,179,171,.14);
  --stage:#f3f1ec; --stage-glow:rgba(255,255,255,.6);
`;

export const DARK_SET = `  --paper:#15171d; --paper-2:#1d2028; --ink:#eceae4; --muted:#b4bac6; --soft:#9da5b3;
  --rule:rgba(236,234,228,.13); --rule-solid:#7d8499; --rule-table:rgba(236,234,228,.28);
  --accent:#e4744c; --accent-tint:rgba(228,116,76,.14); --link:#93b7e8;
  --negative:#f58ca3; --negative-tint:rgba(245,140,163,.14);
  --ink-2:#adadab; --ink-3:#62646a;
  --series-1:#9db08f; --series-2:#8aa6c6; --series-3:#d1ac72; --series-4:#c48c72; --series-5:#a094ab;
  --hue-blue:#8fb0e2; --hue-green:#93c29c; --hue-amber:#d6b06a; --hue-violet:#b7a2e6; --hue-teal:#76bfba; --hue-rose:#e39cc6;
  --hue-blue-tint:#242935; --hue-green-tint:#242c2c; --hue-amber-tint:#2c2926; --hue-violet-tint:#282835; --hue-teal-tint:#212b30; --hue-rose-tint:#2e2731;
  --warn:var(--hue-amber); --warn-tint:var(--hue-amber-tint);
  --code-bg:#0e1015; --code-fg:#eceae4;
  /* The drawing well: a step below the panel, with a faint lift at the centre. */
  --stage:#121419; --stage-glow:rgba(236,234,228,.05);
`;

/**
 * The category-hue modifiers (DESIGN.md › Two channels): `.c-<hue>` colours a
 * chip, a group tab, or a legend chip the way `.c-accent` colours the focal
 * mark. A legend chip also takes the hue's outline and tint, so it reads as a
 * small copy of the node it stands for.
 */
const hueCss = HUES.map(
  (h) =>
    `.docskin .c-${h}{fill:var(--hue-${h});color:var(--hue-${h});}\n` +
    `.docskin .lg-chip.c-${h}{color:var(--hue-${h});border-color:var(--hue-${h});background:var(--hue-${h}-tint);}`,
).join('\n');

/** The reader's OS picks the set — used only for `colorScheme: system`. */
export const systemSchemeCss = `@media (prefers-color-scheme: light){:root:not([data-theme="dark"]){${LIGHT_SET}  color-scheme:light;}}`;

export const houseCss = `*{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
/* Design tokens live on :root so an override (applied on :root) reaches
   the whole page — body chrome included, not just .docskin content. */
:root{
${LIGHT_SET}${DARK_SET}  color-scheme:dark;
  /* Figure scale: decks set it on the slide root to enlarge small diagrams. */
  --scale:1;
  /* Legacy token names — aliases of the roles above so the renderers that
     have not migrated keep working. New code never uses these. */
  --navy:var(--ink); --navy-tint:var(--paper-2); --blue:var(--link); --light-blue:var(--paper-2);
  --charcoal:var(--ink); --slate:var(--muted); --gray:var(--muted); --light-gray:var(--paper-2);
  --highlight:var(--accent); --highlight-soft:var(--accent-tint);
  --positive:var(--muted); --positive-soft:var(--paper-2); --negative-soft:var(--negative-tint);
  --purple:var(--muted); --purple-soft:var(--paper-2); --teal:var(--muted); --teal-soft:var(--paper-2); --white:var(--paper);
  --radius:6px;
  --font-display:"Inter","SF Pro Display",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  --font-body:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
  --font-mono:"SF Mono",ui-monospace,Menlo,Consolas,"Courier New",monospace;}
/* Light: the explicit choice (a root or docskin stamp) and the print look. */
:root[data-theme="light"],[data-theme="light"] .docskin,.docskin[data-theme="light"]{
${LIGHT_SET}  color-scheme:light;
}
:root[data-theme="dark"],[data-theme="dark"] .docskin,.docskin[data-theme="dark"]{
${DARK_SET}  color-scheme:dark;
}
@media print{
  :root{
${LIGHT_SET}    color-scheme:light;
  }
}
body{background:var(--white);color:var(--charcoal);font-family:var(--font-body);font-size:15px;line-height:1.6;}
.docskin{
  background:var(--white); color:var(--charcoal); font-family:var(--font-body); font-size:15px; line-height:1.6;
  max-width:var(--page-max,1180px); margin:0 auto; padding:0 56px 128px;
}
.docskin .cover-pad{padding:56px 0 36px;margin-bottom:48px;border-bottom:1px solid var(--rule-solid);}
.docskin .cover-logo{display:block;height:52px;width:auto;max-width:260px;margin:0 0 28px;}
/* The cover reads like an engineering doc header: a meta row (status chip, tag,
   reading time), the title and subtitle, then a facts strip (owners, reviewers,
   updated, version). The status chip is the one coloured mark on the cover. */
.docskin .cover-meta{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px 16px;font-family:var(--font-mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.14em;color:var(--soft);font-weight:500;margin-bottom:24px;}
.docskin .cover-kind{display:inline-flex;align-items:center;flex-wrap:wrap;gap:8px 14px;}
.docskin .cover-meta .accent{color:var(--muted);}
.docskin .cover-read{color:var(--soft);letter-spacing:.1em;}
.docskin .cover-status{display:inline-block;padding:3px 9px;border:1.5px solid var(--ink);border-radius:3px;background:var(--paper);color:var(--ink);font-weight:600;letter-spacing:.12em;line-height:1.4;}
.docskin .cs-draft{border-style:dashed;border-color:var(--muted);color:var(--muted);}
.docskin .cs-proposal{border-color:var(--warn);color:var(--warn);background:var(--warn-tint);}
.docskin .cs-review{border-color:var(--hue-blue);color:var(--hue-blue);background:var(--hue-blue-tint);}
.docskin .cs-accepted{border-color:var(--hue-green);color:var(--hue-green);background:var(--hue-green-tint);}
.docskin .cs-superseded{border-color:var(--rule-solid);color:var(--muted);background:var(--paper-2);}
.docskin .cs-deprecated{border-color:var(--negative);color:var(--negative);background:var(--negative-tint);}
.docskin .cs-example{border-color:var(--hue-violet);color:var(--hue-violet);background:var(--hue-violet-tint);}
.docskin .cover-title{font-family:var(--font-display);font-weight:700;font-size:clamp(34px,5.2vw,58px);line-height:1.08;letter-spacing:-.018em;color:var(--navy);margin:0 0 18px;overflow-wrap:break-word;}
.docskin .cover-sub{font-size:19px;line-height:1.55;color:var(--slate);max-width:860px;margin:0;}
.docskin .cover-facts{display:flex;flex-wrap:wrap;gap:14px 44px;margin:28px 0 0;padding-top:16px;border-top:1px solid var(--rule);}
.docskin .cover-fact{display:flex;flex-direction:column;gap:5px;min-width:0;}
.docskin .cover-fact dt{color:var(--soft);}
.docskin .cover-fact dd{margin:0;font-size:13.5px;line-height:1.45;color:var(--ink);font-weight:500;}
.docskin .cover-name{white-space:nowrap;}
.docskin .cover-version{font-family:var(--font-mono);font-size:12.5px;}
.docskin.slide.slide-cover .cover-facts{justify-content:center;border-top:0;padding-top:0;}
.docskin .section{padding:0;margin-bottom:64px;}
.docskin .section > *:last-child{margin-bottom:0;}
.docskin .section-num{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:var(--soft);font-weight:700;margin-bottom:8px;}
.docskin .section-head{margin-bottom:28px;padding-bottom:16px;border-bottom:1px solid var(--rule-solid);}
.docskin .section-head.bare{border-bottom:0;padding-bottom:0;margin-bottom:14px;}
.docskin .section-head.bare .section-num{margin-bottom:0;font-size:10px;opacity:.8;}
.docskin .section-head .section-title{border-bottom:0;padding-bottom:0;margin-bottom:14px;}
.docskin .section-title{font-family:var(--font-display);font-weight:700;font-size:clamp(28px,3.6vw,40px);line-height:1.15;letter-spacing:-.01em;color:var(--navy);margin:0 0 14px;padding-bottom:12px;border-bottom:1px solid var(--rule-solid);}
/* The lede: a one-line takeaway above the figure, in the body's voice. */
.docskin .section-lede{font-size:16px;font-weight:500;color:var(--ink);line-height:1.55;max-width:820px;margin:0;}
/* Vertical rhythm (DESIGN.md › Headings and figures): every block sits 24px
   under the text or heading above it and 40px over what follows, whatever its
   own margins say — the section owns the spacing, not the block. A ## after a
   block gets 56px (its margin collapses with the section's). */
.docskin .section-block{margin:24px 0 40px;scroll-margin-top:16px;}
.docskin .section-block:last-child{margin-bottom:0;}
.docskin .section-block>:not(.block-anchor){margin-top:0;}
.docskin .section-block>:last-child{margin-bottom:0;}
.docskin .section-block>.section-lede+*{margin-top:10px;}
.docskin .section-block>.fig-caption+*{margin-top:10px;}
.docskin .block-anchor{position:relative;display:block;height:0;scroll-margin-top:16px;}
/* Figure captions: "Fig. N · title", the block's title. Never larger than the
   body text plus a little; the author's ## and ### are the only headings. */
.docskin .fig-caption{font-family:var(--font-display);font-size:15px;font-weight:700;line-height:1.4;letter-spacing:-.003em;color:var(--ink);scroll-margin-top:20px;}
.docskin p.fig-caption{margin:0;max-width:860px;}
.docskin .fig-num{font-family:var(--font-mono);font-size:10.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap;}
.docskin .fig-sep{color:var(--soft);font-weight:400;}
/* Outline headings carry an id and a # link that shows on hover or focus. */
.docskin .h-anchor{margin-left:.32em;color:var(--soft);font-weight:500;text-decoration:none;opacity:0;transition:opacity .12s;}
.docskin .h-anchor::after{content:"#";}
.docskin :is(h2,h3):hover>.h-anchor,.docskin .h-anchor:focus-visible{opacity:1;}
.docskin .prose :is(h2,h3)[id]{scroll-margin-top:20px;}
.docskin .prose h2:target{border-bottom-color:var(--accent);}
.docskin .diagram{margin:28px 0 36px;border:1px solid var(--rule-solid);background:var(--paper-2);padding:20px 24px 18px;border-radius:6px;box-shadow:none;}
/* The dot grid sits only behind the drawing, never under the text around it. */
.docskin .diagram-stage{background-color:var(--stage);background-image:radial-gradient(var(--rule) 1px,transparent 1px),radial-gradient(ellipse 65% 55% at 50% 42%,var(--stage-glow),transparent 100%);background-size:24px 24px,100% 100%;background-repeat:repeat,no-repeat;background-position:center,center;padding:12px 0;border-radius:4px;box-shadow:inset 0 0 0 1px var(--rule);}
.docskin .diagram-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px;padding-bottom:10px;margin-bottom:14px;border-bottom:1px solid var(--rule);}
.docskin .diagram-eyebrow{display:inline-flex;align-items:baseline;gap:6px;color:var(--soft);}
.docskin .diagram-tag{color:var(--soft);}
.docskin .diagram-tag-sep{color:var(--soft);}
.docskin .diagram-tag-method{color:var(--accent);font-weight:600;}
.docskin .diagram-tag-path{color:var(--muted);text-transform:none;letter-spacing:.02em;font-size:10px;}
.docskin .diagram-title{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--ink);flex:1 1 auto;min-width:0;}
/* A caption leads the head row; the frame's type eyebrow sits quietly at its right. */
.docskin .diagram-title.fig-caption+.diagram-eyebrow{margin-left:auto;}
.docskin .diagram-fignum{font-size:10px;color:var(--soft);text-transform:uppercase;letter-spacing:.1em;font-weight:700;}
.docskin .diagram-desc{font-size:13.5px;line-height:1.5;color:var(--muted);margin:-4px 0 12px;max-width:820px;}
.docskin .diagram svg{display:block;margin:0 auto;max-width:100%;height:auto;}
.docskin .diagram-stage{position:relative;overflow-x:auto;overscroll-behavior-x:contain;}
.docskin .diagram-stage--wide svg{margin:0;}
@media print{.docskin .diagram-stage--wide{overflow:visible;}.docskin .diagram-stage--wide svg{width:auto!important;max-width:100%!important;}}
.docskin.slide .diagram-stage--wide{overflow:visible;}.docskin.slide .diagram-stage--wide svg{width:auto!important;max-width:100%!important;}
/* The scale floor (frame.ts MIN_STAGE_SCALE) is for screens: a slide fits its stage, print fits the page. */
.docskin.slide .diagram-stage svg{min-width:0!important;}
/* Type roles (DESIGN.md › Type roles). Fixed figure sizes; usable on SVG
   <text> (fill) and HTML (color). Every SVG text gets the paper halo so it
   survives crossing a line. */
.docskin .t-name{font-family:var(--font-body);font-size:13px;font-weight:600;fill:var(--ink);color:var(--ink);}
.docskin .t-sub{font-family:var(--font-mono);font-size:10px;font-weight:400;fill:var(--muted);color:var(--muted);}
.docskin .t-eyebrow{font-family:var(--font-mono);font-size:8.5px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;fill:var(--soft);color:var(--soft);}
.docskin .t-arrow{font-family:var(--font-mono);font-size:9.5px;font-weight:400;letter-spacing:.04em;fill:var(--muted);color:var(--muted);}
.docskin .t-badge{font-family:var(--font-mono);font-size:9px;font-weight:600;fill:var(--muted);color:var(--muted);}
.docskin svg .t-name,.docskin svg .t-sub,.docskin svg .t-eyebrow,.docskin svg .t-arrow,.docskin svg .t-badge{paint-order:stroke;stroke:var(--paper);stroke-width:2.5px;stroke-linejoin:round;}
.docskin svg .t-name{stroke-width:3px;}
/* Colour modifiers for the type roles — the only colours a figure spends. */
.docskin .c-ink{fill:var(--ink);color:var(--ink);} .docskin .c-muted{fill:var(--muted);color:var(--muted);} .docskin .c-soft{fill:var(--soft);color:var(--soft);}
.docskin .c-accent{fill:var(--accent);color:var(--accent);} .docskin .c-negative{fill:var(--negative);color:var(--negative);} .docskin .c-link{fill:var(--link);color:var(--link);}
/* Legend strip: a hairline row under the drawing, one item per encoding used. */
.docskin .diagram-legend{display:flex;flex-wrap:wrap;align-items:center;gap:6px 18px;margin-top:12px;padding-top:10px;border-top:1px solid var(--rule);}
.docskin .lg-title{margin-right:2px;}
.docskin .lg-item{display:inline-flex;align-items:center;gap:7px;font-family:var(--font-mono);font-size:10px;letter-spacing:.03em;color:var(--muted);}
.docskin .lg-sw{flex:none;display:block;}
.docskin .lg-chip{display:inline-block;padding:1px 5px;border:1px solid var(--rule-solid);border-radius:2px;background:var(--paper);color:var(--muted);line-height:1.3;}
.docskin .lg-chip.lg-dashed{border-style:dashed;}
${hueCss}
/* sequence — paper actor heads, hairline lifelines, arrows per kind, hollow badges */
.docskin .lane-head{fill:var(--paper);stroke:var(--ink);stroke-width:1.5;} .docskin .lane-head.ext{stroke-dasharray:4 3;}
.docskin .lane-head-text{text-anchor:middle;}
.docskin .lane-head-sub{text-anchor:middle;}
.docskin .lifeline{stroke:var(--rule-solid);stroke-width:1;stroke-dasharray:4 3;}
.docskin .activation{fill:var(--paper-2);stroke:var(--ink);stroke-width:1;}
.docskin .msg-line{stroke:var(--muted);stroke-width:1.5;fill:none;}
.docskin .msg-line.dashed{stroke-dasharray:5 4;} .docskin .msg-line.async{stroke-width:1.25;stroke-dasharray:2 3;}
.docskin .msg-line.err{stroke:var(--negative);} .docskin .msg-line.accent{stroke:var(--accent);stroke-width:1.75;}
.docskin .msg-text.em{fill:var(--ink);} .docskin .msg-text.err{fill:var(--negative);} .docskin .msg-text.note{fill:var(--soft);font-style:italic;} .docskin .msg-text.accent{fill:var(--accent);font-weight:600;}
.docskin .msg-line.self{fill:none;}
/* combined fragments (alt/opt/loop/par/break/critical): a paper-2 panel, a paper tab chip, the guard in brackets */
.docskin .seq-frame{fill:var(--paper-2);fill-opacity:.6;stroke:var(--rule-solid);stroke-width:1;}
.docskin .seq-frame-tab{fill:var(--paper);stroke:var(--rule-solid);stroke-width:1;}
.docskin .seq-frame-else{stroke:var(--rule-solid);stroke-width:1;stroke-dasharray:4 3;}
/* note boxes: paper fill, hairline stroke, folded corner */
.docskin .seq-note{fill:var(--paper);stroke:var(--rule-solid);stroke-width:1;}
.docskin .seq-note-fold{fill:none;stroke:var(--rule-solid);stroke-width:1;}
.docskin .seq-note-text{font-style:italic;}
.docskin .step-badge{fill:var(--paper);stroke:var(--muted);stroke-width:1;} .docskin .step-badge.err{stroke:var(--negative);} .docskin .step-badge.note{stroke-dasharray:2 2;}
.docskin .step-badge-text{text-anchor:middle;fill:var(--ink);}
.docskin .seq-steps{margin-top:16px;padding:14px 18px;background:var(--paper);border:1px solid var(--rule-solid);border-radius:4px;}
.docskin .seq-steps-title{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--soft);font-weight:600;margin-bottom:8px;font-family:var(--font-mono);}
.docskin .seq-steps ol{list-style:none;padding:0;margin:0;}
.docskin .seq-steps li{padding:7px 0 8px 40px;position:relative;border-bottom:1px solid var(--rule);}
.docskin .seq-steps li:last-child{border-bottom:none;}
/* The number is emitted by the renderer (the message's DIAGRAM number, so an
   annotation on step 4 reads ④ here even when steps 1-3 have no note). */
.docskin .seq-steps .step-n{position:absolute;left:2px;top:7px;width:20px;height:20px;border:1px solid var(--muted);border-radius:50%;color:var(--muted);font-family:var(--font-mono);font-size:9px;font-weight:600;text-align:center;line-height:18px;background:var(--paper);}
/* frame dividers mirror the diagram's frames: "ALT · token valid", "else · expired" */
.docskin .seq-steps li.step-frame{padding:8px 0 4px;font-family:var(--font-mono);font-size:10px;color:var(--muted);border-bottom:1px dashed var(--rule);}
.docskin .seq-steps li.step-frame .step-frame-tag{display:inline-block;padding:1px 6px;margin-right:8px;border:1px solid var(--rule-solid);border-radius:2px;background:var(--paper);color:var(--soft);font-size:8.5px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;}
.docskin .seq-steps li.step-frame.else{padding-left:12px;}
.docskin .seq-steps li.err .step-n{border-color:var(--negative);color:var(--negative);} .docskin .seq-steps .step-n.note{border-style:dashed;font-style:italic;}
.docskin .seq-steps li.err{font-family:inherit;font-size:inherit;color:inherit;background:none;border:none;border-bottom:1px solid var(--rule);padding:7px 0 8px 40px;margin:0;white-space:normal;}
.docskin .seq-steps li.err:last-child{border-bottom:none;}
.docskin .diagram-foot{display:flex;flex-wrap:wrap;gap:6px 24px;margin-top:14px;font-size:12.5px;color:var(--ink);}
.docskin .diagram-foot strong{color:var(--muted);font-weight:600;}
.docskin .step-actor{font-family:var(--font-mono);font-size:10px;font-weight:600;color:var(--muted);margin-right:8px;text-transform:uppercase;letter-spacing:.06em;}
.docskin .step-actor.err{color:var(--negative);background:none;border:none;padding:0;margin:0 8px 0 0;font-size:10px;white-space:normal;}
.docskin .step-summary{font-size:13px;color:var(--ink);}
/* c4 */
.docskin .c4-name{font-family:var(--font-display);font-size:14px;font-weight:700;}
.docskin .c4-tech{font-family:var(--font-mono);font-size:9.5px;}
.docskin .c4-desc{font-family:var(--font-body);font-size:11px;font-weight:400;fill:var(--muted);color:var(--muted);}
.docskin svg .c4-desc{paint-order:stroke;stroke:var(--paper);stroke-width:2.5px;stroke-linejoin:round;}
.docskin .c4-chip{font-family:var(--font-body);font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;}
.docskin .edge-label{font-family:var(--font-body);font-size:9.5px;fill:var(--slate);text-anchor:middle;}
.docskin .edge-label.err{fill:var(--negative);font-weight:700;}
/* numbered edge steps (dense diagrams): circled numerals on arrows + legend below */
.docskin .edge-steps{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:12px;padding-top:10px;border-top:1px solid var(--rule);}
.docskin .edge-step{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--slate);}
.docskin .edge-step b{flex:none;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;border:1px solid var(--charcoal);color:var(--charcoal);font-family:var(--font-mono);font-size:10px;font-weight:700;background:var(--white);}
.docskin .edge-step.err{color:var(--negative);}
.docskin .edge-step.err b{border-color:var(--negative);color:var(--negative);}
.docskin .c4-boundary{fill:none;stroke:var(--navy);stroke-width:1.4;stroke-dasharray:8 5;}
.docskin .c4-boundary-label{font-family:var(--font-body);font-size:10px;font-weight:700;fill:var(--navy);letter-spacing:.08em;text-transform:uppercase;}
/* code block */
/* Code surfaces are a dark editor theme everywhere (code block, gallery, sequence). */
.docskin pre{background:var(--code-bg);color:var(--code-fg);padding:18px 20px;font-family:var(--font-mono);font-size:12.5px;line-height:1.65;overflow-x:auto;white-space:pre;margin:0;-moz-tab-size:2;tab-size:2;}
.docskin pre .kw{color:var(--code-kw);font-weight:600;} .docskin pre .com{color:var(--code-com);font-style:italic;}
.docskin pre .str{color:var(--code-str);} .docskin pre .num{color:var(--code-num);} .docskin pre .fn{color:var(--code-fn);} .docskin pre .ty{color:var(--code-ty);}
.docskin .code-block{margin:14px 0 18px;border-radius:6px;overflow:hidden;border:1px solid var(--rule-solid);box-shadow:none;}
.docskin .code-header{display:flex;justify-content:space-between;align-items:center;padding:9px 16px;background:var(--code-bg);color:var(--code-muted);font-family:var(--font-mono);font-size:11px;font-weight:600;letter-spacing:.04em;border-bottom:1px solid var(--code-rule);}
/* Three quiet dots stand in for the traffic lights on full code blocks (not the tighter gallery cards). */
.docskin .code-block>.code-header::before{content:"";flex:none;width:9px;height:9px;border-radius:50%;background:var(--code-muted);box-shadow:15px 0 0 var(--code-muted),30px 0 0 var(--code-muted);opacity:.4;margin-right:38px;}
.docskin .code-block>pre{border-radius:0;}
/* er — paper cards, an eyebrow + name header, mono rows with # (pk) and → (fk) */
.docskin .er-head-text{text-anchor:start;}
.docskin .er-col{font-family:var(--font-mono);font-size:10px;fill:var(--ink);} .docskin .er-col.dim{fill:var(--soft);}
.docskin .er-key{font-family:var(--font-mono);font-size:10px;font-weight:600;fill:var(--muted);}
.docskin .er-rowline{stroke:var(--rule);stroke-width:1;}
.docskin .er-headline{stroke:var(--rule-solid);stroke-width:1;}
.docskin .er-panel{fill:var(--paper-2);stroke:var(--rule-solid);stroke-width:1;}
.docskin .er-panel-tab{fill:var(--soft);}
.docskin .er-card{fill:var(--muted);}
.docskin .er-rel{fill:var(--muted);}
/* block / state / flow shared text */
.docskin .blk-name{font-family:var(--font-display);font-size:13px;font-weight:700;}
.docskin .blk-tech{font-family:var(--font-mono);font-size:9.5px;}
.docskin .blk-chip{font-family:var(--font-body);font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;}
.docskin .grp-label{font-family:var(--font-body);font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;}
.docskin .fc-label{text-anchor:middle;}
.docskin .endpoint-card{border:1px solid var(--rule);margin:16px 0;padding:18px 22px;background:var(--white);}
.docskin .endpoint-header{display:flex;align-items:center;gap:12px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed var(--rule);}
/* The method chip is the card's one accent (DESIGN.md: the endpoint method may take it); DELETE reads as negative. */
.docskin .endpoint-method{font-family:var(--font-mono);font-size:11px;font-weight:600;padding:3px 9px;color:var(--accent);letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--accent);border-radius:3px;background:var(--paper);}
.docskin .endpoint-method.delete{color:var(--negative);border-color:var(--negative);}
.docskin .endpoint-path{font-family:var(--font-mono);font-size:15px;font-weight:700;color:var(--ink);flex:1;}
.docskin .endpoint-status{font-family:var(--font-mono);font-size:11.5px;color:var(--muted);font-weight:700;}
.docskin .endpoint-desc{font-size:13px;color:var(--muted);margin:0 0 8px;}
.docskin .endpoint-card h4{font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;color:var(--muted);margin:14px 0 6px;}
.docskin .endpoint-card ul{margin:0 0 0 20px;} .docskin .endpoint-card li{font-size:13px;margin-bottom:3px;}
.docskin code{font-family:var(--font-mono);font-size:.86em;background:var(--light-gray);padding:2px 6px;border-radius:2px;border:1px solid var(--rule);}
.docskin .transition-table{width:100%;border-collapse:collapse;margin:16px 0 8px;font-size:12px;}
/* Table headers everywhere: a paper-2 band with eyebrow text in muted (4.5:1 floor) — never a dark fill. */
.docskin .transition-table thead{background:var(--paper-2);color:var(--muted);}
.docskin .transition-table th{text-align:left;padding:8px 10px;font-family:var(--font-mono);font-size:9.5px;font-weight:500;text-transform:uppercase;letter-spacing:.12em;border-bottom:1px solid var(--rule-solid);}
.docskin .transition-table td{padding:8px 10px;border-bottom:1px solid var(--rule-table);vertical-align:top;}
.docskin .transition-table td.t-num{width:30px;padding-right:2px;}
/* The state block's transition table sits in a closed <details>: it repeats the diagram. */
.docskin .st-transitions{margin:14px 0 0;} .docskin .st-transitions>summary{cursor:pointer;color:var(--muted);padding:4px 0;} .docskin .st-transitions>.transition-table{margin-top:8px;}
/* Status chips (the one encoding for every status / priority / tone pill in the skin):
   a WORD plus one of — ink outline (default) · paper-2 fill (done / settled) ·
   accent outline (current / recommended) · negative outline (blocked / error) ·
   dashed outline (todo / future / not started). Never a hue per status. */
.docskin .pill{display:inline-block;font-family:var(--font-mono);font-size:10px;font-weight:600;padding:2px 7px;border-radius:3px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink);background:var(--paper);border:1px solid var(--ink);}
.docskin .pill-init{border-style:dashed;border-color:var(--muted);color:var(--muted);}
.docskin .pill-active{border-color:var(--ink);}
.docskin .pill-wait{background:var(--paper-2);border-color:var(--paper-2);}
.docskin .pill-end{border-color:var(--accent);color:var(--accent);}
/* presentation: comparison table */
.docskin .pres-table{width:100%;border-collapse:separate;border-spacing:0;margin:14px 0;font-size:13px;border:1px solid var(--rule-solid);border-radius:6px;overflow:hidden;}
.docskin .pres-table thead{background:var(--paper-2);color:var(--muted);}
.docskin .pres-table th{padding:9px 12px;text-align:left;font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;border-bottom:1px solid var(--rule-solid);}
.docskin .pres-table th.r,.docskin .pres-table td.r{text-align:right;} .docskin .pres-table th.c,.docskin .pres-table td.c{text-align:center;}
.docskin .pres-table th.hi{color:var(--accent);box-shadow:inset 0 -2px 0 var(--accent);}
.docskin .pres-table td{padding:9px 12px;border-bottom:1px solid var(--rule-table);} .docskin .pres-table tbody tr:last-child td{border-bottom:none;}
.docskin .pres-table tbody tr:nth-child(even){background:color-mix(in srgb,var(--paper-2) 50%,transparent);}
.docskin .pres-table td.lead{font-weight:600;color:var(--ink);}
.docskin .pres-table td.hi{background:var(--accent-tint);}
.docskin .ic{display:inline-block;width:1.05em;height:1.05em;vertical-align:-.17em;}
.docskin .cell-pos{color:var(--ink);font-weight:700;} .docskin .cell-neg{color:var(--negative);font-weight:700;} .docskin .cell-warn{color:var(--warn);font-weight:700;} .docskin .cell-muted{color:var(--muted);}
.docskin .badge{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;font-size:12px;font-weight:700;border:1px solid currentColor;background:var(--paper);}
.docskin .badge.yes{color:var(--ink);} .docskin .badge.no{color:var(--negative);}
.docskin .tbl-note{font-size:11px;color:var(--muted);font-style:italic;margin-top:6px;}
/* A wide table scrolls inside its own box on a phone; the page never does. */
.docskin .tbl-scroll{position:relative;overflow-x:auto;margin:14px 0;}
.docskin .tbl-scroll>table{margin:0;}

/* presentation: stat cards */
.docskin .stat-row{display:flex;flex-wrap:wrap;gap:14px;margin:16px 0;}
.docskin .stat-card{flex:1 1 150px;border:1px solid var(--rule-solid);border-top:2px solid var(--ink);padding:16px 18px;background:var(--paper);border-radius:0 0 6px 6px;}
.docskin .stat-value{font-family:var(--font-display);font-size:30px;font-weight:700;color:var(--ink);line-height:1;}
.docskin .stat-label{font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:500;margin-top:8px;}
.docskin .stat-delta{font-family:var(--font-mono);font-size:12px;font-weight:700;margin-top:6px;}
/* The arrow is the sign; the colour is the judgement (better: up or down), never the arrow. */
.docskin .stat-delta.neutral{color:var(--muted);} .docskin .stat-delta.good{color:var(--hue-green);} .docskin .stat-delta.bad{color:var(--negative);}
/* presentation: timeline — hollow dots; done = paper-2 fill, current = the accent, next/future = dashed */
.docskin .tl{position:relative;margin:18px 0;padding-left:8px;}
.docskin .tl::before{content:"";position:absolute;left:9px;top:6px;bottom:6px;width:1px;background:var(--rule-solid);}
.docskin .tl-item{position:relative;padding:0 0 18px 30px;}
.docskin .tl-item:last-child{padding-bottom:0;}
.docskin .tl-dot{position:absolute;left:2px;top:2px;width:16px;height:16px;border-radius:50%;background:var(--paper);border:1.5px solid var(--muted);box-sizing:border-box;}
.docskin .tl-dot.done,.docskin .tl-dot.past{background:var(--paper-2);border-color:var(--ink);} .docskin .tl-dot.current{background:var(--accent);border-color:var(--accent);} .docskin .tl-dot.next,.docskin .tl-dot.future{border-style:dashed;border-color:var(--ink);}
.docskin .tl-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.docskin .tl-date{font-family:var(--font-mono);font-size:10px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;}
/* The status word beside the dot, in the chip encoding. */
.docskin .tl-status{display:inline-block;font-family:var(--font-mono);font-size:8.5px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;padding:1px 6px;border-radius:2px;line-height:1.5;color:var(--ink);background:var(--paper);border:1px solid var(--ink);}
.docskin .tl-status.tl-s-done{background:var(--paper-2);border-color:var(--paper-2);}
.docskin .tl-status.tl-s-current{color:var(--accent);border-color:var(--accent);}
.docskin .tl-status.tl-s-next,.docskin .tl-status.tl-s-future{border-style:dashed;border-color:var(--muted);color:var(--muted);}
.docskin .tl-label{font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--ink);margin:1px 0 2px;}
.docskin .tl-desc{font-size:12.5px;color:var(--muted);}
/* Contents (outline.ts): a sticky rail beside the text from 1200px, a
   collapsed list above the first section below that. Muted links, ink on
   hover; ### entries indent under their ##; the figure list folds away. */
.docskin.has-toc{max-width:calc(var(--page-max,1180px) + 256px);}
.docskin .toc-rail{display:none;}
@media(min-width:1200px){
  .docskin.has-toc{padding-left:40px;padding-right:40px;}
  .docskin .doc-grid{display:grid;grid-template-columns:minmax(0,1fr) 208px;column-gap:48px;align-items:start;}
  .docskin .toc-rail{display:block;position:sticky;top:24px;max-height:calc(100vh - 48px);overflow-y:auto;overscroll-behavior:contain;padding:2px 4px 24px 16px;border-left:1px solid var(--rule);}
  .docskin .toc-inline{display:none;}
}
.docskin .doc-main{min-width:0;}
.docskin .doc-main>.toc-inline:first-child+.prose>:first-child,.docskin .doc-main>.toc-inline:first-child+*{margin-top:0;}
.docskin .toc-label{display:block;margin:0 0 8px;color:var(--soft);}
.docskin .toc-list{list-style:none;margin:0;padding:0;font-size:13px;line-height:1.4;}
.docskin .toc-list li{margin:0;}
.docskin .toc-list a{display:block;padding:4px 0;color:var(--muted);text-decoration:none;overflow-wrap:anywhere;}
.docskin .toc-list a:hover{color:var(--ink);}
.docskin .toc-list a code{font-size:.92em;padding:0 3px;}
.docskin .toc-sub{list-style:none;margin:0 0 4px;padding:0 0 0 12px;border-left:1px solid var(--rule);}
.docskin .toc-sub a{padding:3px 0;font-size:12.5px;color:var(--soft);}
.docskin .toc-figs a{display:flex;align-items:baseline;gap:8px;}
.docskin .toc-fignum{flex:none;min-width:44px;font-family:var(--font-mono);font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--soft);}
.docskin .toc-figlist{margin-top:18px;}
.docskin .toc-figlist>summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:7px;}
.docskin .toc-figlist>summary::-webkit-details-marker{display:none;}
.docskin .toc-figlist>summary::before,.docskin .toc-figlist[open]>summary::before{transform:rotate(90deg);}
.docskin .toc-figlist>summary:hover{color:var(--ink);}
.docskin .toc-figlist .toc-list a{font-size:12.5px;}
.docskin .toc-top{display:inline-block;margin-top:20px;font-family:var(--font-mono);font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--soft);text-decoration:none;}
.docskin .toc-top::before,.docskin .doc-end a::before{content:"\\2191\\00a0";}
.docskin .toc-top:hover,.docskin .doc-end a:hover{color:var(--ink);}
.docskin .toc-inline{margin:0 0 36px;border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper-2);}
.docskin .toc-inline>summary{display:flex;align-items:center;gap:12px;padding:11px 16px;cursor:pointer;list-style:none;}
.docskin .toc-inline>summary::-webkit-details-marker{display:none;}
.docskin .toc-inline>summary::before{content:"";flex:none;width:0;height:0;border-left:5px solid var(--muted);border-top:4px solid transparent;border-bottom:4px solid transparent;transition:transform .15s;}
.docskin .toc-inline[open]>summary::before{transform:rotate(90deg);}
.docskin .toc-count{margin-left:auto;font-family:var(--font-mono);font-size:10.5px;color:var(--soft);}
.docskin .toc-inline-body{padding:12px 16px 16px;border-top:1px solid var(--rule);}
.docskin .toc-inline-body>.toc-label:first-child{display:none;}
.docskin .doc-end{margin:56px 0 0;padding-top:14px;border-top:1px solid var(--rule);font-family:var(--font-mono);font-size:10px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;}
.docskin .doc-end a{color:var(--soft);text-decoration:none;}
/* Scroll boxes: an absolutely placed child (.hv-sr) stays inside, and a box that
   scrolls fades at the edge it hides content behind (scroll-driven, so a box
   that fits shows no fade; browsers without the feature show a plain scroll). */
.docskin [class$="-scroll"],.docskin .ro-strip,.docskin .kanban{position:relative;}
@property --fade-l{syntax:"<length>";inherits:false;initial-value:0px;}
@property --fade-r{syntax:"<length>";inherits:false;initial-value:0px;}
@keyframes docskin-hfade{from{--fade-l:0px;--fade-r:32px;}6%{--fade-l:32px;--fade-r:32px;}94%{--fade-l:32px;--fade-r:32px;}to{--fade-l:32px;--fade-r:0px;}}
@supports (animation-timeline:scroll()){
  .docskin .diagram-stage,.docskin [class$="-scroll"],.docskin .ro-strip,.docskin .kanban{animation:docskin-hfade linear both;animation-timeline:scroll(self inline);-webkit-mask-image:linear-gradient(to right,transparent,black var(--fade-l),black calc(100% - var(--fade-r)),transparent);mask-image:linear-gradient(to right,transparent,black var(--fade-l),black calc(100% - var(--fade-r)),transparent);}
}
/* Phones: 16px gutters, a lighter frame, and prose that wraps a long token instead of pushing the page wide. */
@media(max-width:640px){
  .docskin{padding:0 16px 96px;font-size:15px;}
  .docskin .cover-pad{padding:32px 0 26px;margin-bottom:32px;}
  .docskin .cover-meta{margin-bottom:18px;}
  .docskin .cover-sub{font-size:17px;}
  .docskin .cover-facts{gap:12px 28px;margin-top:22px;}
  .docskin .prose h2{margin-top:44px;}
  .docskin .section-block{margin:20px 0 32px;}
  .docskin .diagram{padding:12px 10px 12px;}
  .docskin .diagram-head{padding-bottom:8px;margin-bottom:10px;}
  .docskin pre{font-size:12px;padding:14px;}
  .docskin .callout{padding:12px 14px;}
  .docskin .toc-inline{margin-bottom:28px;}
}
/* Print and PDF: A4, nothing clipped, no screen chrome. Scroll boxes print in
   full and wrap; figures, callouts, code and tables keep together; a heading
   stays with what follows it. The SVG text halo is off on paper — it doubles
   every label in the PDF text layer; edge labels keep their paper mask. */
@page{size:A4;margin:16mm 14mm 18mm;}
@media print{
  html{scroll-behavior:auto;}
  body,.docskin{background:none;}
  .docskin,.docskin.has-toc{max-width:none;padding:0;}
  .docskin .diagram-stage{background-image:none;}
  .docskin .toc-rail,.docskin .toc-inline,.docskin .doc-end,.docskin .h-anchor{display:none!important;}
  .docskin .doc-grid{display:block!important;}
  .docskin .cover-pad{padding-top:0;margin-bottom:28px;}
  .docskin [class$="-scroll"],.docskin .diagram-stage,.docskin .ro-strip,.docskin .kanban,.docskin .ep-ex,.docskin .a-string{overflow:visible!important;-webkit-mask-image:none!important;mask-image:none!important;animation:none!important;}
  .docskin .ro-strip,.docskin .kanban{flex-wrap:wrap!important;row-gap:10px;}
  .docskin .ro-link{min-width:24px;}
  .docskin .kan-col{min-width:0!important;flex-basis:30%!important;}
  .docskin .hv-sr{overflow:visible!important;clip-path:inset(50%);}
  .docskin pre,.docskin .ep-ex{white-space:pre-wrap!important;overflow-wrap:anywhere;}
  .docskin .diagram-stage svg{min-width:0!important;max-width:100%!important;}
  .docskin table{min-width:0!important;}
  .docskin .sm-colcell{flex-basis:120px!important;}
  .docskin .section-block.is-figure,.docskin .diagram,.docskin .callout,.docskin pre,.docskin table,.docskin .code-block,.docskin .fig,.docskin .pull,.docskin .bn,.docskin tr,.docskin .rk-item,.docskin .op-card,.docskin .slo-item{break-inside:avoid;}
  .docskin h2,.docskin h3,.docskin h4,.docskin .fig-caption,.docskin .section-lede{break-after:avoid;}
  .docskin .section-block>.fig-caption{break-after:avoid;}
  .docskin svg text{paint-order:normal!important;stroke:none!important;}
}
/* callouts */
/* Tones by left rule and title colour: note = hairline · tip = accent · warn = the warn role (amber) · danger = negative · info = link · success = green. Body text is always ink. */
.docskin .callout{border:1px solid var(--rule-solid);padding:14px 18px;margin:14px 0;border-radius:6px;background:var(--paper);}
.docskin .callout.tip{border-left:3px solid var(--accent);border-radius:0 6px 6px 0;} .docskin .callout.warn{border-left:3px solid var(--warn);border-radius:0 6px 6px 0;} .docskin .callout.danger{border-left:3px solid var(--negative);border-radius:0 6px 6px 0;background:var(--negative-tint);} .docskin .callout.info{border-left:3px solid var(--link);border-radius:0 6px 6px 0;} .docskin .callout.success{border-left:3px solid var(--hue-green);border-radius:0 6px 6px 0;}
.docskin .callout-title{font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;margin-bottom:5px;color:var(--muted);}
.docskin .callout.tip .callout-title{color:var(--accent);} .docskin .callout.warn .callout-title{color:var(--warn);} .docskin .callout.danger .callout-title{color:var(--negative);} .docskin .callout.info .callout-title{color:var(--link);} .docskin .callout.success .callout-title{color:var(--hue-green);}
.docskin .callout-body{font-size:14.5px;color:var(--ink);line-height:1.6;}
.docskin .callout-body p{margin:0 0 8px;}
.docskin .callout-body p:last-child{margin-bottom:0;}
/* prose */
/* Markdown pipe tables and links inside prose: the same frame, header, and
   row rules as the table block, so a GFM table never renders bare. */
.docskin .prose table{width:100%;border-collapse:separate;border-spacing:0;margin:18px 0;font-size:13px;border:1px solid var(--rule-solid);border-radius:6px;overflow:hidden;}
.docskin .prose thead th{background:var(--paper-2);color:var(--muted);text-align:left;padding:9px 12px;font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;border-bottom:1px solid var(--rule-solid);}
.docskin .prose td{padding:9px 12px;border-bottom:1px solid var(--rule-table);vertical-align:top;}
.docskin .prose tbody tr:last-child td{border-bottom:none;}
.docskin .prose tbody tr:nth-child(even){background:color-mix(in srgb,var(--paper-2) 50%,transparent);}
.docskin .prose a{color:var(--link);text-decoration:underline;text-underline-offset:2px;text-decoration-color:color-mix(in srgb,var(--link) 50%,transparent);}
.docskin .prose h2{font-family:var(--font-display);font-weight:700;font-size:clamp(24px,3vw,30px);line-height:1.18;letter-spacing:-.015em;color:var(--navy);margin:56px 0 14px;padding-bottom:10px;border-bottom:1px solid var(--rule-solid);}
.docskin .cover-pad+.prose>h2:first-child{margin-top:0;}
.docskin .prose h3{font-family:var(--font-display);font-weight:700;font-size:19px;line-height:1.3;letter-spacing:-.005em;color:var(--navy);margin:36px 0 10px;}
.docskin .prose h2+h3{margin-top:20px;}
.docskin .prose h4{font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;color:var(--muted);margin:22px 0 8px;}
.docskin .prose p{font-size:15.5px;color:var(--charcoal);margin:0 0 14px;line-height:1.65;max-width:820px;overflow-wrap:anywhere;}
.docskin .prose ul,.docskin .prose ol{margin:0 0 14px 22px;}
.docskin .prose li{font-size:15px;color:var(--charcoal);margin-bottom:5px;max-width:820px;line-height:1.6;overflow-wrap:anywhere;}
.docskin .prose blockquote{border-left:2px solid var(--ink);padding:4px 14px;margin:14px 0;color:var(--muted);font-style:italic;font-family:var(--font-display);}
.docskin .prose code{font-family:var(--font-mono);font-size:.86em;background:var(--light-gray);padding:2px 6px;border-radius:2px;color:var(--charcoal);border:1px solid var(--rule);}
.docskin .prose strong{font-weight:700;color:var(--charcoal);}
.docskin .prose em{font-style:italic;}
/* glossary */
/* journey — stages share one column width, so the emotion row's dots sit over their stages; a dashed neutral midline */
.docskin .jr-scroll{position:relative;overflow-x:auto;}
.docskin .jr-table{table-layout:fixed;margin:0;min-width:calc(128px + var(--jr-stages,4) * 104px);}
.docskin .jr-table col.jr-col-label{width:128px;}
.docskin .jr-table td.c,.docskin .jr-table th.c{overflow-wrap:anywhere;}
.docskin .jr-emo th.jr-emo-label{text-align:left;vertical-align:middle;padding:9px 12px;border-top:1px solid var(--rule-solid);background:var(--paper-2);color:var(--muted);}
.docskin .jr-emo td.jr-emo-cell{padding:0;border-top:1px solid var(--rule-solid);background:var(--paper);}
.docskin .jr-emo svg{display:block;width:100%;height:auto;}
.docskin .jr-mid{stroke:var(--rule-solid);stroke-width:1;stroke-dasharray:4 4;}
.docskin .jr>.diagram-legend{margin-top:10px;}
.docskin .glossary{margin:10px 0;}
.docskin .glossary .row{display:grid;grid-template-columns:170px 1fr;gap:14px;padding:9px 0;border-bottom:1px solid var(--rule);}
.docskin .glossary dt{font-family:var(--font-mono);font-size:14px;font-weight:700;color:var(--navy);}
.docskin .glossary dd{margin:0;font-size:14px;color:var(--slate);}
.docskin .glossary .avoid{font-size:12px;color:var(--gray);}
/* pros / cons */
.docskin .pc{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:12px 0;}
.docskin .pc-col{border:1px solid var(--rule-solid);padding:14px 16px;background:var(--paper);border-radius:6px;}
.docskin .pc-col.pro{border-top:2px solid var(--ink);} .docskin .pc-col.con{border-top:2px solid var(--negative);}
.docskin .pc-head{font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;margin-bottom:8px;}
.docskin .pc-col.pro .pc-head{color:var(--muted);} .docskin .pc-col.con .pc-head{color:var(--negative);}
.docskin .pc-item{font-size:13px;color:var(--ink);padding:4px 0 4px 22px;position:relative;}
.docskin .pc-item::before{position:absolute;left:0;top:4px;font-weight:700;}
.docskin .pc-col.pro .pc-item::before{content:"\\2713";color:var(--ink);} .docskin .pc-col.con .pc-item::before{content:"\\2717";color:var(--negative);}
/* current / target */
.docskin .ct{display:flex;align-items:stretch;margin:12px 0;}
.docskin .ct-panel{flex:1;border:1px solid var(--rule);padding:14px 18px;}
.docskin .ct-panel.cur{background:var(--light-gray);} .docskin .ct-panel.tgt{border-top:3px solid var(--navy);}
.docskin .ct-arrow{display:flex;align-items:center;padding:0 14px;color:var(--highlight);font-size:22px;font-weight:700;}
.docskin .ct-label{font-size:11px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;color:var(--gray);margin-bottom:8px;}
.docskin .ct-panel.tgt .ct-label{color:var(--navy);}
.docskin .ct-item{font-size:13px;color:var(--slate);padding:3px 0;}
/* kanban */
.docskin .kanban{display:flex;gap:14px;margin:12px 0;overflow-x:auto;}
.docskin .kan-col{flex:1 1 0;min-width:150px;background:var(--paper-2);border:1px solid var(--rule-solid);border-radius:6px;}
.docskin .kan-head{font-family:var(--font-mono);font-size:9.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-weight:500;padding:9px 12px 7px;border-bottom:1px solid var(--rule);}
.docskin .kan-card{background:var(--paper);border:1px solid var(--rule-solid);margin:8px;padding:9px 11px;border-radius:4px;}
.docskin .kan-card-title{font-size:13px;font-weight:600;color:var(--ink);}
.docskin .kan-card-tag{display:inline-block;font-family:var(--font-mono);font-size:8.5px;font-weight:500;text-transform:uppercase;letter-spacing:.14em;color:var(--muted);margin-top:5px;border:1px solid var(--rule-solid);border-radius:2px;padding:1px 5px;background:var(--paper);}
/* pass 2 chart labels */
.docskin .cycle-center text{font-family:var(--font-mono);font-size:12px;font-weight:600;text-anchor:middle;fill:var(--gray);}
.docskin .pyr-label{font-family:var(--font-display);font-size:12.5px;font-weight:700;fill:var(--ink);text-anchor:middle;}
.docskin .pyr-desc{font-family:var(--font-body);font-size:10px;fill:var(--ink);text-anchor:middle;}
/* indented tree */
.docskin .tree-list{margin:10px 0;font-size:13px;}
.docskin .tree-row{display:flex;align-items:baseline;padding:3px 0;}
.docskin .tree-row .tw{color:var(--gray);margin-right:8px;font-family:var(--font-mono);font-size:11px;}
.docskin .tree-row.branch .tw{color:var(--navy);}
.docskin .tree-row .tlabel{color:var(--charcoal);font-family:var(--font-mono);}
.docskin .tree-row.branch .tlabel{font-weight:700;color:var(--navy);}
.docskin .tree-row .tnote{color:var(--gray);font-size:11px;margin-left:10px;font-family:var(--font-body);font-style:italic;}
/* agenda */
.docskin .agenda{margin:10px 0;}
.docskin .agenda-row{display:grid;grid-template-columns:88px 1fr;gap:14px;padding:10px 0;border-bottom:1px solid var(--rule);}
.docskin .agenda-time{font-family:var(--font-mono);font-size:12px;font-weight:700;color:var(--navy);}
.docskin .agenda-dur{font-family:var(--font-mono);font-size:10px;color:var(--gray);margin-top:2px;}
.docskin .agenda-title{font-family:var(--font-display);font-size:14px;font-weight:700;color:var(--charcoal);}
.docskin .agenda-owner{display:inline-block;font-family:var(--font-mono);font-size:10px;font-weight:500;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-left:8px;padding:1px 6px;border:1px solid var(--rule-solid);border-radius:3px;background:var(--paper);vertical-align:1px;}
.docskin .agenda-desc{font-size:12.5px;color:var(--slate);margin-top:2px;}
/* tracker */
.docskin .trk{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;}
.docskin .trk thead{background:var(--paper-2);color:var(--muted);} .docskin .trk th{padding:8px 10px;text-align:left;font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;border-bottom:1px solid var(--rule-solid);}
.docskin .trk td{padding:8px 10px;border-bottom:1px solid var(--rule-table);vertical-align:middle;}
.docskin .trk tr.done .trk-task{text-decoration:line-through;color:var(--muted);}
.docskin .st{display:inline-block;font-family:var(--font-mono);font-size:9.5px;font-weight:600;padding:2px 8px;border-radius:3px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink);background:var(--paper);border:1px solid var(--ink);}
.docskin .st.todo{border-style:dashed;border-color:var(--muted);color:var(--muted);} .docskin .st.doing{border-color:var(--accent);color:var(--accent);} .docskin .st.done{background:var(--paper-2);border-color:var(--paper-2);} .docskin .st.blocked{border-color:var(--negative);color:var(--negative);}
.docskin .pri{font-family:var(--font-mono);font-size:10px;font-weight:700;} .docskin .pri.high{color:var(--negative);} .docskin .pri.med{color:var(--ink);} .docskin .pri.low{color:var(--muted);}
/* cluster */
.docskin .cl-head{font-family:var(--font-display);font-size:13px;font-weight:700;fill:var(--ink);}
/* user story */
.docskin .story{border:1px solid var(--rule);border-left:4px solid var(--navy);padding:18px 22px;margin:12px 0;background:var(--white);border-radius:0 var(--radius) var(--radius) 0;}
.docskin .story-stmt{font-family:var(--font-display);font-size:18px;line-height:1.55;color:var(--charcoal);}
.docskin .story-stmt b{color:var(--navy);}
.docskin .story-meta{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;}
.docskin .story-chip{font-family:var(--font-mono);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:3px 9px;border-radius:3px;background:var(--light-gray);color:var(--slate);border:1px solid var(--rule);}
.docskin .story-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;}
.docskin .story-title{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-right:auto;}
.docskin .story-chip.pts{background:var(--paper);color:var(--ink);border-color:var(--ink);}
.docskin .ac-title{font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:500;margin:16px 0 8px;}
.docskin .ac-item{border:1px solid var(--rule-solid);padding:10px 14px;margin-bottom:8px;background:var(--paper);border-radius:4px;}
.docskin .gwt{display:grid;grid-template-columns:60px 1fr;gap:4px 12px;font-size:13px;}
.docskin .gwt .k{font-family:var(--font-mono);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;padding-top:1px;color:var(--muted);}
.docskin .gwt .k.t{color:var(--ink);}
.docskin .gwt .v{color:var(--charcoal);}
.docskin .links-row{display:flex;gap:8px;flex-wrap:wrap;}
.docskin .link-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--navy);border:1px solid var(--navy);background:var(--white);padding:5px 11px;border-radius:20px;cursor:pointer;}
.docskin .link-chip .lt{color:var(--gray);font-family:var(--font-mono);font-size:9px;text-transform:uppercase;letter-spacing:.06em;}
a.link-chip,a.st-link{text-decoration:none;color:inherit;}
a.link-chip:hover,a.st-link:hover{text-decoration:underline;}
.docskin .footer{margin-top:8px;padding:18px 32px 28px;border-top:1px solid var(--rule-solid);font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:.1em;font-weight:700;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;}
.docskin .footer .accent{color:var(--highlight);}
.docskin .layer-label{font-family:var(--font-body);font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;}
.docskin .uml-sep{stroke:var(--rule);stroke-width:1;}
/* wireframe / UI mockups */
.docskin .wf-h{font-family:var(--font-display);font-size:18px;font-weight:700;}
.docskin .wf-sub{font-family:var(--font-body);font-size:12px;font-weight:600;}
.docskin .wf-btn{font-family:var(--font-body);font-size:11px;font-weight:700;fill:var(--paper);}
.docskin .wf-btn.on-light{fill:var(--ink);}
.docskin .wf-ph-text{font-family:var(--font-body);font-size:10px;fill:var(--muted);}
.docskin .wf-status{font-family:var(--font-mono);font-size:9px;fill:var(--charcoal);font-weight:700;}
.docskin .wf-url{font-family:var(--font-mono);font-size:8.5px;fill:var(--gray);}
.docskin .wf-tab{font-family:var(--font-body);font-size:8px;}
.docskin .wf-caption{font-family:var(--font-mono);font-size:10px;fill:var(--gray);letter-spacing:.04em;}
/* parse error (the block-level div only; .err modifiers on labels and rows have their own rules) */
.docskin div.err{font-family:var(--font-mono);font-size:12px;color:var(--negative);background:var(--negative-tint);border:1px solid var(--negative);border-radius:4px;padding:8px 12px;margin:12px 0;white-space:pre-wrap;}
/* endpoint (API reference card) */
.docskin .endpoint{border:1px solid var(--rule-solid);border-radius:6px;margin:18px 0;overflow:hidden;background:var(--paper);}
.docskin .ep-head{display:flex;align-items:center;gap:12px;padding:11px 16px;background:var(--paper-2);border-bottom:1px solid var(--rule-solid);flex-wrap:wrap;}
/* The method chip is the card's one accent; DELETE reads as negative. */
.docskin .ep-method{font-family:var(--font-mono);font-size:11px;font-weight:600;color:var(--accent);padding:3px 9px;border-radius:3px;letter-spacing:.08em;border:1px solid var(--accent);background:var(--paper);}
.docskin .ep-method.delete{color:var(--negative);border-color:var(--negative);}
.docskin .ep-path{font-family:var(--font-mono);font-size:14px;font-weight:600;color:var(--ink);} .docskin .ep-path .seg,.docskin .evc-name .seg,.docskin .evc-channel .seg{white-space:nowrap;}
.docskin .ep-auth{margin-left:auto;font-family:var(--font-mono);font-size:10px;font-weight:500;letter-spacing:.02em;color:var(--muted);background:var(--paper);border:1px solid var(--rule-solid);padding:3px 8px;border-radius:3px;}
.docskin .ep-body{padding:6px 16px 14px;}
.docskin .ep-title{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin:10px 0 2px;}
.docskin .ep-desc{font-size:13.5px;color:var(--slate);margin:4px 0 0;line-height:1.55;}
.docskin .ep-section{font-size:10.5px;text-transform:uppercase;letter-spacing:.09em;color:var(--gray);font-weight:700;margin:16px 0 6px;}
.docskin .ep-table{width:100%;border-collapse:collapse;font-size:13px;}
.docskin .ep-table th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--gray);font-weight:700;padding:4px 8px;border-bottom:1px solid var(--rule);}
.docskin .ep-table td{padding:6px 8px;border-bottom:1px solid var(--rule-table);vertical-align:top;color:var(--charcoal);}
.docskin .ep-name{font-family:var(--font-mono);font-weight:600;color:var(--navy);white-space:nowrap;}
.docskin .ep-type{font-family:var(--font-mono);color:var(--slate);font-size:12px;}
.docskin .ep-req{font-family:var(--font-body);font-size:9px;font-weight:700;text-transform:uppercase;color:var(--negative);letter-spacing:.04em;}
.docskin .ep-status{font-family:var(--font-mono);font-weight:600;font-size:12px;padding:1px 8px;border-radius:3px;color:var(--ink);background:var(--paper);border:1px solid var(--ink);}
.docskin .ep-status.ep-2xx{background:var(--paper-2);border-color:var(--paper-2);} .docskin .ep-status.ep-3xx{border-style:dashed;border-color:var(--muted);color:var(--muted);} .docskin .ep-status.ep-5xx{border-color:var(--negative);color:var(--negative);}
.docskin .ep-ex{font-family:var(--font-mono);font-size:12px;line-height:1.5;color:var(--ink);background:var(--paper-2);border:1px solid var(--rule-solid);border-radius:4px;padding:10px 12px;margin:4px 0 0;overflow-x:auto;white-space:pre;}
.docskin .j-key{color:var(--ink);font-weight:600;} .docskin .j-str{color:var(--muted);} .docskin .j-num{color:var(--ink);} .docskin .j-kw{color:var(--accent);font-weight:600;}
/* pullquote */
.docskin .pull{margin:28px 0;padding:18px 24px;background:var(--paper-2);border-left:3px solid var(--accent);border-radius:0 6px 6px 0;}
.docskin .pull-text{font-family:var(--font-display);font-size:18px;line-height:1.45;color:var(--ink);max-width:840px;}
.docskin .pull-attr{margin-top:10px;font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:500;}
/* layers (numbered layer stack) */
.docskin .layer-stack{margin:22px 0;border:1px solid var(--rule-solid);border-radius:6px;overflow:hidden;background:var(--paper);}
.docskin .layer{display:grid;grid-template-columns:48px 168px 1fr;border-bottom:1px solid var(--rule);}
.docskin .layer:last-child{border-bottom:none;}
.docskin .layer-num{background:var(--paper-2);color:var(--ink);border-right:1px solid var(--rule);display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:16px;font-weight:600;}
.docskin .layer-meta{background:var(--paper);padding:13px 15px;border-right:1px solid var(--rule);}
.docskin .layer-kicker{font-family:var(--font-mono);font-size:8.5px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted);font-weight:500;margin-bottom:4px;}
.docskin .layer-title{font-family:var(--font-display);font-size:14px;font-weight:700;color:var(--ink);}
.docskin .layer-src{font-family:var(--font-mono);font-size:10px;color:var(--muted);margin-top:4px;}
.docskin .layer-q{font-family:var(--font-display);font-size:12px;font-style:italic;color:var(--muted);margin-top:8px;line-height:1.35;}
.docskin .layer-body{padding:13px 18px;font-size:13px;line-height:1.55;color:var(--ink);}
@media(max-width:640px){.docskin .layer{grid-template-columns:40px minmax(0,1fr);}.docskin .layer-num{grid-row:span 2;}.docskin .layer-meta{border-right:0;border-bottom:1px solid var(--rule);}.docskin .layer-body{padding:11px 15px;}}
/* matrix (role × resource capability grid) — full = solid ink outline, some = dashed outline, none = muted */
.docskin .matrix{margin:22px 0;}
.docskin .mx-title{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--ink);margin-bottom:2px;}
.docskin .mx-desc{font-size:13px;color:var(--muted);margin:2px 0 10px;line-height:1.5;}
.docskin .mx-scroll{overflow-x:auto;border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);}
.docskin .mx-grid{border-collapse:collapse;width:100%;font-size:13px;}
.docskin .mx-grid th,.docskin .mx-grid td{padding:9px 13px;text-align:center;border-bottom:1px solid var(--rule-table);border-right:1px solid var(--rule-table);}
.docskin .mx-grid tr:last-child th,.docskin .mx-grid tr:last-child td{border-bottom:none;}
.docskin .mx-grid th:last-child,.docskin .mx-grid td:last-child{border-right:none;}
.docskin .mx-grid thead th{background:var(--paper-2);color:var(--muted);font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;}
.docskin .mx-corner{background:var(--paper-2)!important;color:var(--muted)!important;text-align:left;}
.docskin .mx-row{text-align:left;background:var(--paper-2);color:var(--ink);font-weight:600;white-space:nowrap;}
.docskin .mx-cell{font-family:var(--font-mono);font-size:12px;font-weight:600;color:var(--ink);}
.docskin .mx-cell.m-full{outline:1.5px solid var(--ink);outline-offset:-5px;}
.docskin .mx-cell.m-some{outline:1px dashed var(--muted);outline-offset:-5px;}
.docskin .mx-cell.m-none{color:var(--muted);font-weight:400;}
/* anatomy (anatomy of a structured string) */
.docskin .anatomy{margin:24px 0;}
.docskin .a-title{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .a-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .a-string{font-family:var(--font-mono);font-size:clamp(15px,3.6vw,22px);font-weight:700;line-height:1.35;text-align:center;padding:14px;background:var(--paper-2);border:1px solid var(--rule-solid);border-radius:6px;overflow-wrap:anywhere;color:var(--ink);}
.docskin .a-sep{color:var(--muted);margin:0 2px;font-weight:400;}
.docskin .a-cards{display:flex;flex-wrap:wrap;align-items:stretch;gap:0;margin-top:14px;justify-content:center;}
.docskin .a-card{flex:1 1 140px;min-width:120px;max-width:240px;background:var(--paper);border:1px solid var(--rule-solid);border-radius:6px;padding:10px 13px;}
.docskin .a-card-sep{align-self:center;font-family:var(--font-mono);font-size:18px;font-weight:700;color:var(--muted);padding:0 8px;}
.docskin .a-label{font-family:var(--font-mono);font-size:8.5px;text-transform:uppercase;letter-spacing:.14em;font-weight:500;margin-bottom:5px;color:var(--muted);}
.docskin .a-value{font-family:var(--font-mono);font-size:14px;font-weight:600;color:var(--ink);overflow-wrap:anywhere;}
@media(max-width:640px){.docskin .a-card{max-width:none;flex-basis:100%;}.docskin .a-card-sep{flex-basis:100%;text-align:center;padding:2px 0;}}
.docskin .a-note{font-size:12px;color:var(--muted);margin-top:5px;line-height:1.45;}
/* Segments are told apart by their label, not a hue. */
.docskin .a-seg-1,.docskin .a-seg-2,.docskin .a-seg-3,.docskin .a-seg-4{color:var(--ink);}
.docskin .a-label.a-seg-1,.docskin .a-label.a-seg-2,.docskin .a-label.a-seg-3,.docskin .a-label.a-seg-4{color:var(--muted);}
/* composition (layered gates intersected into a result) — the result is the one accent */
.docskin .composition{margin:24px 0;}
.docskin .cp-title{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--ink);margin-bottom:2px;}
.docskin .cp-desc-top{font-size:13px;color:var(--muted);margin:2px 0 14px;line-height:1.5;}
.docskin .cp-row{display:flex;flex-wrap:wrap;align-items:stretch;gap:0;}
.docskin .cp-gate{flex:1 1 150px;min-width:140px;background:var(--paper);border:1px solid var(--rule-solid);border-radius:6px;padding:0 0 12px;overflow:hidden;box-shadow:none;display:flex;flex-direction:column;}
.docskin .cp-gate-head{padding:10px 14px 8px;border-bottom:1px solid var(--rule);background:var(--paper-2);}
.docskin .cp-gate-kicker{font-family:var(--font-mono);font-size:8.5px;text-transform:uppercase;letter-spacing:.14em;font-weight:500;color:var(--muted);margin-bottom:3px;}
.docskin .cp-gate-label{font-family:var(--font-display);font-weight:700;font-size:14px;color:var(--ink);line-height:1.2;}
.docskin .cp-desc{font-size:12px;color:var(--muted);margin:8px 14px 0;line-height:1.45;flex:1;}
.docskin .cp-gate-src{font-family:var(--font-mono);font-size:9.5px;color:var(--muted);margin:8px 14px 0;}
.docskin .cp-op,.docskin .cp-eq{align-self:center;font-family:var(--font-display);font-size:26px;font-weight:700;color:var(--muted);padding:0 12px;}
.docskin .cp-result{flex:1 1 150px;min-width:140px;align-self:stretch;background:var(--paper);border:1.5px solid var(--accent);border-radius:6px;padding:14px;display:flex;flex-direction:column;justify-content:center;}
.docskin .cp-result-kicker{font-family:var(--font-mono);font-size:8.5px;text-transform:uppercase;letter-spacing:.14em;font-weight:500;color:var(--accent);margin-bottom:4px;}
.docskin .cp-result-label{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--ink);line-height:1.2;}
/* drivers (factor card grid) */
.docskin .drivers{margin:24px 0;}
.docskin .dv-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--ink);margin-bottom:2px;}
.docskin .dv-desc{font-size:13px;color:var(--muted);margin:2px 0 12px;line-height:1.5;}
.docskin .dv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;}
.docskin .dv-card{border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);padding:18px 16px;text-align:center;box-shadow:none;}
.docskin .dv-icon{width:38px;height:38px;margin:0 auto 10px;display:block;color:var(--muted);}
.docskin .dv-title{font-family:var(--font-display);font-size:14px;font-weight:700;color:var(--ink);line-height:1.25;margin-bottom:6px;}
.docskin .dv-sub{font-size:11.5px;line-height:1.45;color:var(--muted);}
.docskin .dv-tag{margin-top:8px;font-family:var(--font-mono);font-size:8.5px;font-weight:500;letter-spacing:.14em;color:var(--muted);text-transform:uppercase;}
/* Card accents are ignored by the skin: drivers differ by title and tag, not hue. */
/* options (approaches explored) — the chosen card takes the accent; verdicts are status chips */
.docskin .options{margin:24px 0;}
.docskin .op-headline{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--ink);margin-bottom:2px;}
.docskin .op-desc{font-size:13px;color:var(--muted);margin:2px 0 12px;line-height:1.5;}
.docskin .op-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;align-items:stretch;}
.docskin .op-card{border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);overflow:hidden;display:flex;flex-direction:column;}
.docskin .op-card.is-chosen{border:1.5px solid var(--accent);box-shadow:none;}
.docskin .op-head{padding:12px 14px 10px;color:var(--ink);background:var(--paper-2);border-bottom:1px solid var(--rule);}
.docskin .op-kicker{display:block;font-family:var(--font-mono);font-size:8.5px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin-bottom:4px;}
.docskin .op-card.is-chosen .op-kicker{color:var(--accent);}
.docskin .op-title{font-family:var(--font-display);font-size:14px;font-weight:700;line-height:1.25;color:var(--ink);}
.docskin .op-how{padding:9px 14px;font-size:11.5px;color:var(--ink);background:var(--paper);border-bottom:1px solid var(--rule);line-height:1.45;}
.docskin .op-body{padding:10px 14px 12px;flex:1;}
.docskin .op-list{list-style:none;margin:0 0 8px;padding:0;}
.docskin .op-list li{position:relative;padding-left:18px;font-size:12px;line-height:1.5;color:var(--ink);margin-bottom:5px;}
.docskin .op-list li::before{position:absolute;left:0;top:0;font-weight:700;}
.docskin .op-pros li::before{content:"\\2713";color:var(--ink);}
.docskin .op-cons li::before{content:"\\2717";color:var(--negative);}
.docskin .op-verdict{margin:0 14px 14px;padding:6px 8px;border-radius:3px;font-family:var(--font-mono);font-size:9.5px;font-weight:600;text-align:center;letter-spacing:.06em;text-transform:uppercase;border:1px solid var(--ink);color:var(--ink);background:var(--paper);}
.docskin .op-v-rejected,.docskin .op-v-neutral{border-style:dashed;border-color:var(--muted);color:var(--muted);}
.docskin .op-v-warn{border-color:var(--warn);color:var(--warn);background:var(--warn-tint);}
.docskin .op-v-chosen{border-color:var(--accent);color:var(--accent);}
/* spec (labelled spec sheet) */
.docskin .spec{margin:22px 0;}
.docskin .sp-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--ink);margin-bottom:2px;}
.docskin .sp-desc{font-size:13px;color:var(--muted);margin:2px 0 10px;line-height:1.5;}
.docskin .sp-grid{display:grid;grid-template-columns:140px 1fr;border:1px solid var(--rule-solid);border-radius:6px;overflow:hidden;background:var(--paper);}
.docskin .sp-label{background:var(--paper-2);font-family:var(--font-mono);font-size:8.5px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);padding:12px 16px;border-bottom:1px solid var(--rule);display:flex;align-items:center;}
.docskin .sp-val{padding:12px 16px;font-size:13px;line-height:1.5;color:var(--ink);border-bottom:1px solid var(--rule);}
.docskin .sp-grid > .sp-label:nth-last-child(2),.docskin .sp-grid > .sp-val:last-child{border-bottom:none;}
.docskin .sp-flow{display:flex;flex-wrap:wrap;align-items:center;gap:6px;}
.docskin .sp-step{background:var(--paper);border:1px solid var(--rule-solid);border-radius:3px;padding:4px 9px;font-size:11px;font-weight:600;color:var(--ink);white-space:nowrap;}
.docskin .sp-arrow{color:var(--muted);font-weight:700;}
/* Sheet accents are ignored by the skin. */
/* list (fancy bullet list — accent / check / icon / number styles) */
.docskin .list-block{--ls-accent:var(--ink);--ls-soft:var(--paper-2);margin:22px 0;}
.docskin .ls-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .ls-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .ls-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px;}
.docskin .ls-item{display:flex;align-items:flex-start;gap:12px;}
.docskin .ls-body{display:flex;flex-direction:column;gap:2px;min-width:0;}
.docskin .ls-lead{font-weight:700;color:var(--charcoal);line-height:1.35;}
.docskin .ls-text{font-size:13px;color:var(--slate);line-height:1.5;}
.docskin .ls-mark{flex:none;display:flex;align-items:center;justify-content:center;}
.docskin .ls-style-accent .ls-item{border-left:3px solid var(--ls-accent);padding:1px 0 1px 14px;}
.docskin .ls-style-accent .ls-bar{display:none;}
.docskin .ls-check{width:22px;height:22px;border-radius:50%;font-size:13px;font-weight:700;background:var(--paper-2);color:var(--ink);border:1px solid var(--rule-solid);}
.docskin .ls-check.ls-off{background:var(--paper);color:var(--muted);border-style:dashed;}
.docskin .ls-num{width:24px;height:24px;border-radius:50%;font-family:var(--font-mono);font-size:11px;font-weight:600;background:var(--paper);color:var(--ink);border:1px solid var(--ink);}
.docskin .ls-icon{width:26px;height:26px;border-radius:6px;background:var(--ls-soft);color:var(--ls-accent);}
.docskin .ls-icon svg{width:16px;height:16px;}
/* List accents are ignored by the skin: every list marks in ink on paper-2. */
/* stories (collapsible user-story backlog) */
.docskin .stories{margin:22px 0;}
.docskin .st-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .st-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .st-list{display:flex;flex-direction:column;gap:8px;}
.docskin .st-item{border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);overflow:hidden;}
.docskin .st-summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:12px 14px;}
.docskin .st-summary::-webkit-details-marker{display:none;}
.docskin .st-caret{flex:none;width:0;height:0;border-left:5px solid var(--gray);border-top:4px solid transparent;border-bottom:4px solid transparent;transition:transform .15s;}
.docskin details[open]>.st-summary .st-caret{transform:rotate(90deg);}
.docskin .st-sum-main{display:flex;align-items:center;gap:8px;flex:1;min-width:0;}
.docskin .st-id{font-family:var(--font-mono);font-size:11px;font-weight:600;color:var(--ink);background:var(--paper-2);padding:1px 6px;border-radius:3px;}
.docskin .st-sum-title{font-weight:700;color:var(--ink);overflow-wrap:anywhere;min-width:0;}
.docskin .st-chips{display:flex;gap:6px;flex:none;}
.docskin .st-chip{font-family:var(--font-mono);font-size:10px;font-weight:600;padding:2px 7px;border-radius:3px;letter-spacing:.04em;white-space:nowrap;border:1px solid var(--rule-solid);background:var(--paper);color:var(--muted);}
.docskin .st-points{background:var(--paper-2);border-color:var(--paper-2);color:var(--ink);}
.docskin .st-prio{border-color:var(--ink);color:var(--ink);}
.docskin .st-body{padding:2px 14px 14px 30px;border-top:1px solid var(--rule);}
.docskin .st-narr{margin:12px 0 8px;color:var(--slate);line-height:1.55;font-size:14px;}
.docskin .st-ac-label{font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gray);margin:10px 0 4px;}
.docskin .st-ac{margin:0;padding-left:18px;color:var(--slate);font-size:13px;line-height:1.5;}
.docskin .st-ac li{margin:3px 0;}
.docskin .st-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
@media(max-width:640px){.docskin .st-summary{flex-wrap:wrap;align-items:flex-start;}.docskin .st-sum-main{flex-basis:calc(100% - 20px);flex-wrap:wrap;}.docskin .st-chips{flex-wrap:wrap;margin-left:15px;}.docskin .st-body{padding-left:14px;}}
.docskin .st-link{font-family:var(--font-mono);font-size:11px;color:var(--link);background:var(--paper);border:1px solid var(--rule-solid);padding:2px 8px;border-radius:3px;}
/* pattern (design-pattern reference card) */
.docskin .pattern{margin:22px 0;border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);overflow:hidden;box-shadow:none;}
.docskin .pt-header{display:flex;align-items:center;gap:10px;padding:13px 18px;background:var(--paper-2);color:var(--ink);border-bottom:1px solid var(--rule-solid);}
.docskin .pt-kicker{font-family:var(--font-mono);font-size:8.5px;font-weight:500;letter-spacing:.14em;color:var(--muted);}
.docskin .pt-name{font-family:var(--font-display);font-weight:700;font-size:17px;}
.docskin .pt-cat{margin-left:auto;font-family:var(--font-mono);font-size:9.5px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);background:var(--paper);border:1px solid var(--rule-solid);padding:2px 8px;border-radius:3px;}
.docskin .pt-rows{display:flex;flex-direction:column;}
.docskin .pt-row{display:grid;grid-template-columns:130px 1fr;gap:14px;padding:12px 18px;border-top:1px solid var(--rule);}
.docskin .pt-row:first-child{border-top:none;}
.docskin .pt-label{font-family:var(--font-mono);font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--gray);padding-top:2px;}
.docskin .pt-value{color:var(--charcoal);line-height:1.55;font-size:14px;}
.docskin .pt-chips{display:flex;flex-wrap:wrap;gap:6px;}
.docskin .pt-chip{font-size:12px;background:var(--light-gray);color:var(--slate);padding:2px 9px;border-radius:10px;}
.docskin .pt-parts{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px;}
.docskin .pt-parts li{display:flex;gap:8px;align-items:baseline;}
.docskin .pt-pname{font-weight:700;color:var(--ink);font-size:13px;}
.docskin .pt-prole{color:var(--muted);font-size:13px;}
.docskin .pt-cons{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.docskin .pt-cons-list{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:4px;font-size:13px;line-height:1.45;}
.docskin .pt-cons-list li{display:flex;gap:6px;}
.docskin .pt-sign{font-weight:700;flex:none;}
.docskin .pt-pro .pt-sign{color:var(--ink);}
.docskin .pt-con .pt-sign{color:var(--negative);}
@media(max-width:640px){.docskin .pt-row{grid-template-columns:minmax(0,1fr);gap:4px;padding:11px 14px;}.docskin .pt-cons{grid-template-columns:minmax(0,1fr);gap:10px;}.docskin .pt-header{flex-wrap:wrap;padding:12px 14px;}}
/* gallery (responsive grid of code / note cards) */
.docskin .gallery{margin:22px 0;}
.docskin .gl-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .gl-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .gl-grid{display:grid;grid-template-columns:repeat(var(--gl-cols,2),minmax(0,1fr));gap:14px;align-items:stretch;}
@media(max-width:680px){.docskin .gl-grid{grid-template-columns:1fr;}}
/* A cell is a column: the frame stretches so every caption in a row sits on one line. A drawing too wide for its cell spans the row. */
.docskin .gl-cell{min-width:0;display:flex;flex-direction:column;}
.docskin .gl-cell.gl-span{grid-column:1/-1;}
.docskin .gl-cell .diagram{margin:0;flex:1 1 auto;}
.docskin .gl-cell .gl-card-title{padding:0 0 6px;}
.docskin .gl-cell .gl-cap{padding:8px 2px 0;}
.docskin .gl-card{border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);overflow:hidden;box-shadow:none;display:flex;flex-direction:column;min-width:0;}
.docskin .gl-card>.code-header{border-radius:0;}
.docskin .gl-card>pre{margin:0;border:none;border-radius:0;font-size:11.5px;line-height:1.55;padding:13px 15px;flex:1;}
.docskin .gl-card-title{font-family:var(--font-display);font-weight:700;font-size:13px;color:var(--ink);padding:11px 13px 0;}
.docskin .gl-cap{font-size:12px;color:var(--muted);padding:9px 13px 11px;line-height:1.45;}
/* Card accents are ignored by the skin. */
/* chart (bar / line / area / donut) — the donut's centre figure; every other chart label is a type role */
.docskin .chart-total{font-family:var(--font-display);font-size:22px;font-weight:700;fill:var(--ink);text-anchor:middle;}
/* figure (an image with a caption) */
.docskin .fig{margin:22px 0;border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);padding:14px;box-shadow:none;}
.docskin .fig-img{display:block;max-width:100%;height:auto;border-radius:4px;margin:0 auto;}
.docskin .fig-cap{font-size:13px;color:var(--muted);margin-top:10px;line-height:1.5;}
/* diff (unified diff on the dark editor surface) */
.docskin .diff-pre{padding:14px 0;}
.docskin .df-line{display:block;padding:0 20px;color:var(--code-fg);}
.docskin .df-add{background:var(--code-add-bg);color:var(--code-add);}
.docskin .df-del{background:var(--code-del-bg);color:var(--code-del);}
.docskin .df-hunk{color:var(--code-muted);font-style:italic;}
/* steps (numbered how-to / runbook stepper) */
.docskin .steps{margin:22px 0;}
.docskin .stp-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .stp-desc{font-size:13px;color:var(--slate);margin:2px 0 14px;line-height:1.5;}
.docskin .stp-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;}
.docskin .stp-item{position:relative;display:flex;align-items:flex-start;gap:14px;padding:0 0 22px;}
.docskin .stp-item:last-child{padding-bottom:0;}
.docskin .stp-item::before{content:"";position:absolute;left:12px;top:28px;bottom:2px;width:2px;background:var(--rule);}
.docskin .stp-item:last-child::before{display:none;}
.docskin .stp-num{flex:none;position:relative;z-index:1;width:26px;height:26px;border-radius:50%;background:var(--paper);color:var(--ink);border:1px solid var(--ink);font-family:var(--font-mono);font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;}
.docskin .stp-body{flex:1;min-width:0;padding-top:3px;}
.docskin .stp-title{font-weight:700;font-size:14px;color:var(--ink);line-height:1.35;}
.docskin .stp-text{font-size:13px;color:var(--muted);margin:4px 0 0;line-height:1.55;max-width:760px;}
.docskin .stp-code{margin:10px 0 0;border-radius:6px;overflow:hidden;border:1px solid var(--rule-solid);box-shadow:none;}
.docskin .stp-code-head{padding:6px 14px;background:var(--code-bg);color:var(--code-muted);font-family:var(--font-mono);font-size:10.5px;font-weight:600;letter-spacing:.04em;border-bottom:1px solid var(--code-rule);}
.docskin .stp-code pre{font-size:12px;line-height:1.6;padding:12px 16px;}
.docskin .stp-code pre code{background:transparent;border:none;padding:0;border-radius:0;font-size:inherit;color:inherit;}
.docskin .stp-note{font-size:12px;color:var(--gray);font-style:italic;margin:8px 0 0;line-height:1.5;}
/* faq (Q&A accordions, native details) */
.docskin .faq{margin:22px 0;}
.docskin .fq-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .fq-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .fq-list{display:flex;flex-direction:column;gap:8px;}
.docskin .fq-item{border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);overflow:hidden;}
.docskin .fq-summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;padding:13px 16px;}
.docskin .fq-summary::-webkit-details-marker{display:none;}
.docskin .fq-caret{flex:none;width:0;height:0;border-left:5px solid var(--gray);border-top:4px solid transparent;border-bottom:4px solid transparent;transition:transform .15s;}
.docskin details[open]>.fq-summary .fq-caret{transform:rotate(90deg);}
.docskin .fq-q{font-weight:700;color:var(--charcoal);line-height:1.4;}
.docskin .fq-a{padding:2px 16px 14px 31px;border-top:1px solid var(--rule);font-size:14px;color:var(--slate);line-height:1.6;}
.docskin .fq-a p{margin:10px 0 0;max-width:780px;}
/* envelope (back-of-envelope capacity math) */
.docskin .envelope{margin:22px 0;}
.docskin .env-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .env-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .env-card{border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);padding:18px 22px;box-shadow:none;}
.docskin .env-givens{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 24px;padding-bottom:16px;margin-bottom:14px;border-bottom:1px solid var(--rule);}
.docskin .env-g-label{font-family:var(--font-mono);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--gray);margin-bottom:2px;}
.docskin .env-g-value{font-size:15px;font-weight:700;color:var(--charcoal);}
.docskin .env-steps{display:flex;flex-direction:column;gap:9px;}
.docskin .env-step{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
.docskin .env-s-label{flex:0 0 150px;font-size:13px;color:var(--slate);}
.docskin .env-s-calc{font-family:var(--font-mono);font-size:12.5px;color:var(--charcoal);background:var(--light-gray);border:1px solid var(--rule);border-radius:5px;padding:2px 8px;}
.docskin .env-s-arrow{color:var(--gray);font-weight:700;}
.docskin .env-s-result{font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--ink);}
/* The final figure is the one accent. */
.docskin .env-result{margin-top:16px;padding:12px 16px;background:var(--paper-2);border-left:3px solid var(--accent);border-radius:0 6px 6px 0;}
.docskin .env-r-label{font-family:var(--font-mono);font-size:9.5px;font-weight:500;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);margin-bottom:2px;}
.docskin .env-r-value{font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--ink);line-height:1.25;}
/* slo (service-level objectives with error budgets) */
.docskin .slo{margin:22px 0;}
.docskin .slo-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .slo-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .slo-list{display:flex;flex-direction:column;gap:12px;}
.docskin .slo-item{border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);padding:14px 18px;box-shadow:none;}
.docskin .slo-top{display:flex;align-items:center;gap:10px;}
.docskin .slo-name{font-family:var(--font-display);font-weight:700;font-size:14px;color:var(--charcoal);flex:1;min-width:0;}
.docskin .slo-window{font-family:var(--font-mono);font-size:10px;font-weight:700;color:var(--slate);background:var(--light-gray);border:1px solid var(--rule);border-radius:10px;padding:2px 8px;white-space:nowrap;}
.docskin .slo-sli{font-size:12.5px;color:var(--slate);margin:3px 0 0;line-height:1.5;}
.docskin .slo-vals{display:flex;gap:26px;margin-top:9px;}
.docskin .slo-val{display:flex;flex-direction:column;gap:1px;}
.docskin .slo-v-label{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--gray);}
.docskin .slo-v-num{font-family:var(--font-mono);font-size:14px;font-weight:700;color:var(--charcoal);}
.docskin .slo-v-num.slo-ok{color:var(--ink);}
.docskin .slo-v-num.slo-bad{color:var(--negative);}
.docskin .slo-budget{margin-top:10px;}
.docskin .slo-track{height:8px;border-radius:4px;background:var(--paper-2);border:1px solid var(--rule);overflow:hidden;}
.docskin .slo-fill{height:100%;border-radius:4px;}
/* Budget burn: muted while healthy, the warn role when the caption says it is close, negative only when it is spent. */
.docskin .slo-fill.slo-b-ok{background:var(--muted);}
.docskin .slo-fill.slo-b-warn{background:var(--warn);}
.docskin .slo-fill.slo-b-hot{background:var(--negative);}
.docskin .slo-caption{font-family:var(--font-mono);font-size:11px;color:var(--muted);margin-top:5px;}
/* terminal (a shell session on the dark surface) */
.docskin .terminal-block{border-radius:6px;}
.docskin .tm-pre{line-height:1.7;}
.docskin .tm-line{display:block;}
.docskin .tm-prompt{color:var(--code-str);font-weight:700;}
.docskin .tm-cmd-text{color:var(--code-fg);font-weight:700;}
.docskin .tm-comment{color:var(--code-com);font-style:italic;}
.docskin .tm-out{color:var(--code-muted);}
/* swot (strengths / weaknesses / opportunities / threats 2x2) */
.docskin .swot{margin:22px 0;}
.docskin .swot-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .swot-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .swot-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;}
@media(max-width:680px){.docskin .swot-grid{grid-template-columns:1fr;}}
/* Quadrants are told apart by their label: paper for the internal pair (S, W), paper-2 for the external pair (O, T). */
.docskin .swot-quad{border:1px solid var(--rule-solid);border-radius:6px;padding:13px 16px 14px;box-shadow:none;background:var(--paper);}
.docskin .swot-label{font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;margin-bottom:7px;color:var(--muted);}
.docskin .swot-list{list-style:none;margin:0;padding:0;}
.docskin .swot-item{position:relative;font-size:13px;color:var(--ink);line-height:1.5;padding:2px 0 2px 14px;}
.docskin .swot-item::before{content:"";position:absolute;left:0;top:11px;width:5px;height:5px;border-radius:50%;background:var(--muted);}
.docskin .swot-o,.docskin .swot-t{background:var(--paper-2);}
.docskin .swot-w .swot-label,.docskin .swot-t .swot-label{color:var(--negative);}
/* okr (objectives + key results) */
.docskin .okr{margin:22px 0;}
.docskin .okr-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .okr-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .okr-list{display:flex;flex-direction:column;gap:12px;}
.docskin .okr-item{border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);padding:14px 18px;box-shadow:none;}
.docskin .okr-top{display:flex;align-items:baseline;gap:10px;margin-bottom:10px;}
.docskin .okr-objective{font-family:var(--font-display);font-weight:700;font-size:14.5px;color:var(--charcoal);flex:1;min-width:0;}
.docskin .okr-owner{font-family:var(--font-mono);font-size:10px;font-weight:700;color:var(--slate);background:var(--light-gray);border:1px solid var(--rule);border-radius:10px;padding:2px 8px;white-space:nowrap;}
.docskin .okr-krs{display:flex;flex-direction:column;gap:8px;}
.docskin .okr-kr-text{font-size:13px;color:var(--charcoal);line-height:1.45;}
.docskin .okr-kr-bar{display:grid;grid-template-columns:minmax(0,1fr) 40px 84px;align-items:center;gap:10px;margin-top:3px;}
.docskin .okr-track{position:relative;height:7px;border-radius:4px;background:var(--paper-2);border:1px solid var(--rule);}
.docskin .okr-fill{height:100%;border-radius:4px;background:var(--ink);}
.docskin .okr-fill.okr-b-ok,.docskin .okr-fill.okr-b-plain{background:var(--ink);}
.docskin .okr-fill.okr-b-warn{background:var(--hue-amber);}
.docskin .okr-fill.okr-b-bad{background:var(--negative);}
/* Past the target: a tick at the target mark (the end of the track), standing proud of the bar. */
.docskin .okr-tick{position:absolute;right:-2px;top:-5px;bottom:-5px;width:2px;border-radius:1px;background:var(--ink);box-shadow:0 0 0 1px var(--paper);}
.docskin .okr-pct{font-family:var(--font-mono);font-size:11px;font-weight:700;color:var(--muted);text-align:right;white-space:nowrap;}
.docskin .okr-over + .okr-pct{color:var(--ink);}
/* The KR's status as a word chip (the bar tone alone never carries it). */
.docskin .okr-status{justify-self:start;font-family:var(--font-mono);font-size:9px;font-weight:600;padding:1px 7px;border-radius:3px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink);background:var(--paper);border:1px solid var(--ink);white-space:nowrap;}
.docskin .okr-status.okr-s-done,.docskin .okr-status.okr-s-on-track{background:var(--paper-2);border-color:var(--paper-2);}
.docskin .okr-status.okr-s-at-risk{border-color:var(--hue-amber);color:var(--hue-amber);background:var(--hue-amber-tint);}
.docskin .okr-status.okr-s-off-track{border-color:var(--negative);color:var(--negative);}
/* persona (user persona cards) */
.docskin .persona{margin:22px 0;}
.docskin .pa-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .pa-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .pa-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start;}
@media(max-width:680px){.docskin .pa-grid{grid-template-columns:1fr;}}
.docskin .pa-card{border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);padding:16px 18px;box-shadow:none;}
.docskin .pa-id{display:flex;align-items:center;gap:12px;}
.docskin .pa-avatar{flex:none;width:42px;height:42px;border-radius:50%;background:var(--paper-2);color:var(--ink);border:1px solid var(--rule-solid);font-family:var(--font-display);font-size:15px;font-weight:700;display:flex;align-items:center;justify-content:center;letter-spacing:.02em;}
.docskin .pa-name{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--ink);line-height:1.25;}
.docskin .pa-role{font-size:12px;color:var(--muted);margin-top:1px;}
.docskin .pa-quote{font-family:var(--font-display);font-style:italic;font-size:13px;color:var(--muted);line-height:1.5;margin:12px 0 0;padding:2px 0 2px 12px;border-left:2px solid var(--rule-solid);}
.docskin .pa-section{margin-top:12px;}
.docskin .pa-sec-label{font-family:var(--font-mono);font-size:8.5px;text-transform:uppercase;letter-spacing:.14em;font-weight:500;color:var(--muted);margin-bottom:4px;}
.docskin .pa-list{list-style:none;margin:0;padding:0;}
.docskin .pa-li{position:relative;font-size:12.5px;color:var(--ink);line-height:1.5;padding:1px 0 1px 14px;}
.docskin .pa-li::before{content:"";position:absolute;left:0;top:9px;width:5px;height:5px;border-radius:50%;background:var(--muted);}
.docskin .pa-frustrations .pa-li::before{background:var(--negative);}
.docskin .pa-tools{display:flex;flex-wrap:wrap;gap:6px;}
.docskin .pa-tool{font-family:var(--font-mono);font-size:10.5px;font-weight:600;color:var(--muted);background:var(--paper);border:1px solid var(--rule-solid);border-radius:3px;padding:2px 8px;}
/* Card accents are ignored by the skin. */
/* changelog (release history on a vertical rail) */
.docskin .changelog{margin:22px 0;}
.docskin .cg-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .cg-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .cg-rail{position:relative;padding-left:26px;}
.docskin .cg-rail::before{content:"";position:absolute;left:7px;top:8px;bottom:8px;width:2px;background:var(--rule);}
.docskin .cg-release{position:relative;padding-bottom:20px;}
.docskin .cg-release:last-child{padding-bottom:0;}
.docskin .cg-dot{position:absolute;left:-25px;top:4px;width:12px;height:12px;border-radius:50%;background:var(--paper);border:1.5px solid var(--ink);box-shadow:none;}
.docskin .cg-dot-breaking{border-color:var(--negative);background:var(--negative-tint);}
.docskin .cg-rel-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:7px;}
.docskin .cg-version{font-family:var(--font-mono);font-size:12.5px;font-weight:700;color:var(--ink);background:var(--paper-2);border-radius:3px;padding:2px 9px;}
.docskin .cg-version.cg-v-breaking{background:var(--paper);color:var(--negative);border:1px solid var(--negative);}
.docskin .cg-date{font-size:12px;color:var(--muted);}
.docskin .cg-tag{font-family:var(--font-mono);font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);background:var(--paper);border:1px solid var(--rule-solid);border-radius:3px;padding:2px 8px;}
.docskin .cg-tag-breaking{color:var(--negative);border-color:var(--negative);}
.docskin .cg-items{display:flex;flex-direction:column;gap:5px;}
.docskin .cg-item{display:flex;align-items:baseline;gap:9px;}
/* Change kinds as status chips: added / fixed = paper-2 fill · changed = ink outline · removed / deprecated = dashed · security = negative outline. */
.docskin .cg-type{flex:none;font-family:var(--font-mono);font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;border-radius:3px;padding:1px 7px;color:var(--ink);background:var(--paper);border:1px solid var(--ink);}
.docskin .cg-t-added,.docskin .cg-t-fixed{background:var(--paper-2);border-color:var(--paper-2);}
.docskin .cg-t-removed,.docskin .cg-t-deprecated{border-style:dashed;border-color:var(--muted);color:var(--muted);}
.docskin .cg-t-security{border-color:var(--negative);color:var(--negative);}
.docskin .cg-text{font-size:13px;color:var(--ink);line-height:1.5;}
/* team (compact people cards) */
.docskin .team{margin:22px 0;}
.docskin .tem-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .tem-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .tem-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;align-items:stretch;}
@media(max-width:900px){.docskin .tem-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media(max-width:680px){.docskin .tem-grid{grid-template-columns:1fr;}}
.docskin .tem-card{border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);padding:16px 16px 14px;text-align:center;box-shadow:none;}
.docskin .tem-avatar{width:40px;height:40px;border-radius:50%;background:var(--paper-2);color:var(--ink);border:1px solid var(--rule-solid);font-family:var(--font-display);font-size:14px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;letter-spacing:.02em;margin-bottom:9px;}
.docskin .tem-name{font-family:var(--font-display);font-weight:700;font-size:14px;color:var(--ink);line-height:1.3;}
.docskin .tem-role{font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;color:var(--muted);margin-top:2px;}
.docskin .tem-focus{font-size:12.5px;color:var(--muted);line-height:1.45;margin-top:6px;}
/* Card accents are ignored by the skin. */
/* heatmap (numeric grid with an intensity ramp) */
.docskin .heatmap{margin:22px 0;}
.docskin .hm-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .hm-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .hm-scroll{overflow-x:auto;border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);padding:14px 16px;box-shadow:none;}
.docskin .hm-grid{display:grid;gap:4px;min-width:0;}
.docskin .hm-corner{min-width:0;}
.docskin .hm-col{font-family:var(--font-mono);font-size:11px;font-weight:700;color:var(--gray);text-align:center;align-self:end;padding-bottom:2px;white-space:nowrap;}
.docskin .hm-rowlabel{font-size:12px;font-weight:600;color:var(--charcoal);text-align:right;align-self:center;padding-right:8px;white-space:nowrap;}
.docskin .hm-cell{font-family:var(--font-mono);font-size:11px;font-weight:600;color:var(--charcoal);border-radius:6px;min-height:32px;display:flex;align-items:center;justify-content:center;}
.docskin .hm-cell.hm-blank{background:var(--paper-2);}
/* scorecard (weighted decision matrix) — the winner takes the accent */
.docskin .scorecard{margin:22px 0;}
.docskin .sc-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--ink);margin-bottom:2px;}
.docskin .sc-desc{font-size:13px;color:var(--muted);margin:2px 0 12px;line-height:1.5;}
.docskin .sc-scroll{overflow-x:auto;border:1px solid var(--rule-solid);border-radius:6px;box-shadow:none;}
.docskin .sc-table{width:100%;border-collapse:collapse;font-size:13px;background:var(--paper);}
.docskin .sc-table thead th{background:var(--paper-2);color:var(--muted);padding:10px 12px;text-align:left;font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;vertical-align:top;border-bottom:1px solid var(--rule-solid);}
.docskin .sc-table th.c,.docskin .sc-table td.c{text-align:center;}
.docskin .sc-table thead th.sc-win{color:var(--accent);box-shadow:inset 0 -2px 0 var(--accent);}
.docskin .sc-table td{padding:9px 12px;border-bottom:1px solid var(--rule-table);color:var(--ink);}
.docskin .sc-crit{font-weight:600;color:var(--ink);}
.docskin .sc-weight{display:inline-block;font-family:var(--font-mono);font-size:9.5px;font-weight:600;color:var(--ink);background:var(--paper);border:1px solid var(--rule-solid);border-radius:3px;padding:1px 6px;margin-left:8px;}
.docskin .sc-score{font-family:var(--font-mono);font-weight:600;}
.docskin .sc-note{display:block;font-family:var(--font-body);font-size:11px;font-weight:400;color:var(--muted);text-transform:none;letter-spacing:0;margin-top:3px;}
.docskin .sc-winner{display:inline-block;font-family:var(--font-mono);font-size:8.5px;font-weight:600;letter-spacing:.1em;color:var(--accent);background:var(--paper);border:1px solid var(--accent);border-radius:3px;padding:1px 6px;margin-left:8px;vertical-align:middle;}
.docskin .sc-foot td{border-bottom:none;border-top:1.5px solid var(--ink);font-family:var(--font-mono);font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);}
.docskin .sc-foot td.sc-total{font-size:14px;color:var(--ink);letter-spacing:0;}
.docskin .sc-foot td.sc-total.sc-win{background:var(--accent-tint);color:var(--ink);font-weight:700;}
/* risk (risk register row-cards) — severity and status as chips */
.docskin .risk{margin:22px 0;}
.docskin .rk-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--ink);margin-bottom:2px;}
.docskin .rk-desc{font-size:13px;color:var(--muted);margin:2px 0 12px;line-height:1.5;}
.docskin .rk-list{display:flex;flex-direction:column;gap:10px;}
.docskin .rk-item{border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);padding:12px 16px;box-shadow:none;}
.docskin .rk-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.docskin .rk-sev{flex:none;font-family:var(--font-mono);font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;border-radius:3px;padding:2px 8px;color:var(--ink);background:var(--paper);border:1px solid var(--ink);}
.docskin .rk-sev-critical{background:var(--negative-tint);color:var(--negative);border-color:var(--negative);}
.docskin .rk-sev-high{color:var(--negative);border-color:var(--negative);}
.docskin .rk-sev-low{background:var(--paper-2);border-color:var(--paper-2);color:var(--muted);}
.docskin .rk-risk{font-family:var(--font-display);font-weight:700;font-size:13.5px;color:var(--ink);flex:1;min-width:0;}
.docskin .rk-chips{display:flex;align-items:center;gap:6px;flex:none;margin-left:auto;}
.docskin .rk-owner{font-family:var(--font-mono);font-size:10px;font-weight:600;color:var(--muted);background:var(--paper);border:1px solid var(--rule-solid);border-radius:3px;padding:2px 8px;white-space:nowrap;}
.docskin .rk-status{font-family:var(--font-mono);font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;border-radius:3px;padding:2px 8px;white-space:nowrap;color:var(--ink);background:var(--paper);border:1px solid var(--ink);}
.docskin .rk-st-mitigating{border-color:var(--rule-solid);color:var(--muted);}
.docskin .rk-st-accepted,.docskin .rk-st-closed{background:var(--paper-2);border-color:var(--paper-2);}
.docskin .rk-meta{font-family:var(--font-mono);font-size:11px;font-weight:600;color:var(--gray);margin-top:4px;}
.docskin .rk-mitigation{font-size:12.5px;color:var(--slate);margin:5px 0 0;line-height:1.5;}
.docskin .rk-mit-label{font-weight:700;color:var(--charcoal);}
@media(max-width:640px){.docskin .rk-risk{order:3;flex-basis:100%;}.docskin .rk-item{padding:12px 14px;}}
/* palette (colour-token swatches) */
.docskin .palette{margin:22px 0;}
.docskin .pl-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .pl-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .pl-grid{display:grid;grid-template-columns:repeat(var(--pl-cols,4),minmax(0,1fr));gap:14px;align-items:start;}
@media(max-width:900px){.docskin .pl-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media(max-width:680px){.docskin .pl-grid{grid-template-columns:1fr;}}
.docskin .pl-card{border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);overflow:hidden;box-shadow:none;}
.docskin .pl-swatch{height:64px;border-radius:5px 5px 0 0;display:flex;align-items:flex-end;padding:6px 9px;box-shadow:inset 0 0 0 1px var(--rule);}
/* A value the page cannot draw: hatched, never a stand-in grey. */
.docskin .pl-swatch.pl-unresolved{background:repeating-linear-gradient(135deg,var(--paper-2) 0 6px,var(--paper) 6px 12px);box-shadow:inset 0 0 0 1px var(--rule-solid);}
.docskin .pl-hex-raw{color:var(--ink);background:var(--paper);border:1px solid var(--rule-solid);overflow-wrap:anywhere;}
.docskin .pl-why{font-family:var(--font-mono);font-size:10px;color:var(--muted);margin-top:2px;}
.docskin .pl-hex{font-family:var(--font-mono);font-size:10.5px;font-weight:600;letter-spacing:.02em;padding:1px 6px;border-radius:3px;}
.docskin .pl-meta{padding:9px 11px 11px;border-top:1px solid var(--rule);}
.docskin .pl-name{font-weight:700;font-size:13px;color:var(--charcoal);line-height:1.3;}
.docskin .pl-usage{font-size:11.5px;color:var(--slate);margin-top:2px;line-height:1.45;}
/* eventcontract (async event contract card — the twin of endpoint). Chips carry words; the partition-key row is the one accent. */
.docskin .eventcontract{border:1px solid var(--rule-solid);border-radius:6px;margin:18px 0;overflow:hidden;background:var(--paper);}
.docskin .evc-head{display:flex;align-items:center;gap:12px;padding:11px 16px;background:var(--paper-2);border-bottom:1px solid var(--rule-solid);flex-wrap:wrap;}
.docskin .evc-eyebrow{color:var(--muted);} .docskin .evc-sep{margin:0 5px;}
.docskin .evc-name{font-family:var(--font-mono);font-size:14px;font-weight:600;color:var(--ink);}
.docskin .evc-channel{margin-left:auto;display:inline-flex;align-items:center;gap:7px;font-family:var(--font-mono);font-size:10.5px;color:var(--ink);background:var(--paper);border:1px solid var(--rule-solid);padding:3px 8px;border-radius:3px;}
.docskin .evc-channel .t-eyebrow{color:var(--muted);}
.docskin .evc-body{padding:6px 16px 14px;}
.docskin .evc-title{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--ink);margin:10px 0 2px;}
.docskin .evc-summary,.docskin .evc-desc-p{font-size:13.5px;color:var(--muted);margin:10px 0 0;line-height:1.55;}
/* Producers → consumers: two columns of mono chips on the paper-2 ground, the arrow between them. */
.docskin .evc-strip{display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:start;margin:14px 0 0;padding:10px 12px;background:var(--paper-2);border:1px solid var(--rule-solid);border-radius:4px;}
.docskin .evc-party-label{display:block;margin-bottom:7px;color:var(--muted);}
.docskin .evc-chips{display:flex;flex-wrap:wrap;gap:6px;}
.docskin .evc-chip{display:inline-block;font-family:var(--font-mono);font-size:10.5px;color:var(--ink);background:var(--paper);border:1px solid var(--rule-solid);border-radius:3px;padding:2px 7px;line-height:1.5;}
.docskin .evc-none{color:var(--muted);}
.docskin .evc-arrow{align-self:center;font-size:15px;color:var(--muted);padding:14px 2px 0;}
/* Delivery facts: outlined word chips — the label word in the eyebrow role, then the value. */
.docskin .evc-facts{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 0;}
.docskin .evc-fact{display:inline-flex;align-items:center;gap:7px;font-family:var(--font-mono);font-size:10.5px;color:var(--ink);background:var(--paper);border:1px solid var(--ink);border-radius:3px;padding:2px 8px;line-height:1.5;}
.docskin .evc-fact-k{color:var(--muted);}
.docskin .evc-section{font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:500;margin:16px 0 6px;}
.docskin .evc-table{width:100%;border-collapse:collapse;font-size:13px;}
.docskin .evc-table th{text-align:left;font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:500;padding:4px 8px;border-bottom:1px solid var(--rule);}
.docskin .evc-table td{padding:6px 8px;border-bottom:1px solid var(--rule);vertical-align:top;color:var(--ink);}
.docskin .evc-mark{width:14px;padding-left:6px;padding-right:2px;font-family:var(--font-mono);font-weight:600;color:var(--muted);text-align:center;}
.docskin .evc-fname{font-family:var(--font-mono);font-weight:600;color:var(--ink);white-space:nowrap;}
.docskin .evc-type{font-family:var(--font-mono);color:var(--muted);font-size:12px;}
.docskin .evc-eg{font-family:var(--font-mono);font-size:11px;color:var(--muted);}
/* The partition key is the one accent: its marker and name in accent (on paper — the tint would drop it under 4.5:1), a rule down the row's left edge. */
.docskin .evc-key td:first-child{border-left:2px solid var(--accent);padding-left:4px;}
.docskin .evc-key .evc-mark,.docskin .evc-key .evc-fname{color:var(--accent);}
.docskin .evc-keyline{margin:6px 0 0;color:var(--muted);} .docskin .evc-mark-k{font-weight:600;color:var(--ink);}
.docskin .evc-note{font-size:12.5px;color:var(--muted);margin:14px 0 0;padding-top:10px;border-top:1px solid var(--rule);line-height:1.5;}
/* typescale (live type specimen) */
.docskin .typescale{margin:22px 0;}
.docskin .ts-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .ts-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .ts-row{display:flex;align-items:center;gap:18px;padding:12px 0;border-bottom:1px solid var(--rule);}
.docskin .ts-row:last-child{border-bottom:none;}
.docskin .ts-meta{flex:0 0 160px;min-width:0;}
.docskin .ts-name{font-weight:700;font-size:12.5px;color:var(--charcoal);line-height:1.3;}
.docskin .ts-spec{font-family:var(--font-mono);font-size:10.5px;color:var(--gray);margin-top:2px;}
.docskin .ts-note{font-size:11px;color:var(--slate);margin-top:2px;line-height:1.4;}
.docskin .ts-sample{flex:1;min-width:0;color:var(--charcoal);overflow-wrap:anywhere;}
@media(max-width:640px){.docskin .ts-row{flex-direction:column;align-items:stretch;gap:6px;}.docskin .ts-meta{flex:none;}}
.docskin .ts-f-display{font-family:var(--font-display);}
.docskin .ts-f-body{font-family:var(--font-body);}
.docskin .ts-f-mono{font-family:var(--font-mono);}
/* dodont (do / don't guideline cards) */
.docskin .dodont{margin:22px 0;}
.docskin .dd-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .dd-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .dd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start;}
@media(max-width:680px){.docskin .dd-grid{grid-template-columns:1fr;}}
.docskin .dd-card{border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);overflow:hidden;box-shadow:none;}
.docskin .dd-band{display:flex;align-items:center;gap:8px;padding:9px 14px;background:var(--paper-2);border-bottom:1px solid var(--rule);}
.docskin .dd-sign{flex:none;width:18px;height:18px;border-radius:50%;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;border:1px solid currentColor;background:var(--paper);}
.docskin .dd-do .dd-sign{color:var(--ink);}
.docskin .dd-dont .dd-sign{color:var(--negative);}
.docskin .dd-label{font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;}
.docskin .dd-do .dd-label{color:var(--ink);}
.docskin .dd-dont .dd-label{color:var(--negative);}
.docskin .dd-list{padding:11px 14px 14px;display:flex;flex-direction:column;gap:9px;}
.docskin .dd-item{position:relative;padding-left:14px;}
.docskin .dd-item::before{content:"";position:absolute;left:0;top:8px;width:5px;height:5px;border-radius:50%;}
.docskin .dd-do .dd-item::before{background:var(--muted);}
.docskin .dd-dont .dd-item::before{background:var(--negative);}
.docskin .dd-text{font-size:13px;color:var(--ink);line-height:1.5;}
.docskin .dd-ex{display:inline-block;max-width:100%;font-family:var(--font-mono);font-size:11.5px;color:var(--muted);background:var(--paper-2);border:1px solid var(--rule-solid);border-radius:4px;padding:3px 8px;margin-top:4px;white-space:pre-wrap;overflow-wrap:anywhere;}
.docskin .dd-text{overflow-wrap:anywhere;}
/* inventory (component / feature status board) */
.docskin .inventory{margin:22px 0;}
.docskin .inv-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .inv-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .inv-row{display:flex;align-items:flex-start;gap:12px;padding:9px 0;border-bottom:1px solid var(--rule);}
.docskin .inv-row:last-child{border-bottom:none;}
.docskin .inv-main{flex:1;min-width:0;}
.docskin .inv-top{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;}
.docskin .inv-name{font-weight:700;font-size:13.5px;color:var(--charcoal);line-height:1.35;}
.docskin .inv-tag{font-family:var(--font-mono);font-size:9.5px;font-weight:600;color:var(--slate);background:var(--light-gray);border:1px solid var(--rule);border-radius:4px;padding:1px 6px;}
.docskin .inv-note{font-size:12px;color:var(--slate);margin-top:1px;line-height:1.45;}
.docskin .inv-status{flex:none;font-family:var(--font-mono);font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;border-radius:3px;padding:2px 8px;margin-top:1px;white-space:nowrap;color:var(--ink);background:var(--paper);border:1px solid var(--ink);}
.docskin .inv-st-stable{background:var(--paper-2);border-color:var(--paper-2);}
.docskin .inv-st-experimental,.docskin .inv-st-planned{border-style:dashed;border-color:var(--muted);color:var(--muted);}
.docskin .inv-st-deprecated{border-color:var(--negative);color:var(--negative);}
/* algorithms & data structures (array / bintree / hashmap) — cell values only; everything else is a type role */
.docskin .ds-val{font-family:var(--font-mono);font-size:13px;font-weight:600;text-anchor:middle;}
.docskin .bt-val{font-family:var(--font-mono);font-size:12.5px;font-weight:600;text-anchor:middle;}
.docskin .hsh-key{font-family:var(--font-mono);font-size:11px;font-weight:600;text-anchor:middle;}
/* agentloop (agent-loop diagram, SVG) */
.docskin .al-edge{stroke:var(--muted);stroke-width:1.5;fill:none;}
.docskin .al-edge.dashed{stroke:var(--muted);stroke-dasharray:5 4;}
.docskin .al-lbl{font-family:var(--font-mono);font-size:9.5px;font-weight:400;fill:var(--muted);letter-spacing:.04em;paint-order:stroke;stroke:var(--paper);stroke-width:2.5px;stroke-linejoin:round;}
.docskin .al-name{font-family:var(--font-body);font-size:13px;font-weight:600;fill:var(--ink);}
.docskin .al-chip{font-family:var(--font-mono);font-size:9.5px;font-weight:500;letter-spacing:.04em;fill:var(--muted);}
.docskin .al-note{font-family:var(--font-body);font-size:10.5px;fill:var(--muted);}
.docskin .al-env{font-family:var(--font-body);font-size:12px;font-weight:600;fill:var(--ink);}
.docskin .al-tool-name{font-family:var(--font-mono);font-size:11px;font-weight:600;fill:var(--ink);}
.docskin .al-tool-desc{font-family:var(--font-body);font-size:10px;fill:var(--muted);}
.docskin .al-more{font-family:var(--font-mono);font-size:10px;fill:var(--muted);font-style:italic;}
.docskin .al-mem{font-family:var(--font-mono);font-size:8.5px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;fill:var(--muted);}
.docskin .al-mem-item{font-family:var(--font-body);font-size:10px;fill:var(--ink);}
.docskin .al-foot{margin-top:14px;padding-top:12px;border-top:1px solid var(--rule);font-size:12.5px;color:var(--ink);}
.docskin .al-foot-label{font-family:var(--font-mono);font-size:9.5px;font-weight:500;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-right:6px;}
/* trace (agent / session execution transcript) */
.docskin .trace{margin:22px 0;}
.docskin .tr-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .tr-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .tr-list{display:flex;flex-direction:column;}
.docskin .tr-turn{position:relative;padding:0 0 16px 0;}
.docskin .tr-turn::before{content:"";position:absolute;left:14px;top:24px;bottom:-2px;width:1px;background:var(--rule);}
.docskin .tr-turn:last-child{padding-bottom:0;}
.docskin .tr-turn:last-child::before{display:none;}
/* Roles as chips: the assistant is the one accent; user = paper-2 fill; tool = ink outline; system = dashed. */
.docskin .tr-chip{display:inline-block;font-family:var(--font-mono);font-size:9.5px;font-weight:600;letter-spacing:.08em;padding:2px 8px;border-radius:3px;margin-bottom:6px;position:relative;z-index:1;color:var(--ink);background:var(--paper);border:1px solid var(--ink);}
.docskin .tr-user>.tr-chip{background:var(--paper-2);border-color:var(--paper-2);}
.docskin .tr-assistant>.tr-chip{color:var(--accent);border-color:var(--accent);}
.docskin .tr-system>.tr-chip{border-style:dashed;border-color:var(--muted);color:var(--muted);}
.docskin .tr-card{margin-left:28px;border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);padding:12px 16px;box-shadow:none;}
.docskin .tr-think{font-size:12px;font-style:italic;color:var(--muted);border-left:2px dotted var(--muted);padding-left:10px;margin-bottom:8px;white-space:pre-wrap;line-height:1.55;}
.docskin .tr-text{font-size:13.5px;color:var(--ink);line-height:1.6;white-space:pre-wrap;}
.docskin .tr-think+.tr-text{margin-top:2px;}
.docskin .tr-tool-name{font-family:var(--font-mono);font-size:12.5px;font-weight:700;color:var(--ink);margin-bottom:6px;}
.docskin .tr-io{display:flex;align-items:baseline;gap:8px;margin:4px 0;}
.docskin .tr-io-label{flex:none;font-family:var(--font-mono);font-size:10px;font-weight:700;color:var(--gray);}
.docskin .tr-mono{font-family:var(--font-mono);font-size:11.5px;color:var(--charcoal);background:var(--light-gray);border:1px solid var(--rule);border-radius:5px;padding:2px 8px;white-space:pre-wrap;min-width:0;}
.docskin .tr-io+.tr-text{margin-top:8px;}
/* prompt (prompt anatomy with variable highlighting) */
.docskin .prompt{margin:22px 0;}
.docskin .pr-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .pr-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .pr-list{display:flex;flex-direction:column;gap:10px;}
.docskin .pr-seg{border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);overflow:hidden;box-shadow:none;}
.docskin .pr-kicker{font-family:var(--font-mono);font-size:9.5px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;padding:8px 16px 0;color:var(--muted);}
.docskin .pr-assistant>.pr-kicker{color:var(--accent);}
.docskin .pr-label{font-family:var(--font-body);font-weight:600;font-size:11px;letter-spacing:0;text-transform:none;color:var(--muted);margin-left:6px;}
.docskin .pr-text{font-family:var(--font-mono);font-size:12.5px;line-height:1.65;color:var(--ink);background:var(--paper-2);border-top:1px solid var(--rule);padding:12px 16px;margin-top:8px;white-space:pre-wrap;}
/* Variables: accent text on paper (never on the tint — 4.46:1), boxed by a hairline. */
.docskin .pr-var{font-family:var(--font-mono);background:var(--paper);color:var(--accent);border:1px solid var(--accent);border-radius:3px;padding:0 4px;font-weight:600;}
.docskin .pr-vars{display:flex;flex-direction:column;gap:5px;margin-top:12px;padding-top:12px;border-top:1px dashed var(--rule);}
.docskin .pr-var-row{display:flex;align-items:baseline;gap:10px;}
.docskin .pr-var-row .pr-var{font-size:11.5px;}
.docskin .pr-var-desc{font-size:12px;color:var(--slate);line-height:1.45;}
/* context (context-window token budget, SVG) */
.docskin .ctx-window-label{font-family:var(--font-mono);font-size:10px;font-weight:500;fill:var(--muted);letter-spacing:.06em;}
/* Segment labels sit on a paper mask (series fills are mid-tone; no text reads on them directly). */
.docskin .ctx-seg-mask{fill:var(--paper);stroke:none;}
.docskin .ctx-seg-label{font-family:var(--font-mono);font-size:10px;font-weight:600;fill:var(--ink);}
.docskin .ctx-free-label{font-family:var(--font-mono);font-size:10.5px;font-weight:500;fill:var(--muted);}
.docskin .ctx-boundary{stroke:var(--negative);stroke-width:1.4;stroke-dasharray:5 4;}
.docskin rect.ctx-chip-bg{fill:var(--paper);stroke:var(--negative);stroke-width:1;}
.docskin text.ctx-chip{font-family:var(--font-mono);font-size:9.5px;font-weight:600;fill:var(--negative);}
.docskin .ctx-legend{display:flex;flex-direction:column;gap:6px;margin-top:14px;padding-top:10px;border-top:1px solid var(--rule);}
.docskin .ctx-legend .lg-title{margin-bottom:2px;}
.docskin .ctx-row{display:flex;align-items:baseline;gap:9px;font-size:12.5px;color:var(--ink);}
.docskin .ctx-dot{flex:none;width:11px;height:11px;border-radius:2px;align-self:center;}
.docskin .ctx-idx{flex:none;font-family:var(--font-mono);font-size:10px;font-weight:600;color:var(--muted);}
.docskin .ctx-label{font-weight:600;}
.docskin .ctx-num{font-family:var(--font-mono);font-size:11px;color:var(--muted);white-space:nowrap;}
.docskin .ctx-note{font-size:12px;color:var(--muted);}
/* archmap (target-architecture capability map) */
.docskin .archmap{margin:22px 0;}
.docskin .am-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .am-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .am-grid{display:grid;grid-template-columns:repeat(var(--am-cols,3),minmax(0,1fr));gap:10px;align-items:stretch;}
@media(max-width:900px){.docskin .am-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media(max-width:680px){.docskin .am-grid{grid-template-columns:1fr;}}
/* Areas are paper-2 frames with an eyebrow; an area accent maps to its category hue (tint panel, hue label), as grid group panels do. Tile status by stroke and word: current = hairline · new = ink 1.5px · target = dashed ink · gap = dashed + GAP chip · deprecated = paper-2, struck through + RETIRING chip. */
.docskin .am-area{background:var(--paper-2);border:1px solid var(--rule-solid);border-radius:6px;padding:12px;box-shadow:none;}
.docskin .am-area.am-hue-blue{background:var(--hue-blue-tint);} .docskin .am-hue-blue .am-area-label{color:var(--hue-blue);}
.docskin .am-area.am-hue-amber{background:var(--hue-amber-tint);} .docskin .am-hue-amber .am-area-label{color:var(--hue-amber);}
.docskin .am-area.am-hue-violet{background:var(--hue-violet-tint);} .docskin .am-hue-violet .am-area-label{color:var(--hue-violet);}
.docskin .am-area.am-hue-teal{background:var(--hue-teal-tint);} .docskin .am-hue-teal .am-area-label{color:var(--hue-teal);}
.docskin .am-area.am-hue-green{background:var(--hue-green-tint);} .docskin .am-hue-green .am-area-label{color:var(--hue-green);}
.docskin .am-area.am-hue-rose{background:var(--hue-rose-tint);} .docskin .am-hue-rose .am-area-label{color:var(--hue-rose);}
.docskin .am-area-label{font-family:var(--font-mono);font-size:8.5px;text-transform:uppercase;letter-spacing:.14em;font-weight:500;color:var(--muted);margin-bottom:2px;}
.docskin .am-area-desc{font-size:11.5px;color:var(--muted);line-height:1.45;}
.docskin .am-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px;margin-top:8px;}
.docskin .am-tile{background:var(--paper);border:1px solid var(--rule-solid);border-radius:4px;padding:6px 8px;font-size:11.5px;line-height:1.35;color:var(--ink);text-align:center;}
.docskin .am-t-target{border:1px dashed var(--ink);}
.docskin .am-t-new{border:1.5px solid var(--ink);}
.docskin .am-t-gap{background:var(--paper);border:1px dashed var(--ink);}
.docskin .am-chip{display:block;margin-top:3px;color:var(--muted);}
.docskin .am-t-deprecated{background:var(--paper-2);color:var(--muted);border:1px solid var(--rule-solid);} .docskin .am-t-deprecated .am-name{text-decoration:line-through;text-decoration-thickness:1px;}
/* Legend swatches mirror the tile strokes (the gap entry is its word chip). */
.docskin .am-sw{display:inline-block;width:30px;height:14px;border-radius:2px;box-sizing:border-box;}
.docskin .am-sw-current{background:var(--paper);border:1px solid var(--rule-solid);}
.docskin .am-sw-target{background:var(--paper);border:1px dashed var(--ink);}
.docskin .am-sw-new{background:var(--paper);border:1.5px solid var(--ink);}
.docskin .am-sw-deprecated{background:var(--paper-2);border:1px solid var(--rule-solid);}
/* divider (full-width section-break band) */
.docskin .dvd{--dvd-accent:var(--navy);--dvd-soft:var(--light-blue);margin:22px 0;width:100%;min-height:180px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:36px 28px;text-align:center;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);background:color-mix(in srgb,var(--dvd-soft) 45%,transparent);}
.docskin .dvd-kicker{display:flex;align-items:center;gap:12px;}
.docskin .dvd-kicker-text{font-family:var(--font-mono);font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--dvd-accent);}
.docskin .dvd-rule{width:36px;height:1px;background:var(--dvd-accent);opacity:.55;}
.docskin .dvd-title{font-family:var(--font-display);font-weight:700;font-size:34px;line-height:1.15;letter-spacing:-.01em;color:var(--charcoal);max-width:820px;}
.docskin .dvd-subtitle{font-size:15px;color:var(--slate);line-height:1.55;max-width:680px;margin:0;}
/* Band accents are ignored by the skin. */
/* spans (distributed-trace waterfall) — lanes per service; bars lighten by depth (ink → muted → paper-2);
   the critical path is the one accent; errors are a negative outline + ERR chip. */
.docskin .sp-axis{stroke:var(--rule-solid);stroke-width:1;}
.docskin .sp-grid{stroke:var(--rule);stroke-width:1;}
.docskin .sp-lane-rule{stroke:var(--rule);stroke-width:1;}
.docskin .sp-bar.d0{fill:var(--ink);stroke:none;}
.docskin .sp-bar.d1{fill:var(--muted);stroke:none;}
.docskin .sp-bar.d2{fill:var(--paper-2);stroke:var(--rule-solid);stroke-width:1;}
.docskin .sp-bar.crit{fill:var(--accent-tint);stroke:var(--accent);stroke-width:1.5;}
.docskin .sp-bar.err{fill:var(--negative-tint);stroke:var(--negative);stroke-width:1.5;}
/* Paper text on a dark bar drops the paper halo (it would blot the glyphs). */
.docskin svg text.sp-on-dark{fill:var(--paper);stroke:none;}
.docskin .sp-link{stroke:var(--rule-solid);stroke-width:1;fill:none;}
.docskin .sp-chip{fill:var(--paper);stroke:var(--rule-solid);stroke-width:1;}
.docskin .sp-chip.err{stroke:var(--negative);}
.docskin svg text.sp-chip-text.err{fill:var(--negative);}
.docskin .sp-details{margin-top:12px;padding-top:10px;border-top:1px solid var(--rule);font-size:12px;color:var(--ink);}
.docskin .sp-details-title{display:block;margin-bottom:6px;}
.docskin .sp-details ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px;}
.docskin .sp-details li{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 14px;}
.docskin .sp-d-span{font-weight:600;color:var(--ink);}
.docskin .sp-d-service{font-family:var(--font-mono);font-weight:400;font-size:10px;color:var(--muted);letter-spacing:.04em;text-transform:uppercase;margin-right:4px;}
.docskin .sp-d-attrs{display:inline-flex;flex-wrap:wrap;gap:4px 8px;}
.docskin .sp-d-attr{font-family:var(--font-mono);font-size:10.5px;color:var(--muted);}
.docskin .sp-d-note{color:var(--muted);font-style:italic;}
/* rollout (progressive-delivery stage strip) — paper cards on the frame ground, an ink traffic bar,
   the gate as a chip on the connector; status by the shared chip encoding, current = the one accent. */
.docskin .ro-strip{display:flex;align-items:stretch;overflow-x:auto;padding:4px 0 6px;}
.docskin .ro-stage{flex:1 1 160px;min-width:150px;box-sizing:border-box;display:flex;flex-direction:column;gap:6px;padding:10px 12px 12px;border-radius:4px;background:var(--paper);border:1px solid var(--ink);}
.docskin .ro-stage.ro-s-done{background:var(--paper-2);border-color:var(--rule-solid);}
.docskin .ro-stage.ro-s-current{border:1.5px solid var(--accent);}
.docskin .ro-stage.ro-s-next{border-style:dashed;border-color:var(--muted);}
.docskin .ro-stage.ro-s-blocked{border-color:var(--negative);background:var(--negative-tint);}
.docskin .ro-n{display:block;}
.docskin .ro-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;}
.docskin .ro-status{display:inline-block;font-family:var(--font-mono);font-size:8.5px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;padding:1px 6px;border-radius:2px;line-height:1.5;color:var(--ink);background:var(--paper);border:1px solid var(--ink);}
.docskin .ro-status.ro-st-done{background:var(--paper);border-color:var(--rule-solid);color:var(--muted);}
.docskin .ro-status.ro-st-current{color:var(--accent);border-color:var(--accent);}
.docskin .ro-status.ro-st-next{border-style:dashed;border-color:var(--muted);color:var(--muted);}
.docskin .ro-status.ro-st-blocked{color:var(--negative);border-color:var(--negative);}
.docskin .ro-traffic{display:flex;align-items:center;gap:8px;}
.docskin .ro-track{flex:1;height:6px;border-radius:3px;background:var(--paper-2);border:1px solid var(--rule-solid);overflow:hidden;}
.docskin .ro-s-done .ro-track{background:var(--paper);}
.docskin .ro-fill{height:100%;background:var(--ink);}
.docskin .ro-pct{flex:none;color:var(--ink);}
.docskin .ro-note{font-size:12px;color:var(--muted);line-height:1.45;}
.docskin .ro-link{flex:0 0 auto;position:relative;display:flex;align-items:center;justify-content:center;min-width:34px;max-width:150px;padding:0 8px;}
.docskin .ro-link::before{content:"";position:absolute;left:0;right:0;top:50%;height:1px;background:var(--muted);}
.docskin .ro-link::after{content:"";position:absolute;right:0;top:50%;margin-top:-4px;border:4px solid transparent;border-left:6px solid var(--muted);border-right:0;}
.docskin .ro-link-end::after{display:none;}
.docskin .ro-gate{position:relative;max-width:134px;padding:2px 7px;border-radius:2px;background:var(--paper);border:1px solid var(--rule-solid);color:var(--ink);text-align:center;line-height:1.35;}
.docskin .ro-rollback{display:flex;align-items:baseline;gap:10px;margin-top:12px;font-size:12.5px;color:var(--ink);}
/* bignumber (one hero metric at presentation scale) — ink, never a coloured fill */
.docskin .bn{margin:22px 0;width:100%;display:flex;flex-direction:column;align-items:center;gap:8px;padding:30px 24px;text-align:center;}
.docskin .bn-value-row{display:flex;align-items:baseline;justify-content:center;gap:14px;flex-wrap:wrap;}
.docskin .bn-value{font-family:var(--font-display);font-weight:700;font-size:clamp(56px,10vw,84px);line-height:1;letter-spacing:-.02em;color:var(--ink);max-width:100%;overflow-wrap:anywhere;font-variant-numeric:tabular-nums;}
/* Long figures step down (bignumber.ts bignumberSize) so "$1,250,000,000" fits a phone. */
.docskin .bn-len-m .bn-value{font-size:clamp(44px,8vw,72px);}
.docskin .bn-len-l .bn-value{font-size:clamp(32px,6.4vw,60px);}
.docskin .bn-len-xl .bn-value{font-size:clamp(26px,5vw,48px);}
.docskin .bn-delta{display:inline-flex;align-items:baseline;gap:5px;font-family:var(--font-mono);font-size:15px;font-weight:700;color:var(--muted);}
.docskin .bn-arrow{color:var(--muted);font-size:12px;}
.docskin .bn-label{font-family:var(--font-display);font-weight:700;font-size:18px;color:var(--ink);line-height:1.35;max-width:720px;}
.docskin .bn-context{font-size:13.5px;color:var(--muted);line-height:1.5;max-width:640px;margin:0;}
/* takeaways (numbered closing-slide rows) */
.docskin .tk{margin:22px 0;width:100%;}
.docskin .tk-title{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--ink);margin-bottom:14px;}
.docskin .tk-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:18px;}
.docskin .tk-item{display:flex;align-items:flex-start;gap:16px;padding-bottom:18px;border-bottom:1px solid var(--rule);}
.docskin .tk-item:last-child{padding-bottom:0;border-bottom:none;}
.docskin .tk-num{flex:none;width:30px;height:30px;border-radius:50%;border:1px solid var(--ink);background:var(--paper);color:var(--ink);font-family:var(--font-mono);font-size:12px;font-weight:600;display:flex;align-items:center;justify-content:center;}
.docskin .tk-body{flex:1;min-width:0;padding-top:3px;}
.docskin .tk-text{font-family:var(--font-display);font-weight:700;font-size:17px;color:var(--ink);line-height:1.35;}
.docskin .tk-detail{font-size:13.5px;color:var(--muted);margin:5px 0 0;line-height:1.55;max-width:760px;}
/* statustable (task table + status chips) */
.docskin .stt{margin:14px 0;}
.docskin .stt-desc{font-size:13px;color:var(--muted);margin:0 0 10px;max-width:760px;}
.docskin .stt-wrap{border:1px solid var(--rule-solid);border-radius:6px;overflow:hidden;background:var(--paper);box-shadow:none;}
.docskin .stt-scroll{position:relative;overflow-x:auto;}
.docskin .stt-scroll>.trk{margin:0;}
.docskin .stt-table{width:100%;border-collapse:collapse;font-size:13px;}
.docskin .stt-table thead{background:var(--paper-2);color:var(--muted);}
.docskin .stt-table th{padding:9px 12px;text-align:left;font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;border-bottom:1px solid var(--rule-solid);}
.docskin .stt-table th.stt-status-h{width:1%;white-space:nowrap;}
.docskin .stt-table td{padding:9px 12px;border-bottom:1px solid var(--rule);vertical-align:middle;color:var(--ink);}
.docskin .stt-table tbody.stt-group:nth-of-type(even){background:color-mix(in srgb,var(--paper-2) 50%,transparent);}
.docskin .stt-table tbody.stt-group:last-of-type tr:last-child td{border-bottom:none;}
.docskin .stt-table td.stt-lead{font-weight:600;color:var(--ink);}
.docskin .stt-table tr.stt-haskids td{border-bottom-style:dashed;}
.docskin .stt-table tr.stt-sub td{color:var(--muted);font-size:12.5px;padding-top:6px;padding-bottom:6px;border-bottom-style:dashed;}
.docskin .stt-table tr.stt-sub td:first-child{padding-left:24px;}
.docskin .stt-table tr.stt-sub:last-child td{border-bottom-style:solid;}
.docskin .stt-tree{font-family:var(--font-mono);color:var(--muted);margin-right:8px;}
.docskin .stt-table td.stt-status{white-space:nowrap;}
/* The status vocabulary's colour names map onto the role tokens: green / blue / teal / purple = that
   category hue (outline, text and tint) · amber = the warn role · red = negative · gray = dashed muted ·
   navy and anything else = ink outline. The status word always rides in the chip. */
.docskin .stt-pill{display:inline-block;font-family:var(--font-mono);font-size:9.5px;font-weight:600;padding:2px 8px;border-radius:3px;text-transform:uppercase;letter-spacing:.06em;background:var(--paper);color:var(--ink);border:1px solid var(--ink);}
.docskin .stt-pill.stt-green{background:var(--hue-green-tint);border-color:var(--hue-green);color:var(--hue-green);}
.docskin .stt-pill.stt-blue{background:var(--hue-blue-tint);border-color:var(--hue-blue);color:var(--hue-blue);}
.docskin .stt-pill.stt-teal{background:var(--hue-teal-tint);border-color:var(--hue-teal);color:var(--hue-teal);}
.docskin .stt-pill.stt-purple{background:var(--hue-violet-tint);border-color:var(--hue-violet);color:var(--hue-violet);}
.docskin .stt-pill.stt-amber{background:var(--warn-tint);border-color:var(--warn);color:var(--warn);}
.docskin .stt-pill.stt-red{background:var(--negative-tint);border-color:var(--negative);color:var(--negative);}
.docskin .stt-pill.stt-gray{border-style:dashed;border-color:var(--muted);color:var(--muted);}
/* The legend is the shared strip, inside the frame. */
.docskin .stt-wrap .diagram-legend{margin:0;padding:10px 12px;}
.docskin .stt-dot{flex:none;width:10px;height:10px;border-radius:2px;background:var(--paper);border:1px solid var(--ink);box-sizing:border-box;}
.docskin .stt-dot.stt-green{background:var(--hue-green-tint);border-color:var(--hue-green);}
.docskin .stt-dot.stt-blue{background:var(--hue-blue-tint);border-color:var(--hue-blue);}
.docskin .stt-dot.stt-teal{background:var(--hue-teal-tint);border-color:var(--hue-teal);}
.docskin .stt-dot.stt-purple{background:var(--hue-violet-tint);border-color:var(--hue-violet);}
.docskin .stt-dot.stt-amber{background:var(--warn-tint);border-color:var(--warn);}
.docskin .stt-dot.stt-red{background:var(--negative-tint);border-color:var(--negative);}
.docskin .stt-dot.stt-gray{border-style:dashed;border-color:var(--muted);}
/* benchmark (measured results: subject columns × metric rows) — an airy
   scoreboard: no fills in the header, hairline row rules drawn as inset
   shadows so the featured column's real borders can close into a rounded
   outline, and the winning value in each row tinted with its subject's tone. */
.docskin .benchmark{margin:26px 0 34px;}
.docskin .bm-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .bm-desc{font-size:13px;color:var(--slate);margin:2px 0 14px;line-height:1.5;}
.docskin .bm-scroll{overflow-x:auto;padding:3px 3px 4px;}
.docskin .bm-table{width:100%;border-collapse:separate;border-spacing:0;font-size:13px;}
.docskin .bm-table th,.docskin .bm-table td{box-shadow:inset 0 -1px 0 var(--rule);vertical-align:middle;}
.docskin .bm-table tbody tr:last-child th,.docskin .bm-table tbody tr:last-child td{box-shadow:none;}
.docskin .bm-table th.bm-subj{padding:10px 14px 12px;text-align:center;font-family:var(--font-display);font-size:15px;font-weight:700;color:var(--charcoal);}
.docskin .bm-subj-sub{display:block;font-family:var(--font-body);font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--gray);margin-top:3px;}
.docskin .bm-table th.bm-metric{padding:10px 14px 12px;text-align:left;font-family:var(--font-body);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--gray);}
.docskin .bm-table td.bm-metric{padding:12px 18px 12px 2px;width:30%;min-width:170px;}
.docskin .bm-row-label{display:block;font-size:14px;font-weight:600;color:var(--charcoal);line-height:1.35;}
.docskin .bm-row-sub{display:block;font-size:12px;color:var(--gray);line-height:1.4;margin-top:1px;}
.docskin .bm-table td.bm-cell{padding:0;text-align:center;}
.docskin .bm-slot{padding:11px 10px;border-radius:4px;}
.docskin .bm-slot + .bm-slot{position:relative;}
.docskin .bm-slot + .bm-slot::before{content:"";position:absolute;top:0;left:22%;right:22%;height:1px;background:var(--rule);}
.docskin .bm-val{display:block;font-size:15px;color:var(--charcoal);line-height:1.25;}
.docskin .bm-slot.bm-best .bm-val{font-weight:700;}
.docskin .bm-cap{display:block;font-size:11px;color:var(--gray);margin-top:2px;}
.docskin .bm-note{display:block;font-size:11px;color:var(--gray);margin-bottom:2px;}
.docskin .bm-slot.bm-best.bm-accent{background:var(--accent-tint);}
.docskin .bm-slot.bm-best.bm-muted{background:var(--paper-2);}
/* The featured column is the one accent: side borders on every cell, closed top and bottom. */
.docskin .bm-table th.bm-feat,.docskin .bm-table td.bm-feat{border-left:1.5px solid var(--accent);border-right:1.5px solid var(--accent);}
.docskin .bm-table thead th.bm-feat{border-top:1.5px solid var(--accent);border-radius:6px 6px 0 0;}
.docskin .bm-table tbody tr:last-child td.bm-feat{border-bottom:1.5px solid var(--accent);border-radius:0 0 6px 6px;}
.docskin .src-note{font-family:var(--font-mono);font-size:11px;color:var(--gray);margin:-6px 0 18px;letter-spacing:.02em;}
/* tree values — the driver-tree treatment: the number, then its share of the parent */
.docskin .tvalue{margin-left:10px;font-family:var(--font-mono);font-size:12px;font-weight:700;color:var(--navy);}
.docskin .tshare{margin-left:6px;font-family:var(--font-mono);font-size:10.5px;color:var(--gray);}
/* storymap — backbone step cards across the top, release slices as bands; the first slice is the one accent */
.docskin .sm-scroll{overflow-x:auto;}
.docskin .sm-row{display:flex;align-items:stretch;}
.docskin .sm-head{background:var(--paper-2);}
.docskin .sm-gutter{flex:0 0 128px;padding:8px 10px 8px 12px;font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;color:var(--muted);position:sticky;left:0;z-index:2;background:var(--paper-2);}
/* The nearest release is the one accent: its label, and a single rule down the row's left edge. */
.docskin .sm-band-first .sm-gutter{color:var(--accent);border-left:3px solid var(--accent);padding-left:9px;}
.docskin .sm-colcell{flex:1 1 0;padding:4px 5px;min-width:132px;}
.docskin .sm-step{background:var(--paper);border:1px solid var(--ink);border-radius:4px;padding:7px 11px 8px;height:100%;box-sizing:border-box;}
.docskin .sm-step-eyebrow{display:block;margin-bottom:2px;color:var(--muted);}
.docskin .sm-step-label{font-size:13px;font-weight:600;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.docskin .sm-step-note{font-family:var(--font-mono);font-size:10px;color:var(--muted);margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.docskin .sm-band{border-top:1px solid var(--rule);}
.docskin .sm-band .sm-gutter{padding-top:12px;}
.docskin .sm-cell{padding:8px 5px;}
.docskin .sm-card{background:var(--paper);border:1px solid var(--rule-solid);padding:7px 10px;border-radius:4px;}
.docskin .sm-card + .sm-card{margin-top:6px;}
.docskin .sm-card-title{font-size:12.5px;font-weight:600;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.docskin .sm-card-tag{display:inline-block;font-family:var(--font-mono);font-size:8.5px;font-weight:500;text-transform:uppercase;letter-spacing:.14em;color:var(--muted);background:var(--paper);border:1px solid var(--rule-solid);border-radius:2px;padding:1px 5px;margin-top:5px;}
/* scenarios — assumptions in columns, the outcome on its own row */
.docskin .scenarios{margin:26px 0 34px;}
.docskin .sn-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--charcoal);margin-bottom:2px;}
.docskin .sn-desc{font-size:13px;color:var(--slate);margin:2px 0 12px;line-height:1.5;}
.docskin .sn-scroll{overflow-x:auto;border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);box-shadow:none;}
.docskin .sn-table{width:100%;border-collapse:collapse;font-size:13px;}
.docskin .sn-table thead th{background:var(--paper-2);color:var(--ink);padding:10px 12px;text-align:center;font-family:var(--font-display);font-size:13px;font-weight:700;vertical-align:top;border-bottom:1px solid var(--rule-solid);}
.docskin .sn-table th.sn-driver,.docskin .sn-table td.sn-driver{text-align:left;font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;color:var(--muted);}
.docskin .sn-table td{padding:9px 12px;border-bottom:1px solid var(--rule);text-align:center;font-family:var(--font-mono);color:var(--ink);}
.docskin .sn-table td.sn-driver{font-family:var(--font-body);color:var(--muted);}
/* The base case is the one accent: a chip in its header and a tint down its column. */
.docskin .sn-badge{display:inline-block;font-family:var(--font-mono);font-size:8.5px;font-weight:600;letter-spacing:.1em;color:var(--accent);background:var(--paper);border:1px solid var(--accent);border-radius:3px;padding:1px 6px;margin-top:5px;}
.docskin .sn-note{display:block;font-family:var(--font-body);font-size:10.5px;font-weight:400;color:var(--muted);text-transform:none;letter-spacing:0;margin-top:3px;}
.docskin .sn-blank{color:var(--rule-solid);}
.docskin .sn-table .sc-base{background:var(--accent-tint);}
.docskin .sn-table thead th.sc-base{background:var(--paper-2);box-shadow:inset 0 -2px 0 var(--accent);}
.docskin .sn-outcome td{border-bottom:none;border-top:1.5px solid var(--ink);font-family:var(--font-display);font-size:17px;font-weight:700;color:var(--ink);padding:11px 12px;}
.docskin .sn-outcome td:first-child{font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;color:var(--muted);text-align:left;}
/* harvey — the rated comparison grid: options across, criteria down; the recommendation is the one accent */
.docskin .harvey{margin:26px 0 34px;}
.docskin .hv-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--ink);margin-bottom:2px;}
.docskin .hv-desc{font-size:13px;color:var(--muted);margin:2px 0 12px;line-height:1.5;}
.docskin .hv-scroll{overflow-x:auto;border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);box-shadow:none;}
.docskin .hv-table{width:100%;border-collapse:collapse;font-size:13px;}
.docskin .hv-table thead th{background:var(--paper-2);color:var(--muted);padding:10px 12px;text-align:center;font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;vertical-align:top;border-bottom:1px solid var(--rule-solid);}
.docskin .hv-table th.hv-crit{text-align:left;}
.docskin .hv-table td{padding:9px 12px;border-bottom:1px solid var(--rule);text-align:center;vertical-align:middle;color:var(--ink);}
.docskin .hv-table td.hv-crit{text-align:left;}
.docskin .hv-label{font-weight:600;color:var(--ink);}
.docskin .hv-note{display:block;font-size:11.5px;color:var(--muted);margin-top:2px;}
.docskin .hv-weight{display:inline-block;font-family:var(--font-mono);font-size:9.5px;font-weight:600;color:var(--ink);background:var(--paper);border:1px solid var(--rule-solid);border-radius:3px;padding:1px 6px;margin-left:8px;}
.docskin .hv-rec{display:inline-block;font-family:var(--font-mono);font-size:8.5px;font-weight:600;letter-spacing:.1em;color:var(--accent);background:var(--paper);border:1px solid var(--accent);border-radius:3px;padding:1px 6px;margin-top:5px;}
.docskin .hv-table td.hv-is-rec{background:var(--accent-tint);}
.docskin .hv-table thead th.hv-is-rec{color:var(--accent);box-shadow:inset 0 -2px 0 var(--accent);}
.docskin .hv-na{color:var(--muted);font-family:var(--font-mono);}
.docskin .hv-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;}
.docskin .hv-foot td{border-bottom:none;border-top:1.5px solid var(--ink);font-family:var(--font-mono);font-size:10.5px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);text-align:center;}
.docskin .hv-foot td:first-child{text-align:left;}
.docskin .hv-foot td.hv-lead{color:var(--ink);font-weight:700;}
.docskin .hv-scroll .diagram-legend{margin:0;padding:10px 12px;}
/* scqa — the executive summary ladder; the answer carries the weight and the one accent */
.docskin .scqa{margin:26px 0 34px;}
.docskin .sq-head{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--ink);margin-bottom:2px;}
.docskin .sq-desc{font-size:13px;color:var(--muted);margin:2px 0 14px;line-height:1.5;}
.docskin .sq-row{display:flex;gap:14px;padding:11px 0;border-bottom:1px dashed var(--rule);}
.docskin .sq-num{flex:none;width:22px;height:22px;border-radius:50%;background:var(--paper);color:var(--ink);border:1px solid var(--ink);font-family:var(--font-mono);font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center;}
.docskin .sq-body{min-width:0;}
.docskin .sq-label{display:block;font-family:var(--font-mono);font-size:9.5px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin-bottom:3px;}
.docskin .sq-text{font-size:15px;line-height:1.55;color:var(--ink);margin:0;}
.docskin .sq-answer{margin-top:16px;padding:16px 20px;background:var(--paper-2);border-left:3px solid var(--accent);border-radius:0 6px 6px 0;}
.docskin .sq-label-answer{color:var(--accent);}
.docskin .sq-text-answer{font-family:var(--font-display);font-size:19px;font-weight:700;line-height:1.4;color:var(--ink);}
.docskin .sq-because{margin:10px 0 0;padding-left:18px;}
.docskin .sq-because li{font-size:13.5px;line-height:1.55;color:var(--muted);margin-bottom:3px;}
/* packet — the bit ruler, field cells, and each cell's bit count */
.docskin .pk-tick{font-family:var(--font-mono);font-size:8.5px;fill:var(--gray);}
.docskin .pk-off{font-family:var(--font-mono);font-size:9px;fill:var(--gray);text-anchor:end;dominant-baseline:middle;}
.docskin .pk-name{font-family:var(--font-body);font-size:11.5px;font-weight:700;fill:var(--charcoal);text-anchor:middle;}
.docskin .pk-value{font-family:var(--font-mono);font-size:10px;fill:var(--slate);text-anchor:middle;}
.docskin .pk-bits{font-family:var(--font-mono);font-size:8.5px;fill:var(--gray);text-anchor:middle;}
.docskin .pk-total{font-family:var(--font-mono);font-size:11px;color:var(--gray);margin:10px 0 0;letter-spacing:.03em;}
/* gitgraph — lane names, commit messages, release tags */
.docskin .gg-branch{font-family:var(--font-mono);font-size:11px;font-weight:700;text-anchor:end;}
.docskin .gg-msg{font-family:var(--font-body);font-size:11px;fill:var(--slate);text-anchor:middle;}
.docskin .gg-tag{font-family:var(--font-mono);font-size:10px;font-weight:700;fill:var(--highlight);text-anchor:middle;}
.docskin .bm-foot{font-size:12px;color:var(--gray);margin:12px 0 0;line-height:1.5;}
/* ── audit (findings register) — the risk chip encoding for severity; open = negative, fixing = the accent ── */
.docskin .audit{margin:22px 0;}
.docskin .au-head{display:flex;align-items:baseline;gap:8px 18px;flex-wrap:wrap;margin-bottom:2px;}
.docskin .au-title{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--ink);}
.docskin .au-meta{display:inline-flex;flex-wrap:wrap;gap:4px 14px;font-family:var(--font-mono);font-size:10.5px;color:var(--muted);}
.docskin .au-k{font-size:8.5px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--soft);margin-right:6px;}
.docskin .au-desc{font-size:13px;color:var(--muted);margin:2px 0 10px;line-height:1.5;}
.docskin .au-counts{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:8px 0 10px;}
.docskin .au-total{margin-right:6px;}
.docskin .au-sev{display:inline-block;line-height:1.5;}
.docskin .au-count .au-n{font-weight:700;}
.docskin .au-sev.rk-sev-info{background:var(--paper);border-color:var(--rule-solid);color:var(--soft);}
.docskin .au-scroll{overflow-x:auto;border:1px solid var(--rule-solid);border-radius:6px;background:var(--paper);}
.docskin .au-table{width:100%;border-collapse:collapse;font-size:12.5px;}
.docskin .au-table thead th{background:var(--paper-2);color:var(--muted);padding:8px 10px;text-align:left;font-family:var(--font-mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:500;border-bottom:1px solid var(--rule-solid);white-space:nowrap;}
.docskin .au-table td{padding:8px 10px;border-bottom:1px solid var(--rule);vertical-align:top;color:var(--ink);line-height:1.45;}
.docskin .au-table tbody tr:last-child td{border-bottom:none;}
.docskin .au-id{font-family:var(--font-mono);font-size:11px;font-weight:600;color:var(--muted);white-space:nowrap;}
.docskin .au-c-sev,.docskin .au-c-status{white-space:nowrap;}
.docskin .au-ftitle{display:block;font-weight:600;color:var(--ink);}
.docskin .au-area{display:inline-block;margin-top:3px;font-family:var(--font-mono);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);border:1px solid var(--rule-solid);border-radius:2px;padding:0 5px;line-height:1.5;}
.docskin .au-ref{display:inline-block;margin:3px 0 0 6px;font-family:var(--font-mono);font-size:10px;color:var(--link);}
.docskin .au-evidence{font-family:var(--font-mono);font-size:11px;color:var(--muted);min-width:140px;}
.docskin .au-fix{min-width:150px;}
.docskin .au-owner{font-family:var(--font-mono);font-size:11px;color:var(--muted);white-space:nowrap;}
.docskin .au-st-open{border-color:var(--negative);color:var(--negative);}
.docskin .au-st-fixing{border-color:var(--accent);color:var(--accent);}
.docskin .au-st-fixed{background:var(--paper-2);border-color:var(--paper-2);color:var(--muted);}
.docskin .au-st-accepted,.docskin .au-st-wontfix{border-color:var(--rule-solid);color:var(--soft);}
/* ── checklist (pass / fail with evidence) — verdict chips, mono evidence, the derived pass rate ── */
.docskin .checklist{margin:22px 0;}
.docskin .cl-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:2px;}
.docskin .cl-title{font-family:var(--font-display);font-weight:700;font-size:15px;color:var(--ink);}
.docskin .cl-standard{font-family:var(--font-mono);font-size:10px;color:var(--muted);background:var(--paper);border:1px solid var(--rule-solid);border-radius:3px;padding:2px 7px;line-height:1.5;}
.docskin .cl-desc{font-size:13px;color:var(--muted);margin:2px 0 10px;line-height:1.5;}
.docskin .cl-groups{display:flex;flex-direction:column;gap:14px;margin-top:8px;}
.docskin .cl-group-label{display:block;margin-bottom:4px;}
.docskin .cl-items{display:flex;flex-direction:column;border-top:1px solid var(--rule);}
.docskin .cl-item{display:flex;align-items:flex-start;gap:12px;padding:8px 2px;border-bottom:1px solid var(--rule);}
.docskin .cl-verdict{flex:none;display:inline-flex;align-items:center;gap:5px;min-width:64px;font-family:var(--font-mono);font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;border-radius:3px;padding:2px 7px;line-height:1.5;color:var(--ink);background:var(--paper);border:1px solid var(--ink);margin-top:1px;}
.docskin .cl-glyph{font-size:11px;line-height:1;}
.docskin .cl-v-pass{background:var(--paper-2);border-color:var(--paper-2);color:var(--ink);}
.docskin .cl-v-fail{color:var(--negative);border-color:var(--negative);background:var(--negative-tint);}
.docskin .cl-v-partial{color:var(--accent);border-color:var(--accent);}
.docskin .cl-v-na,.docskin .cl-v-pending{color:var(--soft);border-color:var(--rule-solid);}
.docskin .cl-body{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 12px;min-width:0;font-size:13px;line-height:1.5;}
.docskin .cl-text{color:var(--ink);font-weight:500;}
.docskin .cl-s-na .cl-text{color:var(--muted);font-weight:400;}
.docskin .cl-evidence{font-family:var(--font-mono);font-size:11px;color:var(--muted);}
.docskin .cl-note{font-size:12px;color:var(--muted);font-style:italic;}
.docskin .cl-ref{font-family:var(--font-mono);font-size:10px;color:var(--link);}
.docskin .cl-foot{display:flex;justify-content:space-between;align-items:baseline;gap:10px 18px;flex-wrap:wrap;margin-top:10px;font-family:var(--font-mono);font-size:10.5px;color:var(--muted);letter-spacing:.03em;}
.docskin .cl-rate b{color:var(--ink);font-weight:700;font-size:12px;}
/* ── modelcard (ML model card) — the eventcontract card chrome plus a spec strip and a metrics table ── */
.docskin .modelcard{border:1px solid var(--rule-solid);border-radius:6px;margin:18px 0;overflow:hidden;background:var(--paper);}
.docskin .mc-task{margin-left:auto;display:inline-flex;align-items:center;gap:7px;font-family:var(--font-body);font-size:12px;color:var(--ink);background:var(--paper);border:1px solid var(--rule-solid);padding:3px 8px;border-radius:3px;}
.docskin .mc-task .t-eyebrow{color:var(--muted);}
.docskin .mc-spec{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1px;margin:14px 0 0;background:var(--rule-solid);border:1px solid var(--rule-solid);border-radius:4px;overflow:hidden;}
.docskin .mc-cell{display:flex;flex-direction:column;gap:3px;padding:8px 10px;background:var(--paper-2);}
.docskin .mc-k{color:var(--muted);}
.docskin .mc-v{font-family:var(--font-mono);font-size:11.5px;color:var(--ink);line-height:1.4;}
.docskin .mc-list{margin:0;padding-left:18px;font-size:13px;line-height:1.55;color:var(--ink);}
.docskin .mc-list li{margin:2px 0;}
.docskin .mc-metrics th.mc-value,.docskin .mc-metrics td.mc-value{text-align:right;}
.docskin .mc-metrics td.mc-value{font-family:var(--font-mono);font-variant-numeric:tabular-nums;font-weight:600;color:var(--ink);white-space:nowrap;}
/* ── chevrons (process chevron strip) — paper text on the one accent-filled step ── */
.docskin svg .t-name.ch-on-accent{fill:var(--paper);stroke:none;}
/* ── roadmap (themes × periods) — the current chip's label is bold ── */
.docskin svg .rm-label{font-size:10.5px;}
.docskin svg .rm-current{font-weight:600;}
/* perfbudget — metric names in the label column and the measured value at the bar end */
.docskin .pb-label{font-family:var(--font-mono);font-size:11px;font-weight:600;fill:var(--ink);}
.docskin .pb-val{font-weight:600;}
/* percentiles — the row label */
.docskin .pc-label{font-family:var(--font-mono);font-size:11px;font-weight:600;fill:var(--ink);}
/* threatmodel — trust boundaries restyle the shared group panel; the STRIDE table under the drawing */
.docskin .tm-bounds rect{fill:var(--negative-tint);fill-opacity:1;stroke:var(--negative);stroke-dasharray:4 3;}
.docskin .tm-bounds text{fill:var(--negative);}
.docskin .tm-scroll{overflow-x:auto;margin-top:14px;}
.docskin .tm-table{margin:0;font-size:12.5px;}
.docskin .tm-table td{vertical-align:top;color:var(--ink);}
.docskin .tm-id,.docskin .tm-target{font-family:var(--font-mono);font-size:11px;white-space:nowrap;}
.docskin .tm-id{color:var(--muted);font-weight:600;}
.docskin .tm-threat{font-weight:600;}
.docskin .tm-mit{color:var(--muted);}
.docskin .tm-none{color:var(--soft);}
.docskin .tm-cat{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:3px;border:1px solid var(--ink);color:var(--ink);background:var(--paper);font-family:var(--font-mono);font-size:10.5px;font-weight:700;text-decoration:none;cursor:help;}
.docskin .tm-st-open{color:var(--negative);border-color:var(--negative);}
.docskin .tm-st-accepted{background:var(--paper-2);border-color:var(--paper-2);color:var(--muted);}
/* ── code (refined) — accent bands for highlight, a counter gutter for lines, the cols / compare grid, wrap, captions ── */
.docskin .cb>pre{padding:14px 0;}
.docskin .cb .cl{display:block;padding:0 20px;}
.docskin .cb .cl-hl{background:color-mix(in srgb,var(--accent) 16%,transparent);box-shadow:inset 2px 0 0 var(--accent);}
.docskin .cb-lines>pre{counter-reset:line var(--code-start,0);}
.docskin .cb-lines .cl{padding-left:calc(20px + var(--code-gutter,2ch) + 14px);text-indent:calc(-1 * (var(--code-gutter,2ch) + 14px));}
.docskin .cb-lines .cl::before{counter-increment:line;content:counter(line);display:inline-block;width:var(--code-gutter,2ch);margin-right:14px;text-align:right;text-indent:0;color:var(--code-muted);opacity:.7;user-select:none;-webkit-user-select:none;}
.docskin .cb-wrap>pre{white-space:pre-wrap;overflow-wrap:anywhere;}
.docskin .code-grid{display:grid;grid-template-columns:repeat(var(--code-cols,1),minmax(0,1fr));gap:14px;margin:14px 0 18px;}
.docskin .code-grid>.code-block{margin:0;display:flex;flex-direction:column;background:var(--code-bg);}
.docskin .code-grid>.code-block>pre{flex:1 1 auto;}
@media(max-width:720px){.docskin .code-grid{grid-template-columns:1fr;}}
.docskin .code-eyebrow{font-size:8.5px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--code-muted);}
.docskin .code-cap{font-size:12px;color:var(--muted);line-height:1.45;padding:8px 16px 9px;background:var(--paper);border-top:1px solid var(--rule-solid);}
.docskin .code-cap-group{border:0;background:none;padding:0 2px;margin:-10px 0 18px;}`;
