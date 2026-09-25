#!/usr/bin/env python3
"""Refresh data/now.json from real repo activity (stdlib only).

Reads data/ci.toml (tomllib), asks the GitHub API for each workload's repo — last push
time, head commit subject, latest completed Actions conclusion — and writes data/now.json
for the homepage status board. Hugo reads both formats natively, so there is no
hand-rolled parser anywhere.

Only ABSOLUTE facts are stored (RFC3339 push time, CI verdict, commit subject). Relative
labels like "3d ago" are rendered by Hugo at build time (layouts/_partials/rel-time.html),
so this file changes only when a repo actually changes. That matters: the deploy workflow
commits it back, and those commits are the repository activity that stops GitHub from
auto-disabling the scheduled workflow after 60 idle days.

If a probe fails (rate limit, API blip) the previous row is kept and flagged
`"stale": true` — the board never regresses to blanks. Writes are atomic.

    GITHUB_TOKEN=$(gh auth token) python3 scripts/update_now.py
"""

import json
import os
import tomllib
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CI = ROOT / "data" / "ci.toml"
OUT = ROOT / "data" / "now.json"
API = "https://api.github.com"
SUBJECT_MAX = 46


def gh(path: str):
    req = urllib.request.Request(API + path, headers={
        "accept": "application/vnd.github+json",
        "user-agent": "pronei-portfolio-status",
        **({"authorization": f"Bearer {os.environ['GITHUB_TOKEN']}"} if os.environ.get("GITHUB_TOKEN") else {}),
    })
    with urllib.request.urlopen(req, timeout=15) as res:
        return json.load(res)


def probe(repo: str) -> dict:
    info = gh(f"/repos/{repo}")
    subject = ""
    try:
        subject = gh(f"/repos/{repo}/commits?per_page=1")[0]["commit"]["message"].split("\n")[0]
    except Exception:
        pass
    ci = None
    try:
        runs = gh(f"/repos/{repo}/actions/runs?per_page=1&status=completed")
        if runs.get("workflow_runs"):
            ci = runs["workflow_runs"][0]["conclusion"]
    except Exception:
        pass
    if len(subject) > SUBJECT_MAX:
        subject = subject[: SUBJECT_MAX - 1] + "…"
    return {
        "subject": subject,
        "pushed_at": info["pushed_at"],
        "ci": ci,
        "status": "degraded" if ci in ("failure", "timed_out") else "operational",
    }


def main() -> None:
    with CI.open("rb") as f:
        wanted = tomllib.load(f).get("workloads", [])
    try:
        previous = {r["name"]: r for r in json.loads(OUT.read_text())["workloads"]}
    except (FileNotFoundError, ValueError, KeyError):
        previous = {}

    rows = []
    for w in wanted:
        row = {k: w[k] for k in ("name", "gloss", "link", "repo") if k in w}
        row["status"] = w.get("status", "operational")
        if w.get("repo"):
            try:
                row.update(probe(w["repo"]))
            except Exception as e:
                prev = previous.get(row["name"], {})
                row.update({k: prev[k] for k in ("subject", "pushed_at", "ci", "status") if prev.get(k) is not None})
                row["stale"] = True
                print(f"! {row['name']}: probe failed ({type(e).__name__}) — kept previous row")
        rows.append({k: v for k, v in row.items() if v not in (None, "")})  # templates guard with `with`
        print(f"{row['name']:14} {row['status']:12} {row.get('subject') or '-'}  {row.get('pushed_at') or ''}  ci={row.get('ci')}")

    tmp = OUT.with_name(OUT.name + ".tmp")
    tmp.write_text(json.dumps({"workloads": rows}, indent=2, ensure_ascii=False) + "\n")
    tmp.replace(OUT)  # atomic: an interrupted run never leaves a truncated board
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
