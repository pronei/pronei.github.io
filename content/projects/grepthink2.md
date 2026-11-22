---
title: grepthink2
weight: 2
summary: Team-project management for UC Santa Cruz's software-engineering course series, since adopted by Istinye University — classes, teams, self-reviews, TA meetings and a scrum board, live at grepthink2.com. I TA'd the series and led the v2 rebuild.
stack: [TypeScript, React 19, Vite, SCSS, Python, FastAPI, Supabase Postgres, Vercel]
metrics:
  - the platform behind CSE 115A/B/C — one account can hold a different role in each class, across institutions
  - primary developer — 100 merged pull requests, 913 of ~1,400 commits since January 2026; Vitest and pytest coverage gates on every pull request
  - entry bundle cut 57% (416 → 179 kB) with lazy routes; up to 40% fewer database round trips on hot routes by selecting on write
links:
  live: https://grepthink2.com
  github: https://github.com/grepthink2/grepthink2.0
---

CSE 115 is the UCSC software-engineering series: a quarter of personal projects, then two
quarters of sponsored ones with real companies. Running it means forming teams, collecting
weekly team self-reviews, holding a TA meeting per project, taking attendance and grading
all of it. The first grepthink.com did this for years and had earned a rewrite. I was a TA on
the series, so I led the rebuild, with students from the course contributing.

**What it does.** An instructor creates a class under their school, imports the roster,
invites students and designates TAs; one account can hold a different role in each class.
Students create or join project teams, or get assigned to them, and submit team self-reviews
that their TA reviews. Every project has a weekly meeting with its TA and a scrum board:
sprints, user stories, tasks, burnup charts, comments and pull-request links. Messaging is
built in, with in-app notifications and email reminders and digests that people can turn
off.

**How it's built.** React 19, TypeScript and Vite on the front, styled in SCSS and ported by
hand from a Claude Design export. FastAPI on Supabase Postgres behind it, with SQL migrations
applied by hand and a style guide that spells out layers, authorization and batching rules.
Both sides run coverage-gated tests on every pull request, and a check fails the build if a
migration lands without updating the schema snapshot. It's AGPL-3.0 and hosted on Vercel.

The part I'd defend: the roles. A student in one class can be a TA in another, and the
permission model has to hold that without special cases. Roles come from the class, not the
account, and every class belongs to an institution, which is what let an instructor at
Istinye University in Istanbul run a course on it with no special build. Getting that right
once made every later feature smaller.
