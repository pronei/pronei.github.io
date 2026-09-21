// oracle — free ask-an-agent proxy for pronei.github.io (Cloudflare Workers AI).
// POST /chat {messages:[{role,content}...]} -> SSE stream of {response:"tok"} frames.
// The visitor never needs a key; this worker's free-tier allocation pays.
// Deploy: npx wrangler login && npx wrangler deploy   (from workers/oracle/)

const SITE = "https://pronei.github.io";
const ALLOWED_ORIGINS = [SITE, "http://localhost:1313"];

// Pinned on purpose — re-checked 2026-09-21 against Cloudflare's Workers AI changelog:
//  * still free-tier eligible and not deprecated;
//  * the flagship models added since Jul 2026 (Kimi K2.6 / K2.7-code, GLM-5.2 / 5.3 /
//    5.3-Flash, DeepSeek V4 Flash / Pro) require Workers Paid: on a free account they
//    answer 403 with internal error 5035, so "upgrading" to one silently kills the oracle;
//  * most newer entries are reasoning models that would stream chain-of-thought into a
//    widget that wants terse answers.
// Override without a code change via the MODEL var (e.g. `wrangler dev --var MODEL:@cf/...`).
//
// Budget: 10,000 free Neurons/day. At 26,668 neurons/M input + 204,805/M output, the ~5k-token
// corpus costs ~133 neurons per question (84% of the total) — roughly 60 questions/day before
// Cloudflare starts refusing, and every turn of a chat re-sends the corpus.
const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_TURNS = 10;
const MAX_CHARS = 600;

// best-effort per-isolate burst guard (free tier also has its own daily cap)
const hits = new Map();
function burstLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 8;
}

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin) ? origin : SITE;
  return {
    "access-control-allow-origin": ok,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "vary": "origin",
  };
}

// Map a thrown env.AI.run error to something a visitor can act on. Matched on the message text
// (plus the 5035 code Cloudflare documents for paid-only models); anything else is a generic 502.
// The raw error always goes to console.error, visible in `wrangler tail`.
function classify(err) {
  const msg = String(err?.message ?? err);
  if (/neuron|allocation|daily|quota|4006/i.test(msg))
    return [429, "the oracle has spent today's free inference budget — it resets daily. email pmundra@ucsc.edu in the meantime"];
  if (/5035|paid plan|workers paid/i.test(msg))
    return [503, "the oracle's model needs a paid Cloudflare plan — site misconfiguration, not you"];
  if (/capacity|busy|overload|3040/i.test(msg))
    return [503, "Workers AI is out of capacity right now — try again in a moment"];
  if (/rate.?limit|too many/i.test(msg))
    return [429, "rate limited — try again in a minute"];
  return [502, "the model call failed — try again later"];
}

async function corpus() {
  const req = new Request(`${SITE}/llms-full.txt`, { cf: { cacheTtl: 3600, cacheEverything: true } });
  const res = await fetch(req);
  return res.ok ? await res.text() : "(corpus unavailable — say the context failed to load)";
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    const headers = cors(origin);
    if (request.method === "OPTIONS") return new Response(null, { headers });
    if (request.method !== "POST") return new Response("POST only", { status: 405, headers });

    const ip = request.headers.get("cf-connecting-ip") || "0";
    if (burstLimited(ip)) {
      return new Response(JSON.stringify({ error: "rate limited" }), { status: 429, headers });
    }

    let body;
    try { body = await request.json(); } catch { return new Response("bad json", { status: 400, headers }); }
    const incoming = Array.isArray(body?.messages) ? body.messages : [];
    const messages = incoming
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-MAX_TURNS)
      .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return new Response("no question", { status: 400, headers });
    }

    const system = `You are "the oracle", a small terminal-style assistant on Pranay Mundra's portfolio site.
Answer questions about Pranay, his projects, experience, and skills using ONLY the context document below
(it is generated from the site and authoritative). If the answer isn't there, say so and point to
pmundra@ucsc.edu. Never invent metrics, employers, or dates. Be concise: 1-5 sentences, plain text,
no markdown. Dry wit fine; marketing speak not. Decline unrelated topics briefly.

CONTEXT DOCUMENT:
${await corpus()}`;

    // An uncaught throw here becomes Cloudflare's bare 500 with no CORS headers, which the
    // browser reports as "Failed to fetch" — so catch it and answer with a CORS-safe error.
    const model = env.MODEL || DEFAULT_MODEL;
    let stream;
    try {
      stream = await env.AI.run(model, {
        messages: [{ role: "system", content: system }, ...messages],
        stream: true,
        max_tokens: 512,
      });
    } catch (err) {
      console.error("AI.run failed", model, String(err?.message ?? err));
      const [status, error] = classify(err);
      return new Response(JSON.stringify({ error }), {
        status,
        headers: { ...headers, "content-type": "application/json" },
      });
    }

    return new Response(stream, {
      headers: { ...headers, "content-type": "text/event-stream" },
    });
  },
};
