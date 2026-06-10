// oracle — free ask-an-agent proxy for pronei.github.io (Cloudflare Workers AI).
// POST /chat {messages:[{role,content}...]} -> SSE stream of {response:"tok"} frames.
// The visitor never needs a key; this worker's free-tier allocation pays.
// Deploy: npx wrangler login && npx wrangler deploy   (from workers/oracle/)

const SITE = "https://pronei.github.io";
const ALLOWED_ORIGINS = [SITE, "http://localhost:1313"];
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
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

    const stream = await env.AI.run(MODEL, {
      messages: [{ role: "system", content: system }, ...messages],
      stream: true,
      max_tokens: 512,
    });

    return new Response(stream, {
      headers: { ...headers, "content-type": "text/event-stream" },
    });
  },
};
