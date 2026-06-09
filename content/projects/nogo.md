---
title: nogo
weight: 5
summary: A lightweight, rules-driven rate limiter — the open-source descendant of a notification gate that cut infra costs by 40%.
stack: [Go]
metrics:
  - rules engine decides per-message, per-channel whether a notification deserves to exist
  - lineage — the MakeMyTrip limiter governing SMS/WhatsApp/email at OTA scale
links:
  github: https://github.com/pronei/nogo
---

At MakeMyTrip I built a rule-based rate limiter that decided which notifications were worth
sending across SMS, WhatsApp and email. The result was fewer, better messages — engagement
went up while infra cost went down by as much as 40%, because the cheapest notification is
the one you don't send.

**nogo** is the distilled, open version of that idea: a small Go library where rate limiting
is driven by declarative rules rather than a single global bucket. Different message
classes, different channels, different users — each gets its own policy, and the policies
compose. The name is the API: most of the time, the correct answer is no.
