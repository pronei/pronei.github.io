---
title: caltrip
weight: 8
status: in progress
summary: An unofficial, HTML-first rethink of caltrain.com — static pages under a 70 KB script budget, a Go service streaming live departures over SSE, and a design system that lives in code.
stack: [Astro 7, Preact, TypeScript, Go, GTFS-Realtime, Cloudflare Pages, Fly.io]
metrics:
  - script per page cut from ~80 KB to ~22 KB gzip by rendering islands with Preact compat; the budget is enforced by the build
  - one Go poller stays inside 511's 60-requests-an-hour quota and fans out to SSE streams per station and per train, resuming from an in-memory ring buffer
  - every time says where it came from — the published schedule, the live feed, or an illustrative fixture — and connecting agencies are included
links:
  note: public at launch
---

Caltrain's own site is built for the agency; a rider wants one thing, now, on a phone with a
weak signal on the platform. Caltrip is the rider's version: the next departures from your
station, a planner, the timetable, a station page with connections, and a live map, all as
static HTML that loads fast and keeps working when the network doesn't. It isn't affiliated
with Caltrain or the Peninsula Corridor Joint Powers Board and uses none of their marks.

**Data honesty is the design rule.** Times come from the published GTFS schedule or the 511
real-time feed and say which; anything illustrative is labelled and kept out of production
by the build. Connections (VTA, BART, SamTrans, Muni, ACE, Capitol Corridor) come from the
same regional feed. Facts beyond the timetable live in one file with a source and a
checked-on date each, and claims without a source are marked unverified.

**Live service.** A single Go binary polls 511's GTFS-Realtime feeds, paced to stay inside
the 60-requests-an-hour key quota, and serves `text/event-stream` per station and per
train, resuming with `Last-Event-ID` from a ring buffer. It runs on one Fly.io machine near
the corridor; the static site on Cloudflare Pages bakes the service URL in at build time.

**Budget.** Pages are static Astro with islands that hydrate on view. Rendering those islands
with Preact compat instead of React took the home page from 87 KB to under 28 KB of gzipped
script, and `pnpm check` fails the build if a page goes over 70 KB again. The design system
is a package in the same repo: `tokens.json` generates the CSS, and the components ship with
guidelines and previews so the design canvas and the app share one source.

It's in progress: the screens, data layer, map, live service and budgets are built; the
release pass and motion work are next, and it goes public when they land.
