---
title: faults-lab
weight: 1
summary: Which service owes you the milliseconds? A platform that answers by running the counterfactual — freeze one service, replay the identical load, measure what moved — instead of guessing from traces.
greek:
  glyph: Ἄ
  translit: atropos · zeus · manteion
  gloss: the Fate who cuts the thread, the lightning-thrower, and the oracle
stack: [Go, OpenTelemetry, gRPC, Kubernetes, k6, Vegeta, Postgres]
metrics:
  - attribution by intervention — a frozen service answers from its own recorded responses, so its share of the tail is measured, not estimated
  - on an eleven-service Go mesh, one freeze removed exactly its caller's share, and contained latency, error and hang faults alike, crash loop included
  - every phase carries a validity verdict; runs that fail their own checks are refused rather than reported
links:
  github: https://github.com/orgs/microfaults/repositories
---

My MS research at UC Santa Cruz, advised by Peter Alvaro.

A load test against a microservice mesh ends in one number — say, checkout p99 at 800 ms. The
question that matters is counterfactual. How much of that is the shared cart service, and
what would checkout look like without it? Tracing can't say. Traces show who was slow, not
what would happen if they weren't, and under contention the services' delays are neither
independent nor additive: two services queueing on each other cost more together than the
sum of each alone. Blame diffuses, and the dashboard shrugs.

## the idea

**Measure by intervening instead of inferring.** Change exactly one thing in a running copy
of the system, keep the open-loop traffic identical, and measure what moved. The intervention
that makes this work is the *cache-box*: freeze a service so it answers from its own recorded
responses. It does no work and queues nothing, but the call graph stays intact. Take a
suspect off the critical path this way and the tail it was causing leaves with it; what
remains belongs to everyone else.

## why it's new

The nearest prior work each stops one step short. Critical-path tools (CRISP, the Mystery
Machine) find the bottleneck but can't remove it. Observational causal models (Sage, CIRCA)
estimate counterfactuals from data that may never contain them. Boundary fault injection
(Filibuster, 3MileBeach) intervenes, but tests pass-or-fail correctness rather than
continuous latency. Causal profiling (Coz) is the closest in spirit — it measures what
speeding a component up would buy — but it needs thread-level control, so it stops at the
process boundary. faults-lab carries that interventional idea across the network, at the
interposition points fault injection already uses.

## what it showed

On an eleven-service Go port of Google's Online Boutique: the tail cost of a slow shared
dependency grows in proportion to how many times a request path crosses it; freezing one
caller removes exactly that caller's share, which itself splits into a contention part and
the dependency's own latency; and the same freeze contains latency, error and hang faults
alike, including one that had already escalated into a crash loop.

## an instrument that polices itself

A number is only as good as the run that produced it. Replay is fail-closed: a request the
recording doesn't cover gets a 503 and is counted, never quietly forwarded. Every phase ends
with a verdict — valid, valid with warnings, or invalid — from checks like "did the recording
cover every request the replay needed" and "did the load generator drop iterations". Invalid
runs are refused rather than reported. Several were.

## the parts

- **atropos** (the Fate who cuts the thread) — an SDK compiled into every service. It traces
  each request at the HTTP and gRPC boundary, injects faults there (latency, errors, hangs,
  CPU, memory and disk pressure), and records and replays responses for the cache-box.
- **zeus-go** (throws the lightning) — load orchestration: declarative workflow DAGs,
  persona-based k6 runs, and a policy engine that fires Vegeta bursts, replaying the same
  open-loop workload in every phase.
- **manteion** (the oracle at Delphi) — the control plane. It pushes rules to every live SDK,
  sequences baseline, fault and freeze phases, drains each phase before closing it, and hands
  down the verdicts.

W3C Baggage carries one trace ID from edge to leaf through all of it.
