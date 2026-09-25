# pranay mundra

Personal portfolio. Hugo only — no npm, no node_modules, no frameworks, no analytics.
One binary in, static files out.

```
brew install hugo        # extended build; CI pins 0.166.0
hugo server              # dev at localhost:1313
hugo                     # production build into public/
```

CI gates every deploy on: a TypeScript 7 type-check (`tsc -p .` — Hugo's esbuild strips
types without checking them), a worker syntax check, and a `--panicOnWarning` build, which
also fails if any background lacks a palette entry. A separate non-gating Lighthouse job
([lighthouserc.json](lighthouserc.json)) holds pushes to mobile budgets — performance ≥ 90,
accessibility 100, LCP ≤ 3s, ≤ 600KB — and uploads reports as a workflow artifact.

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
[data/palettes.yaml](data/palettes.yaml), which [theme.html](layouts/_partials/theme.html)
turns into CSS custom properties — zero theming JS at runtime. It's the only palette
engine: a background without an entry (or a stale entry, or a typo in
`params.background`) fails the build, locally and in CI.

**Chaos mode.** The "inject fault" breaker ([assets/js/chaos.ts](assets/js/chaos.ts),
loaded on demand) corrupts the site: a random font set × either a color hijack or
*adaptive* colors taken from a randomly swapped background image (cross-faded, its
precomputed palette applied — theming stays coherent with whatever picture is up).
Clicking faster escalates glitch intensity ×2/×3 (clip-path slicing, hue bursts, ambient
flicker at ×3); a workload goes down on the board; ✕ or the toast rolls everything back.
Reduced-motion visitors get the state changes without the seizure bait.
The presets (8 font sets, 7 color hijacks) live in [data/chaos.yaml](data/chaos.yaml) and
reach the TypeScript at build time through `js.Build`'s `@params`, together with the
background catalog, so the page HTML carries none of it. A preset missing a field fails
the build.

**⌘K palette + the oracle.** One soft dialog ([assets/js/palette.ts](assets/js/palette.ts)):
fuzzy keyword search over the build-time [/searchindex.json](layouts/home.searchindex.json)
("rate limiter" → nogo), plus **ask an agent** — a tty-style chat that streams from a free
Cloudflare Workers AI proxy ([workers/oracle](workers/oracle)), grounded in
`/llms-full.txt` (which includes the depth notes from
[data/llm_extra.yaml](data/llm_extra.yaml)). Deploy the worker once:

```
cd workers/oracle
npm ci                     # wrangler is pinned in package-lock.json
npx wrangler login         # once; tokens expire — re-run if deploy/dev says "could not be authenticated"
npm run deploy             # prints https://oracle.pranayrs.workers.dev
```

then set `oracleEndpoint = "https://oracle.pranayrs.workers.dev"` in
[hugo.toml](hugo.toml) and rebuild. Until then the chat shows a polite offline notice.
Deploy notes, limits, and the research behind the choice (why duck.ai is a dead end): [workers/oracle/README.md](workers/oracle/README.md).

**Live status board.** The homepage workloads are real:
[scripts/update_now.py](scripts/update_now.py) reads [data/ci.toml](data/ci.toml), asks
the GitHub API for each repo's head commit, push time, and Actions conclusion, and writes
[data/now.json](data/now.json) — absolute facts only; "3d ago" is rendered by Hugo at
build time ([rel-time.html](layouts/_partials/rel-time.html)). CI failure → `degraded`;
a failed probe keeps the previous row flagged *(last known)* instead of blanking it.

How it stays fresh — there are no push hooks by default, it's polling:

| trigger | when |
|---|---|
| `schedule` | every 6h — re-polls the API, redeploys |
| `repository_dispatch` | instantly, if a project repo installs [docs/notify-portfolio.yml](docs/notify-portfolio.yml) (needs one fine-grained PAT) |
| `push` / `workflow_dispatch` | you |

The gotcha that froze the board in Aug 2026: **GitHub auto-disables `schedule` triggers
after 60 days with no commits to the repo.** The workflow now commits `data/now.json` back
whenever it changes (real activity) and adds an empty keepalive commit after 45 idle days,
so the schedule can't lapse. Those bot commits are expected — `git pull` before you edit.
If it ever shows `disabled_inactivity` again: `gh workflow enable deploy`.

**Share cards.** Every page gets its own 1200×630 `og:image`, rendered at build time by
[og-card.html](layouts/_partials/og-card.html) from pure Hugo image filters — the page's
background blurred and darkened, the portrait masked to a circle, name + `~/path` + summary
in Departure Mono. The home page also carries JSON-LD `Person` data
([schema.html](layouts/_partials/schema.html)) derived from `cv.yaml`.

**Portrait slots (replaceable).** Drop `assets/img/portrait.jpg` (circular, blends into
the hero with soft shadows) and/or `assets/img/portrait-full.jpg` (contact page) — both
optional, both picked up automatically at build.

## Editing content

| What | Where |
|---|---|
| status board rows | [data/ci.toml](data/ci.toml) — `data/now.json` is generated, don't edit it |
| CV (page + corpus) | [data/cv.yaml](data/cv.yaml) — keep `static/cv/pranay-mundra-cv.pdf` in sync |
| projects | one markdown file each in [content/projects/](content/projects/) |
| about / contact | [content/about.md](content/about.md), [content/contact.md](content/contact.md) |
| tagline, links, default background | [hugo.toml](hugo.toml) |
| AI-agent depth notes (llms-full.txt) | [data/llm_extra.yaml](data/llm_extra.yaml) |
| agent profile — the bullets in /llms.txt | [data/profile.yaml](data/profile.yaml) |
| chaos-mode fonts and color hijacks | [data/chaos.yaml](data/chaos.yaml) |
| styles | one file per component in [assets/css/components/](assets/css/components/); [assets/css/main.css](assets/css/main.css) is the ordered `@import` index |

## Deploy

GitHub Pages: push to `main` on a repo with Pages → "GitHub Actions" enabled —
[.github/workflows/hugo.yml](.github/workflows/hugo.yml) does the rest. For the
`pronei.github.io` root site the configured `baseURL` is already correct; for a custom
domain, change `baseURL` and add a `static/CNAME`.

Cloudflare Pages: framework preset "Hugo", build command `hugo --minify`, output
directory `public`, env var `HUGO_VERSION=0.166.0`.

## Performance posture

Mobile Lighthouse: 100 performance / 100 accessibility on every main page, LCP 1.2–1.9s,
~320–410KB per page. Zero JS until a visitor flips the breaker or opens the palette (tiny
inline loaders gate the dynamic imports). One stylesheet (17 component files bundled and
minified by Hugo's built-in `css.Build`, no npm), one self-hosted display font
(Departure Mono, 22KB woff2, OFL). The background is webp at 1280/1920w, q60, and is
deliberately **not** preloaded and fetched at `fetchpriority=low`: Chrome excludes
full-viewport images from LCP, so a high-priority background only starves the CSS and font
the headline needs — that mistake cost a 7.8s mobile LCP until Sept 2026.
