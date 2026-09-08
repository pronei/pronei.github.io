---
title: chatcut 3.0
weight: 4
summary: Natural-language video editing on real footage — a Premiere Pro plugin and a standalone desktop editor sharing one AI backend. Vibe editing, not AI-generated video.
stack: [Python, FastAPI, TypeScript, React, Tauri, Rust, Premiere Pro UXP]
metrics:
  - two front ends — an Adobe Premiere Pro UXP panel and a standalone Tauri + Next.js desktop/browser editor
  - one shared FastAPI backend — AI providers (Gemini, Groq), video processing, Redis-backed caching
  - Rust native layer (Tauri) for FFmpeg and OS integration; successor to the CSE115C ChatCut 2.0 team project
links:
  github: https://github.com/pronei/ChatCut-3.0
---

Video editing has a brutal learning curve and most of it is mechanical: razor here, trim
there, push to the render queue. ChatCut puts a language model in front of the editor so
you can say *"cut the dead air, add a cross-dissolve between scenes two and three, and
render a 1080p preview"* and watch the timeline do it — on **your** footage. It's vibe
editing, not AI-generated video.

3.0 ships two front ends on one backend. The **Premiere Pro plugin** is a UXP panel that
drives the real editor — sequences, clips, transitions, the render queue — so everything
the model does is inspectable and undoable in the app you already use. The **standalone
editor** is a Tauri + Next.js desktop/browser app with a Rust native layer for FFmpeg and
OS integration, for people who don't live in Premiere. Both talk to a shared Python
FastAPI service that routes to AI providers (Gemini, Groq), handles video processing, and
caches through Redis.

It grew out of ChatCut 2.0, the UCSC CSE115C team project; 3.0 is my own continuation.
