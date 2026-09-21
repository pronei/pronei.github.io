# oracle — free "ask an agent" proxy for pronei.github.io

Cloudflare Worker in front of **Workers AI** (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`).
Visitors never need a key; the free tier (~10k inferences/day) pays. The ⌘K palette on the
site POSTs `{messages:[…]}` here and streams the SSE reply into its tty pane.

```
cd workers/oracle
npx wrangler login      # once, in a browser
npx wrangler deploy     # prints the real URL — currently https://oracle.pranayrs.workers.dev
```

Then set `oracleEndpoint` in `hugo.toml` to exactly that URL and push. **The subdomain is the
account's, not a name you choose** — pointing `hugo.toml` at a subdomain you don't own is
indistinguishable from 'the model is broken': every request 404s with Cloudflare error 1042. A quick check that
the deploy is really there (my code answers 405 to GET, 400 to an empty POST; Cloudflare
answers **404 / error 1042** when nothing is deployed at that name):

```
curl -s -o /dev/null -w '%{http_code}\n' https://oracle.pranayrs.workers.dev/
```

## How it stays safe and grounded

- CORS allowlist: `https://pronei.github.io` and `http://localhost:1313` only.
- Grounding: the worker fetches the live `/llms-full.txt` (cached 1h at the edge) into the
  system prompt — it can only say what the site says; no invented metrics.
- Limits: 10 turns, 600 chars/turn, 512 output tokens, best-effort 8 req/min per IP inside
  the isolate. For a hard cap, add a Cloudflare WAF rate rule on the worker route.
- Bump `compatibility_date` in `wrangler.toml` occasionally and redeploy.

## Cloudflare policy notes (re-checked 2026-09-21)

- **Pinned model is still free and live**: `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
  (served as `llama-3.3-70b-instruct-sd`). Check with `npx wrangler ai models`.
- **Don't "upgrade" into a paywall.** Since Jul 28 2026 the flagship models (Kimi K2.6 /
  K2.7-code, GLM-5.2 / 5.3 / 5.3-Flash, DeepSeek V4 Flash / Pro) require Workers Paid; on a
  free account they return **403 / internal error 5035**. Most newer entries are also
  reasoning models that would stream chain-of-thought into the tty. To try another model
  without editing code: `npx wrangler dev --var MODEL:@cf/<vendor>/<model>`.
- **Budget:** 10,000 free Neurons/day (Free and Paid plans alike). This model costs 26,668
  neurons/M input and 204,805/M output; the ~5k-token corpus alone is ~133 neurons per
  question (84% of the cost), so expect **~60 questions/day**. Every chat turn re-sends the
  corpus. Growing `/llms-full.txt` shrinks that number proportionally.
- **When it runs out** (or any `env.AI.run` failure): the worker answers a CORS-safe JSON
  error (429 budget/rate, 503 capacity/paid-only, 502 otherwise) that the ⌘K tty shows
  verbatim. Raw cause: `npx wrangler tail`.
- Not adopted: `rejectIfBusy` (Sep 17 2026) — for synchronous calls; the oracle streams.
  AI Gateway unified billing (Aug 7 2026) — only relevant for paid frontier models.

## Why this and not something else (research, June 2026)

- duck.ai: unofficial `x-vqd-4` API is actively blocked, ToS-prohibited, and CORS-rejects
  third-party origins — dead end.
- In-browser models (WebLLM / transformers.js): 500MB–2GB first download; bad on phones.
- Puter.js / OpenRouter free pool / hobby endpoints: reliability or ToS risk for a
  professional site.
- Workers AI free tier: real CORS, key stays server-side, 99.95% SLA. Runner-up was Gemini
  Flash's free tier behind the same kind of tiny proxy.
