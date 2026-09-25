# Portfolio design — approved 2026-06-09

## Intent

A portfolio for a distributed-systems engineer whose stated design language is
"no-nonsense: simplicity, performance, ease of use", with a quirk that is actually his:
he injects faults into distributed systems for a living and names everything after Greek
mythology. The 2024–2026 portfolio meta-review consensus shaped the constraints: text-first
beats flashy for backend engineers; concrete metrics and architecture thinking signal
credibility; the cardinal sins are heavy unoptimized hero images, text-over-photo contrast
failures, scroll-jacking, and broken links.

## Decisions (user-approved)

| Axis | Decision | Why |
|---|---|---|
| Framework | **Hugo** (extended, single binary) | User choice; zero npm forever; `images.Colors` makes the theming pipeline dependency-free |
| Identity | **Chaos-engineering theme** | Homepage is a status page; visitors can inject a (reversible, presentation-only) fault; mythology naming surfaced on project plaques |
| Chatbot | **⌘K "ask an agent" via a Cloudflare Workers AI proxy** (`workers/oracle`, free tier) | v1 was BYO-Anthropic-key (removed 2026-06-09); a keyless free model was the ask — see `workers/oracle/README.md` for the research verdict. Grounded via build-generated /llms-full.txt (context stuffing — no RAG at ~15KB) |
| Backgrounds | **Generated placeholders** | Three procedural images (numpy, committed script) prove the palette pipeline; user swaps in photos whenever |

## Architecture

- **Theming**: `scripts/palette.py` (oklab k-means, Material-style scoring, WCAG-snapped
  tones) writes `data/palettes.yaml`; `theme.html` emits it as CSS custom properties
  inline *after* the stylesheet. The original `images.Colors` template heuristic was
  removed in Sept 2026 — a missing palette entry is now a build error.
  Per-page override via `background:` front matter, cached per image with `partialCached`.
- **Type**: Departure Mono (22KB woff2, OFL) for display/labels — the terminal-native
  voice; system sans for body; `ui-monospace` inline. No other downloads.
- **JS policy**: nothing loads until interaction. Chaos (~8KB, most of it the preset and
  background catalog) and the palette/oracle (~4KB) are esbuild-bundled TS (`js.Build`,
  `format: esm`) behind dynamic imports. Chaos presets come from `data/chaos.yaml` via
  `@params` (typed in `assets/js/params.d.ts`), validated in `chaos-params.html`.
- **CSS**: one file per component under `assets/css/components/`, bundled by `css.Build`
  (Hugo ≥ 0.158, esbuild) from the `@import` index in `main.css`. Import order is the
  cascade: preferences, responsive and print stay last.
- **Grounding**: `/llms.txt` (index) and `/llms-full.txt` (full corpus) are Hugo output
  formats of the home page — regenerated every build from the same content the humans see.
- **Accessibility**: reduced-motion disables all animation including the glitch;
  reduced-transparency solidifies the glass; keyboard focus rings use the derived accent;
  the chaos toast and status changes are plain DOM text.

## Known trade-offs

- Dark-only by design (photo background + frosted glass); a light scheme would need its
  own surface derivation pass.
- Palette extraction needs macOS (`sips`) — CI can't generate palettes, it can only
  refuse to build without them. Grayscale photos fall back to the default teal hue.
- The oracle depends on one external deployable (the Cloudflare Worker); if it's down the
  palette degrades to search-only with an error line rather than breaking.

## Verification performed

Hugo build clean (no warnings, ~110ms). Screenshots: home, projects, cv, mobile (375px).
Chaos: engage → victim row down + toast + title prefix + state change; rollback restores;
state survives reload via sessionStorage. Oracle: ⌘K ask-mode opens, streams from the Worker when deployed, shows a graceful
offline/404 line otherwise.
Theme swap: switching `background` to signal-dusk re-derived every accent to amber.

## Later changes

- 2026-06-10 — status board generated from real GitHub activity; chaos v3; ⌘K palette + Workers AI oracle.
- 2026-09-07 — board froze because GitHub auto-disables `schedule` after 60 idle days; workflow now commits the status data back (keepalive) and polls every 6h; `repository_dispatch` receiver added.
