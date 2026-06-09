#!/usr/bin/env python3
"""Generate the swappable background images procedurally (no image deps, just numpy).

Each image is dark-leaning so the frosted-glass UI stays readable, but carries a
distinct dominant accent so Hugo's palette extraction visibly re-themes the site:

  topology-night.png  - teal/green node graph    -> green accent
  signal-dusk.png     - amber signal traces      -> amber accent
  fog-array.png       - blue-gray sensor array   -> blue accent

Deterministic (fixed seeds). Re-run after editing: python3 scripts/gen_backgrounds.py
"""

import struct
import zlib
from pathlib import Path

import numpy as np

W, H = 2400, 1500
OUT = Path(__file__).resolve().parent.parent / "assets" / "backgrounds"


def write_png(path: Path, arr: np.ndarray) -> None:
    """Minimal RGB8 PNG writer (filter type 0 per scanline)."""
    a = np.clip(arr, 0, 255).astype(np.uint8)
    h, w, _ = a.shape
    raw = b"".join(b"\x00" + a[y].tobytes() for y in range(h))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def base_gradient(top, bottom) -> np.ndarray:
    t = np.linspace(0.0, 1.0, H)[:, None, None]
    top = np.array(top, dtype=np.float32)
    bottom = np.array(bottom, dtype=np.float32)
    return (top * (1 - t) + bottom * t) * np.ones((H, W, 3), dtype=np.float32)


def stamp_glow(img: np.ndarray, x: float, y: float, sigma: float, color, amp: float) -> None:
    r = int(sigma * 3.5)
    x0, x1 = max(0, int(x) - r), min(W, int(x) + r)
    y0, y1 = max(0, int(y) - r), min(H, int(y) + r)
    if x0 >= x1 or y0 >= y1:
        return
    ys, xs = np.mgrid[y0:y1, x0:x1]
    d2 = (xs - x) ** 2 + (ys - y) ** 2
    g = np.exp(-d2 / (2 * sigma * sigma)) * amp
    img[y0:y1, x0:x1] += g[:, :, None] * np.array(color, dtype=np.float32)


def stamp_line(img: np.ndarray, p0, p1, color, amp: float, sigma: float = 1.6) -> None:
    dist = float(np.hypot(p1[0] - p0[0], p1[1] - p0[1]))
    steps = max(2, int(dist / 3))
    for t in np.linspace(0, 1, steps):
        stamp_glow(img, p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, sigma, color, amp)


def finish(img: np.ndarray, rng: np.random.Generator, vignette: float = 0.32) -> np.ndarray:
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)
    r2 = ((xs - W / 2) / (W / 2)) ** 2 + ((ys - H / 2) / (H / 2)) ** 2
    img *= (1 - vignette * r2 / 2)[:, :, None]
    img += rng.normal(0, 2.6, size=(H, W, 1)).astype(np.float32)  # film grain
    return img


def topology_night() -> np.ndarray:
    rng = np.random.default_rng(1029)
    img = base_gradient((9, 15, 19), (12, 22, 24))
    # broad teal washes: dark, but enough colored pixel mass that Hugo's
    # dominant-color histogram yields a saturated teal swatch to theme from
    for _ in range(4):
        stamp_glow(img, rng.uniform(0, W), rng.uniform(0, H), rng.uniform(320, 460), (14, 86, 68), 0.55)
    pts = np.column_stack([rng.uniform(60, W - 60, 42), rng.uniform(60, H - 60, 42)])
    for i, p in enumerate(pts):  # connect each node to its 2 nearest peers
        d = np.hypot(*(pts - p).T)
        for j in np.argsort(d)[1:3]:
            stamp_line(img, p, pts[j], (26, 140, 110), 0.30)
    for p in pts:
        s = rng.uniform(5, 13)
        stamp_glow(img, p[0], p[1], s * 4.0, (20, 130, 100), 0.55)  # halo
        stamp_glow(img, p[0], p[1], s, (45, 212, 167), 1.15)        # core
    return finish(img, rng)


def signal_dusk() -> np.ndarray:
    rng = np.random.default_rng(2026)
    img = base_gradient((20, 12, 16), (28, 17, 14))
    xs = np.arange(0, W, 3)
    for i in range(6):
        ybase = H * (0.22 + 0.12 * i)
        amp = rng.uniform(28, 90)
        freq = rng.uniform(1.4, 3.2)
        phase = rng.uniform(0, 6.28)
        warm = (240, 158 - i * 8, 44) if i % 2 == 0 else (216, 110, 60)
        for x in xs:
            y = ybase + amp * np.sin(freq * 6.28 * x / W + phase)
            stamp_glow(img, x, y, 2.2, warm, 0.5)
        for x in rng.uniform(0, W, 14):  # sparse sample markers on each trace
            y = ybase + amp * np.sin(freq * 6.28 * x / W + phase)
            stamp_glow(img, x, y, rng.uniform(4, 8), warm, 0.8)
    return finish(img, rng)


def fog_array() -> np.ndarray:
    rng = np.random.default_rng(831)
    img = base_gradient((13, 17, 22), (17, 23, 30))
    ys_f, xs_f = np.mgrid[0:H, 0:W].astype(np.float32)
    fog = (
        np.sin(xs_f / 340 + 1.2) * np.sin(ys_f / 260 + 0.4)
        + np.sin((xs_f + ys_f) / 520)
    ) * 0.5 + 0.6
    for _ in range(5):  # blue washes so the histogram yields a blue swatch
        stamp_glow(img, rng.uniform(0, W), rng.uniform(0, H), rng.uniform(340, 500), (30, 96, 168), 0.7)
    for gy in range(40, H, 62):
        for gx in range(40, W, 62):
            x = gx + rng.uniform(-7, 7)
            y = gy + rng.uniform(-7, 7)
            yi, xi = min(H - 1, max(0, int(y))), min(W - 1, max(0, int(x)))
            b = float(np.clip(fog[yi, xi], 0.05, 1.5))
            stamp_glow(img, x, y, rng.uniform(2.4, 3.8), (122, 170, 210), 0.9 * b)
    return finish(img, rng, vignette=0.38)


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, fn in [
        ("topology-night.png", topology_night),
        ("signal-dusk.png", signal_dusk),
        ("fog-array.png", fog_array),
    ]:
        write_png(OUT / name, fn())
        print(f"wrote {OUT / name}")
