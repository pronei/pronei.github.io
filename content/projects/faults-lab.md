---
title: faults-lab
weight: 1
summary: A fault-injection research platform — inject faults at service boundaries, isolate each service's contribution to tail latency under concurrent load.
greek:
  glyph: Ἄ
  translit: atropos · zeus · manteion
  gloss: the Fate who cuts the thread, the lightning-thrower, and the oracle
stack: [Go, OpenTelemetry, gRPC, Kubernetes, k6, Vegeta, Postgres]
metrics:
  - SDK-level injection at HTTP middleware & gRPC interceptor boundaries
  - cache-box primitive freezes services into cached-response replay
  - W3C Baggage propagation for end-to-end trace correlation
links:
  github: https://github.com/orgs/microfaults/repositories
---

My MS research at UCSC. The question: when a request crosses ten services and the p99 goes
bad, **which service actually owes you the milliseconds?** Aggregate dashboards can't answer
that — everything degrades together under load, and blame diffuses.

faults-lab answers it with three components, each named for its job:

**atropos** (the Fate who cuts the thread) is an instrumentation SDK that embeds at service
boundaries — HTTP middleware, gRPC interceptors — and injects faults: latency, TCP toxics,
CPU/IO stress. Its sharpest tool is the *cache-box* primitive: freeze a service into replaying
cached responses, effectively removing it from the latency equation, so you can measure every
other service's contribution in isolation.

**zeus-go** (throws the lightning) is the load orchestration layer: declarative JSON workflow
DAGs, persona-based k6 sidecars, and a policy engine that auto-triggers Vegeta attacks when
conditions are met.

**manteion** (the oracle at Delphi) runs experiments end to end — schedules fault campaigns,
watches the traces come back, and persists verdicts in Postgres. The current work-in-progress
is experiment resume and a smarter attack scheduler.

All of it is correlated with W3C Baggage so a single trace ID follows a request through
injected chaos from edge to leaf. Recently I've been exploring what an
Antithesis-style deterministic hypervisor would buy the platform — which sources of
interference disappear when the whole system under test is deterministic.
