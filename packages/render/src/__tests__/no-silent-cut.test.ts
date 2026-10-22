/**
 * The sweep: no renderer drops text the author wrote without showing it.
 *
 * Every catalog example, and a set of long-label stress blocks, is rendered.
 * Each text the author wrote in a label field (`name`, `label`, `tech`,
 * `note`, `desc`, …) must either show whole in the drawing, or — when the
 * renderer had to cut it — show cut with "…", carry its full text in a
 * `<title>`, and come back from `geometryReport` as a `label-truncated`
 * issue (which `check` shows as `W_GEOMETRY`). A text that is in none of
 * those places was dropped silently, and the sweep fails.
 */

import { describe, expect, it } from 'vitest';
import { BLOCK_TEMPLATES, parseDocument, type BlockType } from 'chiltepin-core';
import { htmlRenderers } from '../registry.js';
import { geometryReport, type GeometryReport } from '../geometryReport.js';

/** The data keys whose string values are author text a reader must see. */
const LABEL_KEYS: ReadonlySet<string> = new Set([
  'name',
  'label',
  'tech',
  'desc',
  'note',
  'role',
  'effect',
  'env',
  'stop',
  'center',
  'key',
  'attrs',
  'methods',
  'contains',
  'memory',
  'items',
  'model',
  'stereotype',
]);

/**
 * Block types whose renderer is owned by another lane and still drops a
 * catalog text it does not show, with the reason. Shrink this list; never
 * grow it to hide a new silent cut.
 */
const KNOWN: Readonly<Partial<Record<BlockType, string>>> = {};

const ENTITIES: Readonly<Record<string, string>> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/**
 * Decodes the HTML entities, then drops case (some renderers set a chip in
 * capitals), whitespace (lines wrap) and commas (a comma list draws as
 * separate pills or tabs).
 */
function squash(s: string): string {
  return s
    .replace(/&(?:amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m] ?? m)
    .toLowerCase()
    .replace(/[\s,]+/g, '');
}

/** The visible text of a render (titles removed), and the text of its titles. */
function textsOf(html: string): { visible: string; titles: string } {
  const titles = [...html.matchAll(/<title>([\s\S]*?)<\/title>/g)].map((m) => m[1] ?? '').join('\u0000');
  const visible = html
    .replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/<[^>]+>/g, ' ');
  return { visible: squash(visible), titles: squash(titles) };
}

/** Every author text in a label field: `[path, text]`. */
function labelTexts(data: unknown, path = ''): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const walk = (v: unknown, p: string, key: string | undefined): void => {
    if (typeof v === 'string') {
      if (key !== undefined && LABEL_KEYS.has(key) && v.trim() !== '') out.push([p, v]);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${p}.${i}`, key));
      return;
    }
    if (v !== null && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) walk(x, p === '' ? k : `${p}.${k}`, k);
    }
  };
  walk(data, path, undefined);
  return out;
}

/** The silent cuts in one rendered block: texts neither shown whole nor marked, titled and reported. */
function silentCuts(type: BlockType, data: unknown): string[] {
  const render = htmlRenderers[type] as (d: unknown) => string;
  const report = (geometryReport as (t: BlockType, d: unknown) => GeometryReport)(type, data);
  const cutPaths = new Set(report.issues.filter((i) => i.kind === 'label-truncated').map((i) => i.path));
  return silentIn(type, render(data), data, cutPaths);
}

/** The texts of `data` that `html` drops without "…", a `<title>` and a report in `cutPaths`. */
function silentIn(type: string, html: string, data: unknown, cutPaths: ReadonlySet<string | undefined>): string[] {
  const { visible, titles } = textsOf(html);
  const problems: string[] = [];
  for (const [path, text] of labelTexts(data)) {
    const t = squash(text);
    if (visible.includes(t)) continue;
    const marked = titles.includes(t) && html.includes('…') && cutPaths.has(path);
    if (!marked) {
      problems.push(
        `${type} ${path}: "${text}" — ${titles.includes(t) ? 'titled' : 'not titled'}, ${cutPaths.has(path) ? 'reported' : 'not reported'}`,
      );
    }
  }
  return problems;
}

/** The typed blocks of a markdown source. */
function blocksOf(md: string): Array<{ type: BlockType; data: unknown }> {
  return parseDocument(md, 'sweep').segments.flatMap((s) =>
    s.kind !== 'markdown' && s.data !== undefined && s.parseError === undefined ? [{ type: s.kind, data: s.data }] : [],
  );
}

describe('the sweep itself', () => {
  const data = { nodes: [{ id: 'a', name: 'Customer identity and access management platform' }] };
  it('flags a text dropped with no mark', () => {
    const html = '<svg><text>Customer identity and access</text></svg>';
    expect(silentIn('block', html, data, new Set())).toHaveLength(1);
  });
  it('flags a cut that has a <title> but no report', () => {
    const html =
      '<svg><text><title>Customer identity and access management platform</title>Customer identity and…</text></svg>';
    expect(silentIn('block', html, data, new Set())).toHaveLength(1);
    expect(silentIn('block', html, data, new Set(['nodes.0.name']))).toEqual([]);
  });
  it('accepts text shown whole across wrapped lines, in any case', () => {
    const html = '<svg><text>CUSTOMER IDENTITY AND</text><text>access management</text><text>platform</text></svg>';
    expect(silentIn('block', html, data, new Set())).toEqual([]);
  });
});

describe('no silent cut: every catalog example', () => {
  for (const type of Object.keys(BLOCK_TEMPLATES) as BlockType[]) {
    const known = KNOWN[type];
    it.skipIf(known !== undefined)(`${type}: every label shows whole, or cut with "…", a <title> and a report`, () => {
      for (const b of blocksOf(BLOCK_TEMPLATES[type])) expect(silentCuts(b.type, b.data)).toEqual([]);
    });
  }
});

/** Long, realistic names: snake_case, PascalCase, dotted packages, tool ids. */
const STRESS = `
\`\`\`block
preset: infra
nodes:
  - { id: lb, col: 1, row: 1, kind: lb, name: Application load balancer, tech: HTTPS 443 }
  - { id: svc, col: 2, row: 1, kind: service, name: Customer identity and access management platform, tech: Keycloak 24 on EKS with Postgres }
  - { id: db, col: 3, row: 1, kind: db, name: Orders Aurora PostgreSQL cluster, tech: Aurora 15 · multi-AZ }
  - { id: s3, col: 4, row: 1, kind: bucket, name: Invoice PDF archive bucket, tech: S3 IA · 7 year retention }
  - { id: q, col: 2, row: 2, kind: queue, name: order-events SQS FIFO queue, tech: SQS }
  - { id: vec, col: 3, row: 2, kind: vector, name: Product embeddings vector index, tech: pgvector · 1536 dims }
edges:
  - lb -> svc
  - svc -> db
  - db -> s3
  - svc -> q
  - q -> vec
\`\`\`

\`\`\`block
layers:
  - { label: Shared backbone with a long layer label for the band }
nodes:
  - { id: lib, layer: 0, kind: gateway, name: rbac middleware, tech: shared L1·L2·L3 }
  - { id: db, layer: 0, kind: db, name: App DB, tech: roles · permissions · entra_site_groups }
\`\`\`

\`\`\`cluster
clusters:
  - { id: ing, label: ingress-nginx-controller-namespace }
  - { id: app, label: checkout-payments-production }
services:
  - { id: ic, cluster: ing, label: ingress-controller, kind: ingress, tech: nginx 1.25 · cert-manager }
  - { id: api, cluster: app, label: payments-authorisation-api, kind: service, tech: Kotlin · Spring Boot 3, replicas: 4 }
  - { id: pg, cluster: app, label: payments-postgresql-primary, kind: db, tech: PostgreSQL 16 · Patroni }
edges:
  - ic -> api: HTTPS
\`\`\`

\`\`\`felogic
nodes:
  - { id: a, col: 1, row: 1, kind: component, name: PaymentMethodSelectionComponent, note: renders saved cards and the new card form }
  - { id: b, col: 2, row: 1, kind: hook, name: usePaymentIntentWithRetries, note: polls the intent status every two seconds }
  - { id: c, col: 3, row: 1, kind: db, name: Orders Aurora PostgreSQL cluster }
edges:
  - { from: a, to: b, label: uses }
\`\`\`

\`\`\`tree
variant: issue
unit: "%"
nodes:
  - { id: r, label: Monthly churn rose from 2.1% to 3.4% in Q3, value: 3.4 }
  - { id: a, parent: r, label: Involuntary churn from failed card payments, value: 1.2, note: retries stop after the third decline }
  - { id: b, parent: r, label: Voluntary churn after the price change, value: 2.2 }
\`\`\`

\`\`\`tree
variant: org
unit: people
nodes:
  - { id: r, label: Head of payments engineering and operations, role: VP Engineering, value: 42 }
  - { id: b, parent: r, label: Alternative payment methods and wallets, role: Staff engineer for wallets and local methods, value: 24 }
\`\`\`

\`\`\`gantt
periods: [Jan, Feb, "Sprint 3 · July 29 to August 11 · release freeze for the payments platform"]
tasks:
  - { label: Inventory every legacy cron job and its owners, start: 0, span: 1, kind: done }
  - { label: Dual-run old and new schedulers in production while the on-call team watches the error budget burn, start: 1, span: 2 }
\`\`\`

\`\`\`venn
sets:
  - { label: Platform engineering and site reliability }
  - { label: Product security and compliance office, desc: owns the controls catalogue and the audit evidence }
  - { label: Data platform }
shared:
  - { sets: [Platform engineering and site reliability, Product security and compliance office], label: secrets rotation and key management }
\`\`\`

\`\`\`fishbone
effect: Orders delivered more than two days after the promised date
causes:
  - { label: Warehouse operations and staffing, items: [Pick lists printed in batch once per shift, Too few pickers on weekend night shifts] }
  - { label: Systems, items: [Inventory sync lags behind the storefront by 20 minutes] }
\`\`\`
\`\`\`agentloop
agent: { name: Insurance claims triage and routing agent, model: claude-sonnet-4-6, note: Reads the claim, the policy and the photos, then routes the claim to straight-through payment, an adjuster, or the special investigations unit for suspected fraud. }
env: Claims intake portal and adjuster workbench
tools:
  - { name: fetch_policy_document, desc: Load the policy wording, endorsements and the coverage limits for the policy holder }
  - { name: score_fraud_risk, desc: Call the fraud model with claim features and return a calibrated probability }
  - { name: create_adjuster_task, desc: Open a task in the adjuster queue with a summary and the evidence links }
  - { name: crm.lookup_customer_history, desc: Prior claims and contact notes }
  - { name: payments.issue_straight_through_payment, desc: Pay a low-risk claim now }
  - { name: siu.refer_case, desc: Refer to special investigations }
  - { name: notify_policy_holder }
memory: [Claim history for the policy holder over the last five years, Photos and documents attached to this claim, case history · last five tickets]
stop: Claim routed, or 12 tool calls without a decision
\`\`\`

\`\`\`packet
width: 32
fields:
  - { label: Source port, bits: 16 }
  - { label: Destination port, bits: 16 }
  - { label: Sequence number, bits: 32 }
  - { label: Acknowledgment number, bits: 32 }
  - { label: Data offset, bits: 4 }
  - { label: Reserved, bits: 3 }
  - { label: NS, bits: 1 }
  - { label: CWR, bits: 1 }
  - { label: ECE, bits: 1 }
  - { label: URG, bits: 1 }
  - { label: ACK, bits: 1 }
  - { label: PSH, bits: 1 }
  - { label: RST, bits: 1 }
  - { label: SYN, bits: 1 }
  - { label: FIN, bits: 1 }
  - { label: Receive window size in bytes, bits: 16 }
  - { label: Checksum, bits: 16, accent: teal }
  - { label: Urgent pointer when URG is set, bits: 16 }
\`\`\`

\`\`\`uml
classes:
  - { id: svc, col: 1, row: 1, name: PaymentAuthorisationService, stereotype: service, attrs: ["- gateway: PaymentServiceProviderGatewayClient", "- retryPolicy: ExponentialBackoffRetryPolicy"], methods: ["+ authorise(intent: PaymentIntent, idempotencyKey: string): Promise<AuthorisationResult>", "+ capture(id: string): void"] }
  - { id: intent, col: 2, row: 1, name: PaymentIntent, attrs: ["+ id: string", "+ amount: Money", "+ status: PaymentIntentStatus"] }
  - { id: line, col: 2, row: 2, name: PaymentIntentLineItem, attrs: ["+ sku: string", "+ quantity: number"] }
rels:
  - { from: svc, to: intent, kind: dependency, label: authorises }
  - { from: intent, to: line, kind: composition, label: contains 1..* }
\`\`\`

\`\`\`frontend
nodes:
  - { id: app, name: CheckoutApplicationShellProvider, kind: root, note: wraps auth and feature flags }
  - { id: layout, parent: app, name: AuthenticatedCheckoutLayoutWithSidebar, kind: layout, note: two-column layout with sticky summary }
  - { id: page, parent: layout, name: PaymentMethodSelectionPage, kind: page, note: lazy loaded route /checkout/payment }
  - { id: form, parent: page, name: SavedCardsAndNewCardFormComponent, kind: component, note: renders Stripe Elements iframe }
  - { id: hook, parent: page, name: usePaymentIntentWithRetries, kind: hook, note: polls intent status every 2 s }
  - { id: store, parent: app, name: checkoutCartAndTotalsStore, kind: store, note: Zustand with persist middleware }
\`\`\`

\`\`\`pkg
packages:
  - { id: a, col: 1, row: 1, name: com.example.checkout.payments.adapters, contains: [StripePaymentGatewayAdapter, AdyenAdapter, payment_webhook_signature_verifier] }
  - { id: b, col: 2, row: 1, name: com.example.checkout.domain.model, contains: [Order, OrderLine, Money] }
deps:
  - { from: a, to: b, kind: import }
\`\`\`

\`\`\`context
window: 32000
segments:
  - { label: system prompt and safety policy, tokens: 4000 }
  - { label: tool schemas, tokens: 6000 }
  - { label: case history, tokens: 12000 }
  - { label: retrieved documentation chunks, tokens: 24000 }
  - { label: q, tokens: 800 }
  - { label: question + draft answer, tokens: 3000 }
\`\`\`

\`\`\`neuralnet
layers:
  - { label: Token embedding layer with rotary positions, units: 4096, kind: embedding, note: vocabulary of 128k byte-pair tokens }
  - { label: Grouped-query self-attention, units: 4096, kind: attention, activation: softmax, note: 32 query heads sharing 8 key-value heads }
  - { label: Layer norm, units: 4096, kind: norm }
  - { label: Output projection, units: 128000, kind: output, activation: softmax }
\`\`\`

\`\`\`array
items:
  - { value: "user:1042", label: head }
  - { value: "user:2087", label: i, tone: active }
  - { value: "session:9f3a", label: j, tone: visited }
  - { value: "cart:77", label: mid }
  - { value: "order:500121", label: tail, tone: target }
window: { from: 1, to: 3, label: sliding window of recent keys }
showIndex: true
\`\`\`

\`\`\`linkedlist
kind: doubly
nodes:
  - { value: "user:1042", label: head }
  - { value: "session:9f3a", label: prev }
  - { value: "cart:77", label: curr, tone: active }
  - { value: "order:500121", label: next }
  - { value: "invoice:88", label: tail }
nullEnd: true
\`\`\`

\`\`\`hashmap
buckets: 4
entries:
  - { key: "session:9f3a2c", value: "user_1042_checkout", bucket: 0 }
  - { key: "cart:77", value: "3 items", bucket: 0, tone: active }
  - { key: "order:500121", value: "pending_payment", bucket: 2 }
\`\`\`

\`\`\`cycle
steps:
  - { label: Detect and page the on-call engineer, desc: Alert fires from the SLO burn-rate rule }
  - { label: Triage severity and open an incident channel }
  - { label: Mitigate customer impact with rollback or feature flag }
  - { label: Resolve the root cause in code or configuration }
  - { label: Write the blameless postmortem within five days }
  - { label: Track action items to completion in the backlog }
center: every SEV1 and SEV2 incident
\`\`\`

\`\`\`treemap
unit: k$
items:
  - { label: Kubernetes compute for checkout services, value: 420 }
  - { label: Aurora PostgreSQL clusters, value: 260 }
  - { label: S3 storage and data transfer, value: 90 }
  - { label: CloudWatch logs and metrics ingestion, value: 40 }
  - { label: Misc, value: 8 }
\`\`\`

\`\`\`threatmodel
boundaries:
  - { id: dmz, label: Internet facing DMZ, col: 1, row: 1 }
nodes:
  - { id: user, col: 1, row: 1, name: Customer mobile banking application, kind: external }
  - { id: api, col: 2, row: 1, name: Payment authorisation API gateway, kind: process }
  - { id: db, col: 3, row: 1, name: Card vault tokenisation database, kind: store }
edges:
  - { from: user, to: api, label: card details, channel: tls }
  - { from: api, to: db, label: PAN, channel: plain }
threats:
  - { target: api, category: S, threat: Stolen session token replayed against the API, severity: high }
\`\`\`

\`\`\`dfd
nodes:
  - { id: c, col: 1, row: 1, name: Registered customer with active subscription, kind: external }
  - { id: p, col: 2, row: 1, name: Validate payment details and create the payment intent, kind: process, num: 1 }
  - { id: s, col: 3, row: 1, name: payment_intents_postgresql_table, kind: store }
edges:
  - c -> p: card details
  - p -> s: intent row
\`\`\`

\`\`\`wireframe
screens:
  - device: phone
    title: Payment method selection for returning customers
    elements:
      - { type: header, label: Choose how you would like to pay for this order }
      - { type: tabs, label: "Saved cards, New card, PayPal, Apple Pay" }
      - { type: button, label: Pay 120.00 EUR now with the saved Visa card }
\`\`\`

`;

describe('no silent cut: long-label stress blocks', () => {
  const blocks = blocksOf(STRESS);
  it('parses every stress block', () => {
    expect(blocks.length).toBe(24);
  });
  blocks.forEach((b, i) => {
    it(`${i + 1}. ${b.type}: every long label shows whole, or cut with "…", a <title> and a report`, () => {
      expect(silentCuts(b.type, b.data)).toEqual([]);
    });
  });
});
