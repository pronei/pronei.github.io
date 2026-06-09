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
| Chatbot | **Build now, BYO Anthropic key** | Anthropic is the only major provider with documented browser CORS; key in sessionStorage; grounded via build-generated /llms-full.txt (context stuffing — no RAG at 13KB) |
| Backgrounds | **Generated placeholders** | Three procedural images (numpy, committed script) prove the palette pipeline; user swaps in photos whenever |

## Architecture

- **Theming**: build-time palette extraction (`images.Colors`) → swatch scoring
  (chroma × mid-luminance window) → CSS custom properties emitted inline *after* the
  stylesheet. Contrast handled at build time: accents below a luminance floor get
  brightened via `color-mix`; ink-on-accent flips dark/light on a luminance threshold.
  Per-page override via `background:` front matter, cached per image with `partialCached`.
- **Type**: Departure Mono (22KB woff2, OFL) for display/labels — the terminal-native
  voice; system sans for body; `ui-monospace` inline. No other downloads.
- **JS policy**: nothing loads until interaction. Chaos (~2KB) and the oracle (~4KB) are
  esbuild-bundled TS (`js.Build`, `format: esm`) behind dynamic imports.
- **Grounding**: `/llms.txt` (index) and `/llms-full.txt` (full corpus) are Hugo output
  formats of the home page — regenerated every build from the same content the humans see.
- **Accessibility**: reduced-motion disables all animation including the glitch;
  reduced-transparency solidifies the glass; keyboard focus rings use the derived accent;
  the chaos toast and status changes are plain DOM text.

## Known trade-offs

- Dark-only by design (photo background + frosted glass); a light scheme would need its
  own surface derivation pass.
- `images.Colors` returns few, heavily quantized swatches — backgrounds must carry real
  colored pixel mass (the generator's "wash" layers exist for this). Grayscale photos fall
  back to the default teal.
- The oracle is Anthropic-only: OpenAI and Gemini block browser CORS, so "any provider"
  would require a proxy backend, which this site refuses to have. OpenRouter could be
  added later behind the same provider seam in chat.ts.

## Verification performed

Hugo build clean (no warnings, ~110ms). Screenshots: home, projects, cv, mobile (375px).
Chaos: engage → victim row down + toast + title prefix + state change; rollback restores;
state survives reload via sessionStorage. Oracle: dialog opens, corpus fetch 13.4KB,
real browser call to api.anthropic.com returns 401 for a bad key with friendly error
(proves CORS + request shape; a valid key exercises the same streaming path).
Theme swap: switching `background` to signal-dusk re-derived every accent to amber.
