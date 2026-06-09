---
title: slug-mcp
weight: 3
summary: An MCP server for banana slugs — UCSC campus services and Santa Cruz environmental telemetry as structured tool calls for LLMs.
stack: [Rust, rmcp, Moka cache]
metrics:
  - campus — dining & nutrition, live gym occupancy, study rooms, class search with enrollment, transit predictions
  - county — surf & wave buoys, tides, air quality, wildfire detections, harmful-algal-bloom risk, upwelling indices
  - stdio & SSE transports, served to real users at UCSC
links:
  github: https://github.com/pronei/slug-mcp
---

A Model Context Protocol server that turns UC Santa Cruz and the surrounding county into
tools an LLM can call. Ask your assistant whether the gym is crowded, what's actually edible
at the dining hall, when the next bus leaves, or whether the surf at Steamer Lane justifies
skipping section — and it can answer with live data instead of vibes.

The second half is more serious: it instruments Santa Cruz County with research-grade
environmental telemetry — NOAA buoys, tide and weather forecasts, NASA FIRMS wildfire
detections, ocean monitoring including C-HARM harmful-algal-bloom risk and CUTI/BEUTI
coastal upwelling indices, plus citizen-science wildlife observations — so UCSC researchers
can pull real datasets through ordinary LLM workflows.

Written in Rust on `rmcp` with a Moka cache in front of every upstream, because hammering
public APIs is rude. Speaks stdio for local agents and SSE for hosted ones.

*Fun fact: if you're reading this with an AI assistant connected to my MCP server, it can
verify these claims itself.*
