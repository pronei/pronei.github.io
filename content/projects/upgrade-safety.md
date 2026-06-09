---
title: global upgrade safety & MSS
weight: 2
summary: Static analysis that decides whether simultaneous schema changes across a microservice mesh can co-deploy safely — and computes the maximal safe subset when they can't.
stack: [Go, OpenAPI, Protobuf]
metrics:
  - MSS computed in linear time — reduction to MAX-TRUE Horn-SAT
  - four-schema edge model (Send/Accept/Return/Expect)
  - catches multi-hop integrity violations invisible to pairwise tools (Buf, Pact)
links:
  github: https://github.com/pronei/gus-mss-poc
---

Microservice meshes deploy schema changes constantly, and the tooling that guards them —
Buf breaking-change detection, Pact contract tests — is **pairwise**. It can tell you that
service A and service B still agree. It cannot tell you that a field flowing A → B → C
arrives at C with a type C no longer expects, because no single pair broke.

This tool checks the whole mesh at once. Each edge carries four schemas — what the caller
**Sends** and **Expects** back, what the callee **Accepts** and **Returns** — plus
endpoint-only data-flow annotations, so chains are discovered automatically and multi-hop
violations surface.

When a set of simultaneous changes can't co-deploy, it doesn't just say no: it computes the
**maximal safe subset** — the largest set of changes that *can* ship together — in linear
time, via a reduction to MAX-TRUE Horn-SAT, and pinpoints the exact fields and type
mismatches responsible for excluding the rest. Your deploy train leaves with most of its
cargo instead of being cancelled.
