#!/usr/bin/env python3
"""Studio-grade palette extraction for the background images (numpy only).

Implements the Material-You-style pipeline (2026 reference: material-color-utilities):
downsample -> perceptual space (Oklab here) -> k-means quantize -> score candidates by
population (0.35) + chroma (0.65) with a minimum-chroma gate -> re-tone the winner to
fixed dark-scheme lightness roles (accent ~ tone 80, surface ~ tone 6) -> snap tones
until WCAG contrast passes (3:1 accent-on-surface, 4.5:1 accent-as-text) -> scale the
scrim with mean image luminance for bright photos.

Writes data/palettes.yaml, which layouts/_partials/theme.html prefers over its
built-in images.Colors heuristic. Run after adding/changing a background:

    python3 scripts/palette.py

Image decoding uses macOS `sips` to BMP (no PIL dependency).
"""

import math
import struct
import subprocess
import tempfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
BG_DIR = ROOT / "assets" / "backgrounds"
OUT = ROOT / "data" / "palettes.yaml"

FALLBACK_HUE = math.atan2(-0.02, -0.10)  # teal-ish direction in oklab (a,b)
MIN_CHROMA = 0.035                       # ~Material "chroma < 8" reject gate


# ---------- image loading (sips -> BMP -> numpy) ----------

def load_image(path: Path, width: int = 256) -> np.ndarray:
    """Return HxWx3 float sRGB in [0,1]."""
    with tempfile.TemporaryDirectory() as td:
        bmp = Path(td) / "img.bmp"
        subprocess.run(
            ["sips", "-s", "format", "bmp", "--resampleWidth", str(width),
             str(path), "--out", str(bmp)],
            check=True, capture_output=True,
        )
        raw = bmp.read_bytes()
    off = struct.unpack_from("<I", raw, 10)[0]
    w = struct.unpack_from("<i", raw, 18)[0]
    h = struct.unpack_from("<i", raw, 22)[0]
    bpp = struct.unpack_from("<H", raw, 28)[0]
    assert bpp in (24, 32), f"unexpected bpp {bpp}"
    flip = h > 0
    h = abs(h)
    step = bpp // 8
    rowbytes = (w * step + 3) & ~3
    img = np.frombuffer(raw, dtype=np.uint8, count=rowbytes * h, offset=off)
    img = img.reshape(h, rowbytes)[:, : w * step].reshape(h, w, step)
    if flip:
        img = img[::-1]
    return img[:, :, [2, 1, 0]].astype(np.float32) / 255.0  # BGR -> RGB


# ---------- color spaces ----------

def srgb_to_linear(c: np.ndarray) -> np.ndarray:
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c: np.ndarray) -> np.ndarray:
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


M1 = np.array([
    [0.4122214708, 0.5363325363, 0.0514459929],
    [0.2119034982, 0.6806995451, 0.1073969566],
    [0.0883024619, 0.2817188376, 0.6299787005],
])
M2 = np.array([
    [0.2104542553, 0.7936177850, -0.0040720468],
    [1.9779984951, -2.4285922050, 0.4505937099],
    [0.0259040371, 0.7827717662, -0.8086757660],
])


def rgb_to_oklab(rgb: np.ndarray) -> np.ndarray:
    lin = srgb_to_linear(rgb)
    lms = lin @ M1.T
    lms_ = np.cbrt(lms)
    return lms_ @ M2.T


def oklab_to_rgb(lab: np.ndarray) -> np.ndarray:
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    lms = np.stack([l_ ** 3, m_ ** 3, s_ ** 3], axis=-1)
    Minv = np.array([
        [4.0767416621, -3.3077115913, 0.2309699292],
        [-1.2684380046, 2.6097574011, -0.3413193965],
        [-0.0041960863, -0.7034186147, 1.7076147010],
    ])
    return linear_to_srgb(lms @ Minv.T)


def in_gamut(lab: np.ndarray) -> bool:
    L, a, b = lab
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    lms = np.array([l_ ** 3, m_ ** 3, s_ ** 3])
    Minv = np.array([
        [4.0767416621, -3.3077115913, 0.2309699292],
        [-1.2684380046, 2.6097574011, -0.3413193965],
        [-0.0041960863, -0.7034186147, 1.7076147010],
    ])
    lin = lms @ Minv.T
    return bool(np.all(lin >= -1e-4) and np.all(lin <= 1.0 + 1e-4))


def oklch(L: float, C: float, hue: float) -> np.ndarray:
    """Build an oklab triple from L, chroma, hue (radians); clamp chroma into gamut."""
    c = C
    for _ in range(24):
        lab = np.array([L, c * math.cos(hue), c * math.sin(hue)])
        if in_gamut(lab):
            return lab
        c *= 0.92
    return np.array([L, 0.0, 0.0])


def to_hex(lab: np.ndarray) -> str:
    rgb = np.clip(oklab_to_rgb(lab), 0, 1)
    r, g, b = (int(round(float(v) * 255)) for v in rgb)
    return f"#{r:02x}{g:02x}{b:02x}"


def wcag_luminance(lab: np.ndarray) -> float:
    rgb = np.clip(oklab_to_rgb(lab), 0, 1)
    lin = srgb_to_linear(rgb)
    return float(0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2])


def contrast(a: np.ndarray, b: np.ndarray) -> float:
    la, lb = wcag_luminance(a), wcag_luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# ---------- quantize + score (Material-style) ----------

def kmeans(lab: np.ndarray, k: int = 8, iters: int = 16, seed: int = 7):
    rng = np.random.default_rng(seed)
    centers = lab[rng.choice(len(lab), size=k, replace=False)]
    for _ in range(iters):
        d = ((lab[:, None, :] - centers[None, :, :]) ** 2).sum(-1)
        assign = d.argmin(1)
        for i in range(k):
            pts = lab[assign == i]
            if len(pts):
                centers[i] = pts.mean(0)
    counts = np.bincount(assign, minlength=k)
    return centers, counts / counts.sum()


def extract(path: Path) -> dict:
    img = load_image(path)
    rgb = img.reshape(-1, 3)
    # sample for speed; deterministic
    idx = np.random.default_rng(13).choice(len(rgb), size=min(40000, len(rgb)), replace=False)
    lab = rgb_to_oklab(rgb[idx])
    mean_l = float(lab[:, 0].mean())
    # the hero text sits over the top of the image — bright tops need a stronger scrim
    top = img[: max(1, int(img.shape[0] * 0.45))].reshape(-1, 3)
    top_l = float(rgb_to_oklab(top[:: max(1, len(top) // 20000)])[:, 0].mean())
    eff_l = max(mean_l, top_l)

    centers, pops = kmeans(lab)
    chromas = np.hypot(centers[:, 1], centers[:, 2])

    # score = 0.35*population + 0.65*chroma (normalized), gate on minimum chroma
    chroma_n = np.clip(chromas / 0.16, 0, 1)
    scores = 0.35 * pops + 0.65 * chroma_n
    scores[chromas < MIN_CHROMA] = -1

    if scores.max() < 0:
        hue = FALLBACK_HUE
        base_c = 0.11
        note = "low-chroma image - fallback teal hue"
    else:
        w = centers[int(scores.argmax())]
        hue = math.atan2(w[2], w[1])
        base_c = float(np.clip(np.hypot(w[1], w[2]) * 1.15, 0.07, 0.14))
        note = "extracted"

    # dark-scheme roles, Material tone mapping: surface ~ tone 6, accent ~ tone 80
    tint = oklch(0.17, min(0.035, base_c * 0.35), hue)
    accent = oklch(0.76, base_c, hue)
    while contrast(accent, tint) < 3.0 and accent[0] < 0.95:
        accent = oklch(float(accent[0]) + 0.02, base_c, hue)
    accent_text = accent.copy()
    while contrast(accent_text, tint) < 4.5 and accent_text[0] < 0.97:
        accent_text = oklch(float(accent_text[0]) + 0.02, base_c * 0.9, hue)
    accent_ink = oklch(0.13, min(0.03, base_c * 0.3), hue)

    # scrim strength scales with image luminance (bright photos need protection);
    # the top stop follows the brightest of (whole image, top region) since that's
    # where the hero text lives
    over = max(0.0, eff_l - 0.38)
    over_all = max(0.0, mean_l - 0.38)
    scrim_top = min(80, round(100 * (0.36 + over * 1.2)))
    scrim_mid = min(60, round(100 * (0.10 + over * 1.1)))
    scrim_bot = min(88, round(100 * (0.62 + over_all * 0.5)))
    glass_mix = min(94, round(100 * (0.78 + over * 0.45)))

    return {
        "note": f"{note}; mean oklab L {mean_l:.2f}, top {top_l:.2f}",
        "accent": to_hex(accent),
        "accentText": to_hex(accent_text),
        "accentInk": to_hex(accent_ink),
        "tint": to_hex(tint),
        "scrimTop": f"{scrim_top}%",
        "scrimMid": f"{scrim_mid}%",
        "scrimBot": f"{scrim_bot}%",
        "glassMix": f"{glass_mix}%",
    }


if __name__ == "__main__":
    images = sorted(
        p for p in BG_DIR.iterdir()
        if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp")
    )
    lines = [
        "# Generated by scripts/palette.py — do not hand-edit.",
        "# theme.html prefers these over the images.Colors heuristic.",
    ]
    for img in images:
        p = extract(img)
        print(f"{img.name}: accent {p['accent']} on {p['tint']}  ({p['note']})")
        lines.append(f'"{img.name}":')
        for key in ("accent", "accentText", "accentInk", "tint",
                    "scrimTop", "scrimMid", "scrimBot", "glassMix"):
            lines.append(f'  {key}: "{p[key]}"')
    OUT.write_text("\n".join(lines) + "\n")
    print(f"wrote {OUT}")
