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

## Usage

From this repository:

```powershell
npm run eval:no-fail
```

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
```

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

## Interpreting Results

This harness is intentionally stricter and wider than the current regression
tests. A failure means the skill has a capability gap or a routing ambiguity
under this evaluation standard. It does not necessarily mean the existing skill
is broken for its original one-click website payment integration use case.
