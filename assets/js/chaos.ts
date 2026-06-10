// chaos mode v3 — the breaker corrupts the site: random font set + random
// background (cross-faded) + colors that either adapt to the new background's
// precomputed palette or get hijacked by a color preset. Clicking again while
// corrupted re-rolls and ESCALATES glitch intensity (faster clicks = worse).
// The ✕ button (or the board toast) rolls everything back. Per-tab state.

type FontSet = { name: string; display: string; body: string };
type ColorSet = { name: string; light?: boolean; vars: Record<string, string> };
type Bg = {
  name: string; url: string;
  accent: string; accentText: string; accentInk: string; tint: string;
  scrimTop: string; scrimMid: string; scrimBot: string; glassMix: string;
};

const FONTS: FontSet[] = [
  { name: "crt", display: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace", body: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace" },
  { name: "courier", display: "'Courier New', Courier, monospace", body: "'Courier New', Courier, monospace" },
  { name: "typewriter", display: "'American Typewriter', 'Courier New', monospace", body: "Georgia, 'Times New Roman', serif" },
  { name: "blueprint", display: "Futura, 'Century Gothic', 'Avenir Next', sans-serif", body: "'Avenir Next', Avenir, Verdana, sans-serif" },
  { name: "manuscript", display: "Baskerville, 'Times New Roman', serif", body: "Baskerville, 'Times New Roman', serif" },
  { name: "optical", display: "Optima, Candara, 'Gill Sans', sans-serif", body: "Optima, Candara, 'Gill Sans', sans-serif" },
  { name: "teletype", display: "'Andale Mono', Consolas, monospace", body: "'Andale Mono', Consolas, monospace" },
  { name: "charter", display: "Charter, Cambria, Georgia, serif", body: "Charter, Cambria, Georgia, serif" },
];

const COLORS: ColorSet[] = [
  { name: "amber-crt", vars: { "--c-accent": "#ffb000", "--c-accent-text": "#ffc54d", "--c-accent-ink": "#1c1203", "--c-tint": "#171007", "--ink": "#f5e9cd", "--ink-mute": "#cdb285", "--ink-dim": "#8d7c54" } },
  { name: "bluescreen", vars: { "--c-accent": "#5aa2ff", "--c-accent-text": "#8abdff", "--c-accent-ink": "#04102a", "--c-tint": "#0a1430", "--ink": "#dde8ff", "--ink-mute": "#9fb4dd", "--ink-dim": "#64779f" } },
  { name: "phosphor", vars: { "--c-accent": "#33ff66", "--c-accent-text": "#66ff8c", "--c-accent-ink": "#03130a", "--c-tint": "#04130a", "--ink": "#d2ffd9", "--ink-mute": "#84cf95", "--ink-dim": "#4d8a5d" } },
  { name: "redshift", vars: { "--c-accent": "#ff5c57", "--c-accent-text": "#ff8a85", "--c-accent-ink": "#1c0605", "--c-tint": "#190b0d", "--ink": "#ffe4e1", "--ink-mute": "#d3a09b", "--ink-dim": "#8f655f" } },
  { name: "vaporwave", vars: { "--c-accent": "#ff71ce", "--c-accent-text": "#ff9ddd", "--c-accent-ink": "#1c0517", "--c-tint": "#150f22", "--ink": "#f4e9ff", "--ink-mute": "#bda6d8", "--ink-dim": "#7d6c96" } },
  { name: "norad", vars: { "--c-accent": "#ff3b30", "--c-accent-text": "#ff6f66", "--c-accent-ink": "#190302", "--c-tint": "#0d0d0d", "--ink": "#f2f2f2", "--ink-mute": "#b3b3b3", "--ink-dim": "#6f6f6f" } },
  { name: "paper-tape", light: true, vars: { "--c-accent": "#b3261e", "--c-accent-text": "#8f1d16", "--c-accent-ink": "#fff6ec", "--c-tint": "#e9e4d8", "--ink": "#221d14", "--ink-mute": "#5d5749", "--ink-dim": "#8b8474" } },
];

const COLOR_VARS = ["--c-accent", "--c-accent-text", "--c-accent-ink", "--c-tint", "--ink", "--ink-mute", "--ink-dim"];
const SCRIM_VARS = ["--scrim-top", "--scrim-mid", "--scrim-bot", "--glass-mix"];
const FONT_VARS = ["--font-display", "--font-body"];
const STORE = "chaos3";

let bgs: Bg[] | null = null;
let victim: HTMLElement | null = null;
let savedNote = "";
let savedStatus = "";
let lastClick = 0;
let level = 0;

const root = () => document.documentElement;
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function bgData(): Bg[] {
  if (!bgs) {
    const el = document.getElementById("bg-data");
    bgs = el ? (JSON.parse(el.textContent || "[]") as Bg[]) : [];
  }
  return bgs;
}

function currentBgName(): string {
  return (document.querySelector(".bg") as HTMLElement | null)?.dataset.bg ?? "";
}

function crossfadeBg(bg: Bg): void {
  const wrap = document.querySelector(".bg") as HTMLElement | null;
  if (!wrap) return;
  const old = wrap.querySelector("picture, img.bgfade") as HTMLElement | null;
  const img = document.createElement("img");
  img.className = "bgfade";
  img.src = bg.url;
  img.alt = "";
  img.decoding = "async";
  img.style.opacity = "0";
  wrap.insertBefore(img, wrap.querySelector(".scrim"));
  const reveal = () => {
    requestAnimationFrame(() => {
      img.style.opacity = "1";
      setTimeout(() => { if (old && old !== img) old.remove(); }, 900);
    });
  };
  if (img.complete) reveal(); else img.onload = reveal;
  wrap.dataset.bg = bg.name;
}

function applyPaletteOf(bg: Bg, withColors: boolean): void {
  const map: Record<string, string> = {
    "--scrim-top": bg.scrimTop, "--scrim-mid": bg.scrimMid,
    "--scrim-bot": bg.scrimBot, "--glass-mix": bg.glassMix,
  };
  if (withColors) {
    Object.assign(map, {
      "--c-accent": bg.accent, "--c-accent-text": bg.accentText,
      "--c-accent-ink": bg.accentInk, "--c-tint": bg.tint,
    });
  }
  for (const [k, v] of Object.entries(map)) root().style.setProperty(k, v);
}

function setBreakerLabel(text: string): void {
  const b = document.getElementById("chaos-breaker") as HTMLElement | null;
  if (!b) return;
  const label = b.querySelector("[data-label]") as HTMLElement | null;
  if (!label || label.textContent === text) return;
  // FLIP the width change so the rest of the nav is pushed smoothly
  const w0 = b.offsetWidth;
  label.textContent = text;
  const w1 = b.offsetWidth;
  if (Math.abs(w1 - w0) < 2) return;
  b.style.width = w0 + "px";
  void b.offsetWidth;
  b.style.transition = "width 0.32s cubic-bezier(0.2, 0.7, 0.3, 1)";
  b.style.width = w1 + "px";
  setTimeout(() => { b.style.width = ""; b.style.transition = ""; }, 360);
}

function glitch(intensity: number): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cls = intensity >= 3 ? "glitching-3" : intensity === 2 ? "glitching-2" : "glitching";
  document.querySelectorAll(".glitchable, .brand").forEach((el) => {
    el.classList.remove("glitching", "glitching-2", "glitching-3");
    void (el as HTMLElement).offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), intensity >= 2 ? 2200 : 1400);
  });
}

function takeDownVictim(desc: string): void {
  restoreVictim();
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.rows .row[data-status="operational"]'));
  if (rows.length) {
    victim = pick(rows);
    savedNote = victim.querySelector(".note")?.textContent ?? "";
    savedStatus = victim.dataset.status ?? "operational";
    victim.dataset.status = "down";
    const note = victim.querySelector(".note");
    const status = victim.querySelector(".status");
    if (note) note.textContent = "visitor-induced latency";
    if (status) status.textContent = "down";
  }
  const name = victim?.querySelector(".name")?.textContent?.trim();
  const toastText = document.getElementById("chaos-toast-text");
  const toast = document.getElementById("chaos-toast");
  if (toast && toastText) {
    toastText.textContent = `fault injected — ${desc}${name ? `, ${name} down` : ""}`;
    toast.hidden = false;
  }
  const state = document.getElementById("board-state");
  if (state && victim) { state.textContent = "partial outage"; state.className = "state down"; }
}

function restoreVictim(): void {
  if (victim) {
    victim.dataset.status = savedStatus;
    const note = victim.querySelector(".note");
    const status = victim.querySelector(".status");
    if (note) note.textContent = savedNote;
    if (status) status.textContent = savedStatus;
    victim = null;
  }
  const toast = document.getElementById("chaos-toast");
  if (toast) toast.hidden = true;
  const state = document.getElementById("board-state");
  if (state) {
    const down = document.querySelectorAll('.rows .row[data-status="down"]:not(.toast)').length;
    const degraded = document.querySelectorAll('.row[data-status="degraded"]').length;
    state.textContent = down ? "partial outage" : degraded ? "degraded performance" : "all systems operational";
    state.className = "state " + (down ? "down" : degraded ? "degraded" : "ok");
  }
}

type State = { font: string; color: string | null; bg: string; level: number };

function corrupt(announce: boolean, saved?: State): void {
  const data = bgData();
  const font = saved ? FONTS.find((f) => f.name === saved.font) ?? pick(FONTS) : pick(FONTS);
  const others = data.filter((b) => b.name !== currentBgName());
  const bg = saved
    ? data.find((b) => b.name === saved.bg) ?? (others.length ? pick(others) : null)
    : others.length ? pick(others) : null;
  const useOverride = saved ? saved.color !== null : Math.random() < 0.35;
  const color = saved
    ? COLORS.find((c) => c.name === saved.color) ?? null
    : useOverride ? pick(COLORS) : null;

  root().style.setProperty("--font-display", font.display);
  root().style.setProperty("--font-body", font.body);
  if (bg) {
    crossfadeBg(bg);
    applyPaletteOf(bg, !color);
  }
  if (color) {
    for (const [k, v] of Object.entries(color.vars)) root().style.setProperty(k, v);
  }
  root().classList.add("chaos-on");
  root().classList.toggle("chaos-light", !!color?.light);
  root().classList.toggle("chaos-flicker", level >= 3);

  const desc = `${font.name} / ${color ? color.name : `adaptive(${bg?.name ?? "current"})`}`;
  sessionStorage.setItem(STORE, JSON.stringify({ font: font.name, color: color?.name ?? null, bg: bg?.name ?? currentBgName(), level } satisfies State));
  const b = document.getElementById("chaos-breaker");
  if (b) b.setAttribute("aria-pressed", "true");
  setBreakerLabel(level > 1 ? `escalate ×${level}` : "escalate");
  takeDownVictim(desc);
  if (announce) glitch(level);
  if (!document.title.startsWith("[degraded] ")) document.title = "[degraded] " + document.title;
}

function rollback(): void {
  for (const k of [...COLOR_VARS, ...SCRIM_VARS, ...FONT_VARS]) root().style.removeProperty(k);
  root().classList.remove("chaos-on", "chaos-light", "chaos-flicker");
  sessionStorage.removeItem(STORE);
  level = 0;
  const b = document.getElementById("chaos-breaker");
  if (b) b.setAttribute("aria-pressed", "false");
  setBreakerLabel("inject fault");
  restoreVictim();
  document.title = document.title.replace(/^\[degraded\] /, "");
  // restore the build-time background if we swapped it
  const wrap = document.querySelector(".bg") as HTMLElement | null;
  const fade = wrap?.querySelector("img.bgfade");
  if (wrap && fade) location.reload(); // simplest correct restore of <picture> + palette
}

export function toggle(): void {
  const now = Date.now();
  level = now - lastClick < 2500 ? Math.min(3, level + 1) : 1;
  lastClick = now;
  corrupt(true);
}

export function off(): void {
  rollback();
}

export function restore(): void {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) || "null") as State | null;
    if (!saved) return;
    level = saved.level || 1;
    corrupt(false, saved);
  } catch { /* corrupted state: stay clean */ }
}

document.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (!t) return;
  if (t.id === "chaos-rollback" || t.closest?.("#chaos-rollback")) rollback();
  if (t.id === "chaos-off" || t.closest?.("#chaos-off")) rollback();
});
