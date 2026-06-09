// chaos mode — the breaker in the nav. Loaded on demand only (dynamic import),
// so the page ships zero JS until a visitor flips it. State lives in
// sessionStorage; everything here mutates presentation only and is fully
// reversible via rollback.

const VICTIM_NOTE = "visitor-induced latency";
let victim: HTMLElement | null = null;
let savedNote = "";
let savedStatus = "";

function rng(): number {
  return Math.random();
}

function board(): HTMLElement | null {
  return document.querySelector(".board");
}

function setBreaker(on: boolean): void {
  const b = document.getElementById("chaos-breaker");
  if (!b) return;
  b.setAttribute("aria-pressed", String(on));
  const label = b.querySelector("[data-label]");
  if (label) label.textContent = on ? "rollback all" : "inject fault";
}

function glitchOnce(): void {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.querySelectorAll(".glitchable").forEach((el) => {
    el.classList.add("glitching");
    setTimeout(() => el.classList.remove("glitching"), 1400);
  });
}

function takeDownVictim(): void {
  const rows = Array.from(
    document.querySelectorAll<HTMLElement>('.row[data-status="operational"]'),
  );
  if (!rows.length) return;
  victim = rows[Math.floor(rng() * rows.length)];
  savedNote = victim.querySelector(".note")?.textContent ?? "";
  savedStatus = victim.dataset.status ?? "operational";
  victim.dataset.status = "down";
  const note = victim.querySelector(".note");
  const status = victim.querySelector(".status");
  if (note) note.textContent = VICTIM_NOTE;
  if (status) status.textContent = "down";

  const name = victim.querySelector(".name")?.textContent?.trim() ?? "a workload";
  const toast = document.getElementById("chaos-toast");
  const toastText = document.getElementById("chaos-toast-text");
  if (toast && toastText) {
    toastText.textContent = `fault injected by visitor — ${name} +250ms p99, 1 pod evicted`;
    toast.hidden = false;
  }

  const state = document.getElementById("board-state");
  if (state) {
    state.textContent = "partial outage";
    state.className = "state down";
  }
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
    // recompute from the rows that remain
    const down = document.querySelectorAll('.row[data-status="down"]:not(.toast)').length;
    const degraded = document.querySelectorAll('.row[data-status="degraded"]').length;
    state.textContent = down
      ? "partial outage"
      : degraded
        ? "degraded performance"
        : "all systems operational";
    state.className = "state " + (down ? "down" : degraded ? "degraded" : "ok");
  }
}

function enable(announce: boolean): void {
  document.documentElement.classList.add("chaos-on");
  sessionStorage.setItem("chaos", "1");
  setBreaker(true);
  if (board()) takeDownVictim();
  if (announce) glitchOnce();
  if (!document.title.startsWith("[degraded] ")) {
    document.title = "[degraded] " + document.title;
  }
}

function disable(): void {
  document.documentElement.classList.remove("chaos-on");
  sessionStorage.removeItem("chaos");
  setBreaker(false);
  restoreVictim();
  document.title = document.title.replace(/^\[degraded\] /, "");
}

export function toggle(): void {
  if (document.documentElement.classList.contains("chaos-on")) {
    disable();
  } else {
    enable(true);
  }
}

// re-applies persisted chaos on page load / navigation (no glitch replay)
export function restore(): void {
  enable(false);
}

// rollback button inside the toast row
document.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (t && t.id === "chaos-rollback") disable();
});
