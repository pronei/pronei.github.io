# pranay@mundra:~$

Personal portfolio. Hugo only — no npm, no node_modules, no frameworks, no analytics.
One binary in, static files out.

```
brew install hugo        # extended build, ≥ 0.146
hugo server              # dev at localhost:1313
hugo                     # production build into public/
```

## The gimmicks (all load-bearing)

**Dynamic theme from the background image.** The palette engine
([layouts/_partials/theme.html](layouts/_partials/theme.html)) runs Hugo's native
`images.Colors` on the active background at build time, scores the swatches
(chroma-weighted, mid-luminance window), and emits `--c-accent` / `--c-accent-text` /
`--c-accent-ink` / `--c-tint` as CSS custom properties. Every accent in the UI keys off
those vars.

To re-skin the entire site:

1. Drop any image into `assets/backgrounds/`
2. Point `params.background` in [hugo.toml](hugo.toml) at it (or set `background:` in any
   page's front matter for a per-page override)
3. Rebuild. Done.

Three generated backgrounds ship: `topology-night` (teal), `signal-dusk` (amber),
`fog-array` (blue) — regenerate or restyle them with
`python3 scripts/gen_backgrounds.py` (numpy only). Real photos work too; dark-leaning
images work best with the frosted-glass surfaces. The accent picker needs the image to
contain *some* saturated region — pure grayscale images fall back to the default teal.

**Chaos mode.** The "inject fault" breaker loads ~2KB of JS on first flip
([assets/js/chaos.ts](assets/js/chaos.ts)), takes a random workload down on the status
board, glitches the headline once (skipped under `prefers-reduced-motion`), and offers a
rollback. State is per-tab (`sessionStorage`).

**The oracle.** BYO-key chat widget ([assets/js/chat.ts](assets/js/chat.ts)) — visitors
paste their own Anthropic API key, which stays in `sessionStorage` and goes only to
`api.anthropic.com` (the documented `anthropic-dangerous-direct-browser-access` CORS
header). Grounding comes from [/llms-full.txt](layouts/home.corpus.txt), generated from
site content at build time, so the bot can't drift from the published pages. Client-side
cap of 6 requests/minute. `/llms.txt` serves visiting AI agents the index version.

## Editing content

| What | Where |
|---|---|
| status board rows | [data/now.yaml](data/now.yaml) |
| CV (page + corpus) | [data/cv.yaml](data/cv.yaml) — keep `static/cv/pranay-mundra-cv.pdf` in sync |
| projects | one markdown file each in [content/projects/](content/projects/) |
| about / contact | [content/about.md](content/about.md), [content/contact.md](content/contact.md) |
| tagline, links, default background | [hugo.toml](hugo.toml) |

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
