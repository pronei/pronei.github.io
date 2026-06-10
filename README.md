# pranay@mundra:~$

Personal portfolio. Hugo only — no npm, no node_modules, no frameworks, no analytics.
One binary in, static files out.

```
brew install hugo        # extended build, ≥ 0.146
hugo server              # dev at localhost:1313
hugo                     # production build into public/
```

## The gimmicks (all load-bearing)

**Dynamic theme from the background image.** Drop any photo into `assets/backgrounds/`,
point `params.background` in [hugo.toml](hugo.toml) at it (or override per page with
`background:` front matter), run:

```
python3 scripts/palette.py    # numpy only; uses macOS sips for decoding
hugo
```

[scripts/palette.py](scripts/palette.py) implements the Material-You-style pipeline
(2026 reference): k-means quantization in Oklab, candidate scoring at
`0.35·population + 0.65·chroma` with a low-chroma gate (grayscale photos fall back to
the house teal *hue*, never a muddy gray), tone-mapped dark-scheme roles (accent ≈ tone
80, surface ≈ tone 6), WCAG-snapped contrast (≥3:1 accent-on-surface, ≥4.5:1 as text),
and a scrim that scales with image luminance — weighted toward the top of the image,
where the hero text lives, so bright skies don't wash the headline out. Results land in
[data/palettes.yaml](data/palettes.yaml); [theme.html](layouts/_partials/theme.html)
prefers them and falls back to a hardened `images.Colors` heuristic for images you
haven't processed. Either way: zero theming JS at runtime.

**Chaos mode.** The "inject fault" breaker loads ~3KB of JS on first flip
([assets/js/chaos.ts](assets/js/chaos.ts)) and corrupts the site into a random theme
preset — colors *and* fonts (`amber-crt`, `bluescreen`, `phosphor`, `redshift`,
`paper-tape`) — while a random workload goes down on the status board with an incident
toast. Headline glitches once (skipped under `prefers-reduced-motion`); rollback restores
the image-derived theme; state is per-tab (`sessionStorage`).

**⌘K palette.** Soft command palette ([assets/js/palette.ts](assets/js/palette.ts),
loaded on demand): fuzzy keyword search over every page and project via the build-time
[/searchindex.json](layouts/home.searchindex.json) — try "rate limiter", "aerospike",
"mcp". Keyboard-first (↑↓ ↵ esc), animated with `@starting-style`. An ask-an-LLM mode is
planned to live inside it — see [docs/oracle-plan.md](docs/oracle-plan.md) for the
researched free-model architecture (Cloudflare Workers AI; duck.ai is not viable).
`/llms.txt` + `/llms-full.txt` (now with an extended-depth notes section from
[data/llm_extra.yaml](data/llm_extra.yaml)) serve visiting AI agents meanwhile.

## Editing content

| What | Where |
|---|---|
| status board rows | [data/now.yaml](data/now.yaml) |
| CV (page + corpus) | [data/cv.yaml](data/cv.yaml) — keep `static/cv/pranay-mundra-cv.pdf` in sync |
| projects | one markdown file each in [content/projects/](content/projects/) |
| about / contact | [content/about.md](content/about.md), [content/contact.md](content/contact.md) |
| tagline, links, default background | [hugo.toml](hugo.toml) |
| AI-agent depth notes (llms-full.txt) | [data/llm_extra.yaml](data/llm_extra.yaml) |

## Deploy

GitHub Pages: push to `main` on a repo with Pages → "GitHub Actions" enabled —
[.github/workflows/hugo.yml](.github/workflows/hugo.yml) does the rest. For the
`pronei.github.io` root site the configured `baseURL` is already correct; for a custom
domain, change `baseURL` and add a `static/CNAME`.

Cloudflare Pages: framework preset "Hugo", build command `hugo --minify`, output
directory `public`, env var `HUGO_VERSION=0.163.0`.

## Performance posture

Zero JS shipped until a visitor flips the breaker or opens the oracle (two ~300-byte
inline loaders gate the dynamic imports). One stylesheet (~15KB raw). One self-hosted
display font (Departure Mono, 22KB woff2, OFL — license vendored next to it). Background
images are served as webp at three widths with a jpeg fallback and preloaded with
`fetchpriority=high`; source PNGs never ship.
