---
title: chatcut 2.0
weight: 4
summary: Chat-driven video editing — natural language in, real Premiere Pro timeline operations out, via a custom MCP server.
stack: [Rust, MCP, Adobe Premiere Pro]
metrics:
  - custom Adobe Premiere Pro MCP server — timeline, clips, transitions, render queue as tool calls
  - built in UCSC's CSE115C software engineering sequence
links:
  note: UCSC course project — ask for a demo
---

Video editing has a brutal learning curve and most of it is mechanical: razor here, trim
there, push to the render queue. ChatCut 2.0 puts a language model in front of Adobe
Premiere Pro so you can say *"cut the dead air, add a cross-dissolve between scenes two and
three, and render a 1080p preview"* and watch the timeline do it.

The interesting engineering is the bridge: a from-scratch **Premiere Pro MCP server** that
exposes the editor's surface — sequences, clips, markers, transitions, effects, audio
levels, proxies, the render queue — as structured tool calls. The LLM never touches pixels;
it orchestrates a real editor with real project files, so everything it does is inspectable
and undoable in the app you already use.

Built with a team in UCSC's CSE115C; I own the MCP layer in Rust.
