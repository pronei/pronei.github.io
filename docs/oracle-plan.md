# Oracle v2 plan — free, keyless ask-an-LLM inside the ⌘K palette

Status: planned (the BYO-key oracle was removed 2026-06-09; the ⌘K palette ships with a
reserved slot for this).

## Research verdict (June 2026)

- **duck.ai is not viable.** The unofficial `x-vqd-4` token API is actively blocked
  (429/403 within minutes), DuckDuckGo's ToS prohibits automation, and even if it worked,
  browser CORS rejects third-party origins. Dead end — do not revisit.
- **In-browser models (WebLLM / transformers.js)**: no server and no key, but 500MB–2GB
  first download and weak mobile support kill the UX for casual recruiters. Skip.
- **Puter.js / OpenRouter-free / hackclub-style endpoints**: reliability or ToS risk too
  high for a professional portfolio.
- **Winner: Cloudflare Workers AI free tier** — ~10k inferences/day free, real CORS
  support, 99.95% SLA, and the key never leaves the worker. Runner-up: Gemini Flash free
  tier behind the same kind of tiny proxy (better model, an extra dependency).

## Architecture

```
visitor → ⌘K palette (ask mode) → POST https://oracle.<domain>.workers.dev/chat
                                        │  (per-IP rate limit, ~20 req/day/IP)
                                        ▼
                               Workers AI (llama-3.3-70b-fast or current best free)
                               system prompt = persona + /llms-full.txt (fetched+cached
                               by the worker from the live site, 1h TTL)
```

~50-line worker. The site itself stays backend-free; the worker is a separate deployable
(`wrangler deploy`), and if it's down or over quota the palette degrades gracefully to
search-only with a "the oracle is resting" notice.

## UX (merged into the ⌘K palette, mui.com-style)

- One input. Typing filters pages/projects (already shipped).
- Ask mode triggers when the query ends with `?`, or via a small `ask` toggle/tab —
  the results list crossfades into a compact chat log (scrollable, same dialog, no
  layout jump; reuse the soft `@starting-style` animation language).
- Streamed answers (Workers AI supports SSE), 1–4 sentence responses enforced by the
  system prompt; each answer ends with the most relevant page link pulled from the
  search index — search and chat reinforce each other.
- Grounding: `/llms-full.txt`, which now includes the EXTENDED NOTES section
  (data/llm_extra.yaml) — architecture depth, MakeMyTrip numbers, theory notes,
  slug-mcp tool surface — so answers have real substance.
- Guardrails in the system prompt: answer only from corpus, redirect non-Pranay
  questions, never invent metrics; plus worker-side per-IP throttle and a daily kill
  switch at ~80% of free quota.

## Build checklist (when picked up)

1. `wrangler init oracle-worker` — POST /chat {messages[]} → Workers AI stream; CORS
   allowlist = site origin; KV counter per IP/day.
2. palette.ts: ask-mode state, message list rendering (reuse `.msg` pattern from the
   removed chat.ts in git history), SSE reader.
3. Config: worker URL in hugo.toml params; absent param = ask mode hidden entirely.
4. Test: quota exhaustion path, worker-down path, mobile keyboard.
