# oracle — free "ask an agent" proxy for pronei.github.io

Cloudflare Worker in front of **Workers AI** (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`).
Visitors never need a key; the free tier (~10k inferences/day) pays. The ⌘K palette on the
site POSTs `{messages:[…]}` here and streams the SSE reply into its tty pane.

```
cd workers/oracle
npx wrangler login      # once, in a browser
npx wrangler deploy     # prints https://oracle.<your-subdomain>.workers.dev
```

Then set `oracleEndpoint` in `hugo.toml` to exactly that URL and push. A quick check that
the deploy is really there (my code answers 405 to GET, 400 to an empty POST; Cloudflare
answers **404 / error 1042** when nothing is deployed at that name):

```
curl -s -o /dev/null -w '%{http_code}\n' https://oracle.<your-subdomain>.workers.dev/
```

## How it stays safe and grounded

- CORS allowlist: `https://pronei.github.io` and `http://localhost:1313` only.
- Grounding: the worker fetches the live `/llms-full.txt` (cached 1h at the edge) into the
  system prompt — it can only say what the site says; no invented metrics.
- Limits: 10 turns, 600 chars/turn, 512 output tokens, best-effort 8 req/min per IP inside
  the isolate. For a hard cap, add a Cloudflare WAF rate rule on the worker route.
- Bump `compatibility_date` in `wrangler.toml` occasionally and redeploy.

## Why this and not something else (research, June 2026)

- duck.ai: unofficial `x-vqd-4` API is actively blocked, ToS-prohibited, and CORS-rejects
  third-party origins — dead end.
- In-browser models (WebLLM / transformers.js): 500MB–2GB first download; bad on phones.
- Puter.js / OpenRouter free pool / hobby endpoints: reliability or ToS risk for a
  professional site.
- Workers AI free tier: real CORS, key stays server-side, 99.95% SLA. Runner-up was Gemini
  Flash's free tier behind the same kind of tiny proxy.
