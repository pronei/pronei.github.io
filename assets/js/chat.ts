// the oracle — a minimal BYO-key chat widget. No SDK, no framework: this site has
// no node_modules, so the Anthropic Messages API is called with plain fetch using
// the documented browser-CORS header. Loaded only when the dialog is opened.
//
// Trust model (also stated in the UI): the visitor's key lives in sessionStorage
// for this tab only and is sent solely to api.anthropic.com. Grounding comes from
// /llms-full.txt, generated from site content at build time.

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TURNS = 12; // history cap (user+assistant messages)
const RATE_LIMIT = 6; // requests per minute, enforced client-side
const MAX_TOKENS = 700;

type Msg = { role: "user" | "assistant"; content: string };

let corpus: string | null = null;
let history: Msg[] = [];
let sent: number[] = []; // timestamps of recent requests
let busy = false;

const $ = (id: string) => document.getElementById(id)!;

function systemPrompt(): string {
  return `You are "the oracle", a small assistant embedded in Pranay Mundra's portfolio site. \
Visitors ask you about Pranay, his projects, experience, and skills.

Rules:
- Answer ONLY from the context document below. It is generated from the site itself and is authoritative.
- If the answer isn't in the context, say so plainly and suggest emailing pmundra@ucsc.edu. Never invent metrics, dates, or employers.
- Be concise: 1-5 sentences, plain text, no markdown headings. Dry wit is fine; marketing speak is not.
- For anything unrelated to Pranay, briefly decline and redirect.

CONTEXT DOCUMENT:
${corpus}`;
}

async function loadCorpus(): Promise<void> {
  if (corpus !== null) return;
  const res = await fetch("/llms-full.txt");
  corpus = res.ok ? await res.text() : "(corpus unavailable — answer that the context failed to load)";
}

function addMsg(cls: string, text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "msg " + cls;
  el.textContent = text;
  $("oracle-log").appendChild(el);
  el.scrollIntoView({ block: "end", behavior: "smooth" });
  return el;
}

function rateLimited(): boolean {
  const now = Date.now();
  sent = sent.filter((t) => now - t < 60_000);
  return sent.length >= RATE_LIMIT;
}

function friendlyError(status: number, detail: string): string {
  if (status === 401) return "key rejected (401) — check it and try again";
  if (status === 400 && /credit|billing/i.test(detail)) return "anthropic says: " + detail;
  if (status === 429) return "rate limited by anthropic (429) — wait a moment";
  if (status === 529) return "anthropic is overloaded (529) — try again shortly";
  return `api error ${status}: ${detail.slice(0, 140)}`;
}

async function ask(question: string): Promise<void> {
  const keyInput = $("oracle-key") as HTMLInputElement;
  const key = keyInput.value.trim();
  if (!key) {
    addMsg("error", "no API key — paste an Anthropic key above (it stays in this tab)");
    keyInput.focus();
    return;
  }
  if (rateLimited()) {
    addMsg("error", `client-side limit: ${RATE_LIMIT} requests/minute — breathe`);
    return;
  }
  sessionStorage.setItem("oracle-key", key);
  const model = ($("oracle-model") as HTMLSelectElement).value;
  sessionStorage.setItem("oracle-model", model);

  busy = true;
  ($("oracle-send") as HTMLButtonElement).disabled = true;
  addMsg("user", question);
  history.push({ role: "user", content: question });
  if (history.length > MAX_TURNS) history = history.slice(-MAX_TURNS);
  const out = addMsg("assistant thinking", "");

  try {
    await loadCorpus();
    sent.push(Date.now());
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        stream: true,
        system: systemPrompt(),
        messages: history,
      }),
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      let msg = detail;
      try { msg = JSON.parse(detail).error.message; } catch { /* raw */ }
      out.remove();
      history.pop();
      addMsg("error", friendlyError(res.status, msg));
      return;
    }

    // SSE parse: accumulate text_delta events as they stream
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let answer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const frames = buf.split("\n\n");
      buf = frames.pop() ?? "";
      for (const frame of frames) {
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          let ev: any;
          try { ev = JSON.parse(line.slice(6)); } catch { continue; }
          if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
            answer += ev.delta.text;
            out.textContent = answer;
          } else if (ev.type === "error") {
            throw new Error(ev.error?.message ?? "stream error");
          }
        }
      }
    }
    out.classList.remove("thinking");
    history.push({ role: "assistant", content: answer || "(empty response)" });
  } catch (err) {
    out.remove();
    history.pop();
    addMsg("error", "request failed: " + (err instanceof Error ? err.message : String(err)));
  } finally {
    busy = false;
    ($("oracle-send") as HTMLButtonElement).disabled = false;
  }
}

let wired = false;
function wire(): void {
  if (wired) return;
  wired = true;

  const keyInput = $("oracle-key") as HTMLInputElement;
  keyInput.value = sessionStorage.getItem("oracle-key") ?? "";
  const modelSel = $("oracle-model") as HTMLSelectElement;
  const savedModel = sessionStorage.getItem("oracle-model");
  if (savedModel) modelSel.value = savedModel;

  $("oracle-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("oracle-q") as HTMLInputElement;
    const question = q.value.trim();
    if (!question || busy) return;
    q.value = "";
    void ask(question);
  });
  $("oracle-close").addEventListener("click", () => {
    (document.getElementById("oracle") as HTMLDialogElement).close();
  });
}

export function open(): void {
  wire();
  const dlg = document.getElementById("oracle") as HTMLDialogElement;
  if (!dlg.open) dlg.showModal();
  void loadCorpus();
  ($("oracle-q") as HTMLInputElement).focus();
}
