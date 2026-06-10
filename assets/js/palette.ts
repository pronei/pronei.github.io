// cmd+k palette — soft search over /searchindex.json (built by Hugo from site
// content). Loaded on demand only. Designed so an ask-an-LLM pane can slot in
// later (see docs/oracle-plan.md): same dialog, the input grows a chat mode.

type Item = {
  title: string;
  url: string;
  kind: string;
  summary: string;
  stack: string;
  greek: string;
  metrics: string;
  body: string;
};

let index: Item[] | null = null;
let sel = 0;
let shown: Item[] = [];
let wired = false;

const $ = (id: string) => document.getElementById(id)!;

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
    if (s === 0) return 0; // every token must match somewhere
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
    li.innerHTML =
      `<span class="pal-kind">${item.kind}</span>` +
      `<span class="pal-title"></span><span class="pal-sub"></span>`;
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
  document.querySelectorAll(".pal-item").forEach((el, j) => {
    el.classList.toggle("sel", j === sel);
  });
  document.querySelector(".pal-item.sel")?.scrollIntoView({ block: "nearest" });
}

function go(item: Item): void {
  (document.getElementById("palette") as HTMLDialogElement).close();
  window.location.href = item.url;
}

async function update(): Promise<void> {
  const items = await loadIndex();
  const q = ($("pal-q") as HTMLInputElement).value.trim().toLowerCase();
  if (!q) {
    render(items.slice(0, 8));
    return;
  }
  const tokens = q.split(/\s+/).filter(Boolean);
  const ranked = items
    .map((it) => ({ it, s: score(it, tokens) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map((r) => r.it);
  render(ranked);
}

function wire(): void {
  if (wired) return;
  wired = true;
  const input = $("pal-q") as HTMLInputElement;
  input.addEventListener("input", () => void update());
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); select(sel + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); select(sel - 1); }
    else if (e.key === "Enter" && shown[sel]) { e.preventDefault(); go(shown[sel]); }
  });
  // close on backdrop click
  const dlg = document.getElementById("palette") as HTMLDialogElement;
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close();
  });
}

export function open(): void {
  wire();
  const dlg = document.getElementById("palette") as HTMLDialogElement;
  if (dlg.open) { dlg.close(); return; } // ⌘K toggles
  dlg.showModal();
  const input = $("pal-q") as HTMLInputElement;
  input.value = "";
  void update();
  input.focus();
}
