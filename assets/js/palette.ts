// cmd+k palette — soft search over /searchindex.json plus "ask an agent":
// a tty-style chat pane that streams from the Cloudflare Worker proxy
// (workers/oracle — free Workers AI behind CORS). Loaded on demand only.

type Item = {
  title: string; url: string; kind: string; summary: string;
  stack: string; greek: string; metrics: string; body: string;
};
type Msg = { role: "user" | "assistant"; content: string };

let index: Item[] | null = null;
let sel = 0;
let shown: Item[] = [];
let wired = false;
let mode: "search" | "ask" = "search";
let history: Msg[] = [];
let busy = false;

const $ = (id: string) => document.getElementById(id)!;
const dlg = () => document.getElementById("palette") as HTMLDialogElement;

async function loadIndex(): Promise<Item[]> {
  if (index) return index;
  const res = await fetch("/searchindex.json");
  index = (await res.json()) as Item[];
  return index;
}

function score(item: Item, tokens: string[]): number {
  let total = 0;
  for (const t of tokens) {
    let s = 0;
    const title = item.title.toLowerCase();
    if (title.includes(t)) s += title.startsWith(t) ? 80 : 60;
    if (item.greek.toLowerCase().includes(t)) s += 35;
    if (item.stack.toLowerCase().includes(t)) s += 35;
    if (item.summary.toLowerCase().includes(t)) s += 25;
    if (item.metrics.toLowerCase().includes(t)) s += 20;
    if (item.body.includes(t)) s += 10;
    if (s === 0) return 0;
    total += s;
  }
  return total;
}

function render(items: Item[]): void {
  shown = items;
  sel = 0;
  const ul = $("pal-results");
  ul.innerHTML = "";
  $("pal-empty").hidden = items.length > 0;
  items.forEach((item, i) => {
    const li = document.createElement("li");
    li.className = "pal-item" + (i === 0 ? " sel" : "");
    li.setAttribute("role", "option");
    li.innerHTML = `<span class="pal-kind">${item.kind}</span><span class="pal-title"></span><span class="pal-sub"></span>`;
    (li.children[1] as HTMLElement).textContent = item.title;
    (li.children[2] as HTMLElement).textContent =
      item.summary.length > 92 ? item.summary.slice(0, 92) + "…" : item.summary;
    li.addEventListener("mouseenter", () => select(i));
    li.addEventListener("click", () => go(item));
    ul.appendChild(li);
  });
}

function select(i: number): void {
  sel = Math.max(0, Math.min(shown.length - 1, i));
  document.querySelectorAll(".pal-item").forEach((el, j) => el.classList.toggle("sel", j === sel));
  document.querySelector(".pal-item.sel")?.scrollIntoView({ block: "nearest" });
}

function go(item: Item): void {
  dlg().close();
  window.location.href = item.url;
}

async function update(): Promise<void> {
  const items = await loadIndex();
  const q = ($("pal-q") as HTMLInputElement).value.trim().toLowerCase();
  if (!q) { render(items.slice(0, 8)); return; }
  const tokens = q.split(/\s+/).filter(Boolean);
  render(
    items.map((it) => ({ it, s: score(it, tokens) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map((r) => r.it),
  );
}

/* ── ask mode ─────────────────────────────────────────────────────────── */

function setMode(m: "search" | "ask"): void {
  mode = m;
  const ask = m === "ask";
  $("pal-results").hidden = ask;
  $("pal-empty").hidden = true;
  $("pal-ask").hidden = ask;
  $("pal-send").hidden = !ask;
  $("pal-hint-search").hidden = ask;
  $("pal-hint-ask").hidden = !ask;
  $("pal-chat").classList.toggle("open", ask);
  const q = $("pal-q") as HTMLInputElement;
  q.placeholder = ask ? "ask anything about pranay…" : "search projects, pages, keywords…";
  q.value = "";
  document.querySelector(".pal-prompt")!.textContent = ask ? "$" : "›";
  if (!ask) void update();
  q.focus();
}

function ttyLine(cls: string, text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "tty-line " + cls;
  el.textContent = text;
  $("pal-tty").appendChild(el);
  el.scrollIntoView({ block: "nearest" });
  return el;
}

async function ask(question: string): Promise<void> {
  const endpoint = dlg().dataset.endpoint;
  ttyLine("q", "$ " + question);
  if (!endpoint) {
    ttyLine("err", "oracle offline — no endpoint configured. deploy workers/oracle and set params.oracleEndpoint in hugo.toml.");
    return;
  }
  busy = true;
  ($("pal-send") as HTMLButtonElement).disabled = true;
  history.push({ role: "user", content: question });
  if (history.length > 10) history = history.slice(-10);
  const out = ttyLine("a streaming", "");
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    if (!res.ok || !res.body) {
      out.remove();
      history.pop();
      ttyLine("err", res.status === 429
        ? "rate limited — the free tier needs a breather, try again in a minute"
        : `oracle error ${res.status} — try again later`);
      return;
    }
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
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const ev = JSON.parse(payload);
            const tok = ev.response ?? ev.delta?.text ?? "";
            if (tok) { answer += tok; out.textContent = answer; out.scrollIntoView({ block: "nearest" }); }
          } catch { /* keepalive */ }
        }
      }
    }
    out.classList.remove("streaming");
    history.push({ role: "assistant", content: answer || "(no response)" });
  } catch (err) {
    out.remove();
    history.pop();
    ttyLine("err", "request failed: " + (err instanceof Error ? err.message : String(err)));
  } finally {
    busy = false;
    ($("pal-send") as HTMLButtonElement).disabled = false;
    ($("pal-q") as HTMLInputElement).focus();
  }
}

function submitAsk(): void {
  const q = $("pal-q") as HTMLInputElement;
  const question = q.value.trim();
  if (!question || busy) return;
  q.value = "";
  void ask(question);
}

/* ── wiring ───────────────────────────────────────────────────────────── */

function wire(): void {
  if (wired) return;
  wired = true;
  const input = $("pal-q") as HTMLInputElement;
  input.addEventListener("input", () => { if (mode === "search") void update(); });
  input.addEventListener("keydown", (e) => {
    if (mode === "search") {
      if (e.key === "ArrowDown") { e.preventDefault(); select(sel + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); select(sel - 1); }
      else if (e.key === "Enter" && shown[sel]) { e.preventDefault(); go(shown[sel]); }
    } else if (e.key === "Enter") {
      e.preventDefault();
      submitAsk();
    }
  });
  $("pal-ask").addEventListener("click", () => setMode("ask"));
  $("pal-send").addEventListener("click", submitAsk);
  // esc in ask mode returns to search instead of closing
  dlg().addEventListener("cancel", (e) => {
    if (mode === "ask") { e.preventDefault(); setMode("search"); }
  });
  dlg().addEventListener("click", (e) => { if (e.target === dlg()) dlg().close(); });
}

export function open(): void {
  wire();
  const d = dlg();
  if (d.open) { d.close(); return; }
  d.showModal();
  if (mode !== "search") setMode("search");
  const input = $("pal-q") as HTMLInputElement;
  input.value = "";
  void update();
  input.focus();
}
