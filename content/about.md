---
title: about
summary: Who I am, how I got here, and why everything is named after Greek mythology.
menu_weight: 10
weight: 90
---

I'm Pranay. I build distributed systems, then break them on purpose to find out where the
tail latency hides.

The short version: electronics undergrad in Bengaluru → robotics research at ARTPARK @ IISc
(log aggregation and safety systems for warehouse robots) → two years at MakeMyTrip running
A/B infrastructure at India-travel scale, where I learned that a 50ms p99 is a personal
insult — we got it under a millisecond at 30k requests/second. Now I'm finishing an MS in
Computer Science at UC Santa Cruz, where my research is **faults-lab**: a platform for
injecting faults at service boundaries and isolating each service's contribution to tail
latency under load.

What I care about, in order: correctness, p99s, and APIs that don't make the next engineer's
life worse. I write Go and Rust by preference, Java when the legacy platform demands it, and
I instrument everything — if it doesn't emit traces, it didn't happen.

### on naming things

Every system I build gets a name from classical mythology, and the names are load-bearing:

- **atropos** — the Fate who cuts the thread. It's the fault injector; it decides when your request dies.
- **zeus** — throws the lightning. Load orchestration; it commands the Vegeta attacks.
- **manteion** — the oracle at Delphi. The experiment brain that observes everything and answers questions.

The chat widget in the nav is called the oracle for the same reason. I am aware this is a
disease. I have no plans to treat it.

### elsewhere

When not staring at Grafana: I'm somewhere between San Francisco and Santa Cruz, and I built
[slug-mcp](https://github.com/pronei/slug-mcp) partly so my own AI tools could tell me the
surf conditions and whether the campus gym is full. I also TA'd UCSC's software engineering
sequence (CSE115A/B/C), mentoring teams on projects sponsored by Nutanix and Keysight.

If any of this sounds like your kind of problem, [say hello](/contact/).
