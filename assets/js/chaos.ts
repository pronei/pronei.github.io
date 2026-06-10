// chaos mode — the breaker in the nav. Flipping it injects a fault into the
// site itself: the theme gets "corrupted" into a random preset (colors + fonts),
// one workload on the status board goes down, and a rollback undoes everything.
// Loaded on demand only; state is per-tab (sessionStorage); presentation-only.

type Preset = {
  name: string;
  vars: Record<string, string>;
};

const PRESETS: Preset[] = [
  {
    name: "amber-crt",
    vars: {
      "--c-accent": "#ffb000", "--c-accent-text": "#ffc54d", "--c-accent-ink": "#1c1203",
      "--c-tint": "#171007", "--ink": "#f5e9cd", "--ink-mute": "#cdb285", "--ink-dim": "#8d7c54",
      "--font-display": "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
      "--font-body": "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
    },
  },
  {
    name: "bluescreen",
    vars: {
      "--c-accent": "#5aa2ff", "--c-accent-text": "#8abdff", "--c-accent-ink": "#04102a",
      "--c-tint": "#0a1430", "--ink": "#dde8ff", "--ink-mute": "#9fb4dd", "--ink-dim": "#64779f",
      "--font-display": "'Courier New', Courier, monospace",
      "--font-body": "'Courier New', Courier, monospace",
    },
  },
  {
    name: "phosphor",
    vars: {
      "--c-accent": "#33ff66", "--c-accent-text": "#66ff8c", "--c-accent-ink": "#03130a",
      "--c-tint": "#04130a", "--ink": "#d2ffd9", "--ink-mute": "#84cf95", "--ink-dim": "#4d8a5d",
      "--font-display": "\"Departure Mono\", ui-monospace, monospace",
      "--font-body": "ui-monospace, 'SF Mono', Menlo, monospace",
    },
  },
  {
    name: "redshift",
    vars: {
      "--c-accent": "#ff5c57", "--c-accent-text": "#ff8a85", "--c-accent-ink": "#1c0605",
      "--c-tint": "#190b0d", "--ink": "#ffe4e1", "--ink-mute": "#d3a09b", "--ink-dim": "#8f655f",
      "--font-display": "\"Departure Mono\", ui-monospace, monospace",
      "--font-body": "Georgia, 'Times New Roman', serif",
    },
  },
  {
    name: "paper-tape",
    vars: {
      "--c-accent": "#b3261e", "--c-accent-text": "#8f1d16", "--c-accent-ink": "#fff6ec",
      "--c-tint": "#e9e4d8", "--ink": "#221d14", "--ink-mute": "#5d5749", "--ink-dim": "#8b8474",
      "--font-display": "'American Typewriter', 'Courier New', monospace",
      "--font-body": "Georgia, 'Times New Roman', serif",
    },
  },
];

const ALL_VARS = Object.keys(PRESETS[0].vars);
const STORE = "chaos-preset";

let victim: HTMLElement | null = null;
let savedNote = "";
let savedStatus = "";

function root(): HTMLElement {
  return document.documentElement;
}

function setBreaker(on: boolean, name?: string): void {
  const b = document.getElementById("chaos-breaker");
  if (!b) return;
  b.setAttribute("aria-pressed", String(on));
  const label = b.querySelector("[data-label]");
  if (label) label.textContent = on ? `rollback ${name ?? ""}`.trim() : "inject fault";
}

function glitchOnce(): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.querySelectorAll(".glitchable").forEach((el) => {
    el.classList.add("glitching");
    setTimeout(() => el.classList.remove("glitching"), 1400);
  });
}

function takeDownVictim(presetName: string): void {
  const rows = Array.from(
    document.querySelectorAll<HTMLElement>('.rows .row[data-status="operational"]'),
  );
  if (!rows.length) return;
  victim = rows[Math.floor(Math.random() * rows.length)];
  savedNote = victim.querySelector(".note")?.textContent ?? "";
  savedStatus = victim.dataset.status ?? "operational";
  victim.dataset.status = "down";
  const note = victim.querySelector(".note");
  const status = victim.querySelector(".status");
  if (note) note.textContent = "visitor-induced latency";
  if (status) status.textContent = "down";

  const name = victim.querySelector(".name")?.textContent?.trim() ?? "a workload";
  const toastText = document.getElementById("chaos-toast-text");
  const toast = document.getElementById("chaos-toast");
  if (toast && toastText) {
    toastText.textContent = `fault injected — theme corrupted to "${presetName}", ${name} down`;
    toast.hidden = false;
  }
  const state = document.getElementById("board-state");
  if (state) { state.textContent = "partial outage"; state.className = "state down"; }
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
    const degraded = document.querySelectorAll('.rows .row[data-status="degraded"]').length;
    state.textContent = down ? "partial outage" : degraded ? "degraded performance" : "all systems operational";
    state.className = "state " + (down ? "down" : degraded ? "degraded" : "ok");
  }
}

function apply(preset: Preset, announce: boolean): void {
  for (const [k, v] of Object.entries(preset.vars)) root().style.setProperty(k, v);
  root().classList.add("chaos-on");
  root().classList.toggle("chaos-light", preset.name === "paper-tape");
  sessionStorage.setItem(STORE, preset.name);
  setBreaker(true, preset.name);
  takeDownVictim(preset.name);
  if (announce) glitchOnce();
  if (!document.title.startsWith("[degraded] ")) document.title = "[degraded] " + document.title;
}

function rollback(): void {
  for (const k of ALL_VARS) root().style.removeProperty(k);
  root().classList.remove("chaos-on", "chaos-light");
  sessionStorage.removeItem(STORE);
  setBreaker(false);
  restoreVictim();
  document.title = document.title.replace(/^\[degraded\] /, "");
}

export function toggle(): void {
  if (root().classList.contains("chaos-on")) {
    rollback();
  } else {
    const last = sessionStorage.getItem(STORE);
    const pool = PRESETS.filter((p) => p.name !== last);
    apply(pool[Math.floor(Math.random() * pool.length)], true);
  }
}

// reapply persisted corruption on page load / navigation (no glitch replay)
export function restore(): void {
  const name = sessionStorage.getItem(STORE);
  const preset = PRESETS.find((p) => p.name === name) ?? PRESETS[0];
  apply(preset, false);
}

document.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (t && t.id === "chaos-rollback") rollback();
});
