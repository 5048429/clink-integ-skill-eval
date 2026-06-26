# Clink Integration Skill Evaluation

This repository is an independent capability evaluation harness for the local
`clink-integ-skills` skill. It does not modify or depend on the official
`clinkbillcom/clink-integ-skills` tests.

## Purpose

The evaluation focuses on integration capability coverage rather than narrow
regression compatibility. It checks whether the skill can correctly route,
question, validate, and produce artifacts across the full Clink integration
surface:

- standard hosted checkout and webhook integration
- CLI-first Secret Key and webhook endpoint setup
- registered and non-registered product modes
- catalog import and product discovery
- Elements embedded checkout
- resource/documentation guidance
- external PSP account linking for payment orchestration
- subscription, invoice, coupon, portal, wallet, finance, and dispute flows
- new user onboarding
- generic and OpenClaw agent integration paths
- production validation gate behavior
- precision and negative-trigger cases

## CLI-First Standard

The evaluator treats CLI-first behavior as a hard standard:

- preferred webhook endpoint setup is `clink webhook endpoint ensure --url ... --events core --save-secret --json`
- Dashboard Webhooks may appear only as a manual, fallback, legacy, or visibility path
- `CLINK_WEBHOOK_SIGNING_KEY` should not be requested initially; it should come from endpoint ensure and be synced into the runtime
- every webhook path should include signing-secret sync plus service restart/redeploy before verification

## Quick Usage

From this repository:

```powershell
npm run eval:no-fail
```

Equivalent report-focused alias:

```powershell
npm run eval:report
```

This writes both a machine-readable JSON report and a human-readable Markdown
report with conclusion, category tables, failed-case tables, and suggested
fixes.

By default it evaluates:

```text
..\agent-prompts\skills\clink-integ-skills
```

To evaluate another local copy:

```powershell
npm run eval:no-fail -- --skill-root D:\path\to\skills\clink-integ-skills
```

To fail the command when any capability case fails:

```powershell
npm run eval
```

To write JSON to stdout:

```powershell
npm run eval:json
```

Reports are written to:

```text
reports\latest-report.json
reports\latest-report.md
```

To choose report output paths:

```powershell
npm run eval:no-fail -- --report reports\my-run.json --report-md reports\my-run.md
```

The command evaluates the default local skill at
`..\agent-prompts\skills\clink-integ-skills`. Use `--skill-root` when comparing
another skill copy, including a temporary clone of an official repository.

## Human-Readable Report

The Markdown report is intended for review and planning. It includes:

- executive conclusion with an overall status such as `PASS`, `STRONG_WITH_GAPS`, `USABLE_WITH_GAPS`, or `NEEDS_WORK`
- score summary and pass rate
- fully passed categories as strengths
- failed categories as priority gaps
- recommended next fixes inferred from failed cases
- category summary table
- route summary table
- failed-case table with failure summary and suggested fix
- full case-result table for all matrix cases

Use the JSON report for automation, and use the Markdown report for human
review, team discussion, and deciding the next skill-improvement sprint.

## Evaluation Data

The matrix lives in:

```text
cases\clink-integ-capability-matrix.json
```

Each case can assert:

- expected route or route set
- expected route confidence
- expected environment
- expected docs gate behavior
- required/missing artifacts
- required/missing notes
- required/missing questions
- validation result and error text
- production validation and runtime-state behavior
- negative trigger behavior

## Detailed Evaluation Cases

The default matrix contains 43 capability cases. The table below mirrors
`cases\clink-integ-capability-matrix.json` so the repository landing page
documents exactly what is being scored.

| Category | Case ID | Capability | Key Checks |
|---|---|---|---|
| standard | `std-hosted-checkout-webhook-cli` | Hosted checkout plus webhook, CLI-first | Standard route, sandbox, integration/webhook/signing artifacts, `merchantReferenceId`, `clink webhook endpoint ensure`. |
| standard | `std-implementation-without-stack` | Implementation request asks for missing backend stack | Standard route with medium/low confidence, asks for backend language and product mode, emits implementation TODO. |
| standard | `std-express-stack-inference` | Infer backend stack from local context | Infers Node.js/Express from `package.json`, avoids asking for backend language. |
| standard | `std-local-secret-bootstrap` | Local desktop Secret Key bootstrap | Standard or onboarding route, emits secret/CLI setup artifacts, avoids Dashboard Console token dependency. |
| standard | `std-browserless-secret-key` | Browserless Secret Key setup | Standard or onboarding route, supports `CLINK_SECRET_KEY`, avoids asking initially for `CLINK_WEBHOOK_SIGNING_KEY`. |
| standard | `std-webhook-endpoint-automation` | Webhook endpoint automation | Standard route, emits webhook endpoint automation and signing-secret sync, prefers CLI endpoint ensure. |
| standard | `std-dashboard-fallback-not-primary` | Dashboard Webhooks fallback wording | Review or standard route, keeps Dashboard Webhooks as fallback/manual while CLI remains primary. |
| standard | `std-registered-product-mode` | Registered product mode | Standard route, emits product/price sourcing, does not ask product-mode question when mode is explicit. |
| standard | `std-catalog-import` | Catalog import from merchant site | Standard route, emits catalog import plan and product/price sourcing. |
| standard | `std-non-registered-price-data-list` | Non-registered product mode | Standard route, emits inline payload design and merchant order mapping, avoids product-mode question. |
| standard | `std-external-psp-link` | External PSP account linking for orchestration | Documentation dialogue, docs gate, docs fact table for `guides/payments/link_psp`, avoids invented routing or settlement behavior. |
| elements | `std-elements-react` | Elements embedded checkout | Standard route, emits Elements frontend/event/lifecycle/server-client artifacts and embedded component note. |
| elements | `std-elements-event-semantics` | Elements event semantics | Standard route, checks submit/event mapping and webhook-authoritative note. |
| elements | `std-elements-promo-layout` | Elements promotion and layout | Standard route, emits layout recipe, promotion-code UI contract, and event mapping. |
| onboarding | `onboarding-first-run` | New user first run | Onboarding route, sandbox, docs gate, onboarding/secret/CLI/webhook artifacts. |
| onboarding | `onboarding-production-guard` | Production onboarding guardrail | Onboarding route stays sandbox, no production validation, adds production-onboarding sandbox note. |
| resources | `resource-order-sync` | Order query and reconciliation | Standard route, docs gate, merchant order mapping and webhook handler artifacts. |
| resources | `resource-refund-lifecycle` | Refund lifecycle | Standard or docs route, docs gate, warns when public refund-create API is not confirmed. |
| resources | `resource-product-price-image` | Product, price, image | Standard or docs route, docs gate, catalog import plan or docs fact table. |
| resources | `resource-customer` | Customer resource | Documentation dialogue, docs gate, docs fact table. |
| resources | `resource-payment-instrument` | Payment instrument | Documentation dialogue, docs gate, docs fact table, frontend secret boundary. |
| resources | `resource-wallet-qr` | Wallet QR refresh | Documentation dialogue, docs gate, docs fact table. |
| usage | `usage-subscription-billing` | Subscription and invoice billing | Standard route, docs gate, product/price sourcing and webhook handler artifacts. |
| usage | `usage-invoice-lookup` | Invoice lookup | Documentation dialogue, docs gate, docs fact table. |
| usage | `usage-coupon-promotion` | Coupon and promotion code | Documentation dialogue, docs gate, docs fact table. |
| usage | `usage-customer-portal` | Customer portal | Standard route, integration checklist. |
| usage | `usage-test-clock` | Test clock | Documentation dialogue, docs gate, docs fact table. |
| usage | `usage-finance-payout` | Finance balance and payout | Documentation dialogue, docs gate, docs fact table, avoids invented approval steps. |
| usage | `usage-dispute-webhook` | Dispute webhook | Integration validation route, validation report and launch readiness checklist. |
| usage | `account-merchant-user-management` | Merchant and user management | Onboarding or docs route, docs gate, dashboard checklist or docs fact table. |
| agent | `agent-openclaw-payment-handoff` | OpenClaw merchant skill | Agent route, payment handoff/server/recovery/ownership artifacts, rejects plain checkout redirect framing. |
| agent | `agent-generic-agentic-payment` | Generic agent payment skill | Agent route, payment handoff and ownership artifacts for non-OpenClaw agentic payment. |
| agent | `agent-payment-session-server` | Agent payment session server | Agent route, merchant server capabilities and payment handoff contract. |
| review | `review-webhook-risk` | Webhook design review | Review or standard route, risk/remediation/webhook artifacts for missing webhook controls. |
| comparison | `comparison-standard-agent` | Standard vs agent integration comparison | Comparison route, comparison matrix artifact. |
| validation | `validation-webhook-cli-pass` | Webhook validation pass | Validation route, valid webhook design, validation report and launch readiness checklist. |
| validation | `validation-webhook-missing-sync-fails` | Webhook validation catches missing controls | Validation route, invalid webhook design, error includes missing signing key sync. |
| validation | `validation-production-approved` | Production gate approval | Standard route, production environment, production validation passed, approved runtime state, launch and promotion artifacts. |
| validation | `validation-production-without-input-demotes` | Production gate failure demotes to sandbox | Standard route, demotes to sandbox, failed production validation, remediation-only artifacts. |
| precision | `precision-doc-qa` | Documentation question without implementation | Documentation dialogue, docs gate, docs fact table. |
| precision | `precision-negative-stripe` | Negative sample for another PSP | Expected non-trigger for Stripe-only payment prompt. |
| precision | `precision-secret-redaction` | Sensitive values should not be embedded | Standard or review route, notes include secret-safety wording. |
| precision | `precision-ambiguous-standard-agent` | Ambiguous standard plus agent request | Standard route with low confidence, exposes standard/agent ambiguity and asks clarification. |

## Interpreting Results

This harness is intentionally stricter and wider than the current regression
tests. A failure means the skill has a capability gap or a routing ambiguity
under this evaluation standard. It does not necessarily mean the existing skill
is broken for its original one-click website payment integration use case.
