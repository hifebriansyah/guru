#!/usr/bin/env python3
"""Draws the Guru logo (the one version: three rings, the top right cut out like a G) and writes the icons.

    python3 tools/make_icons.py

Needs Pillow (pip3 install pillow). Writes logo.png and, for the site and the app, public/icon-192.png, public/icon-512.png, public/icon-maskable-512.png,
public/apple-touch-icon.png and public/favicon.png: all transparent PNGs of the logo (the app's splash screen and the
home-screen background come from the manifest's background_color; iOS puts its own background behind apple-touch-icon.png),
and public/og-image.png (1200x630: the logo and the tagline, centred), the picture shown when the address is shared.
The same shapes and colours are in app/components/Logo.tsx: change both together.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
RINGS = [(21.24, 5.52, "#4f8fcb"), (16.05, 4.86, "#77c4cf"), (10.1, 7.1, "#cfeaf3")]  # radius, thickness, colour (viewBox 48)
BAR = (23.1, 24.33, 8.0, 3.02, "#cfeaf3")  # the same colour as the inner ring, so the bar of the G is one piece with it
CUT = [(24, 24), (48, 8.5), (48, 24.33), (24, 24.33)]  # the part of the rings that is cut away
PAGE = "#0a1b22"  # the dark page colour behind the icons
SS = 8  # supersampling, for smooth edges


def draw(size: int, padding: float = 0.0, background: str | None = None) -> Image.Image:
    px = size * SS
    unit = px * (1 - 2 * padding) / 48  # pixels per viewBox unit
    off = px * padding

    def at(x: float, y: float) -> tuple[float, float]:
        return off + x * unit, off + y * unit

    rings = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    for r, w, colour in RINGS:
        layer = Image.new("RGBA", (px, px), (0, 0, 0, 0))
        outer = r + w / 2
        (x0, y0), (x1, y1) = at(24 - outer, 24 - outer), at(24 + outer, 24 + outer)
        ImageDraw.Draw(layer).ellipse([x0, y0, x1, y1], outline=colour, width=max(1, round(w * unit)))
        rings = Image.alpha_composite(rings, layer)
    cut = Image.new("L", (px, px), 255)
    ImageDraw.Draw(cut).polygon([at(x, y) for x, y in CUT], fill=0)
    rings.putalpha(Image.composite(rings.getchannel("A"), Image.new("L", (px, px), 0), cut))
    bx, by, bw, bh, bc = BAR
    ImageDraw.Draw(rings).rectangle([*at(bx, by), *at(bx + bw, by + bh)], fill=bc)
    canvas = Image.new("RGBA", (px, px), background or (0, 0, 0, 0))
    canvas = Image.alpha_composite(canvas, rings)
    return canvas.resize((size, size), Image.LANCZOS)


FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_TEXT = "/System/Library/Fonts/Supplemental/Arial.ttf"
TAGLINE = ["Ask one question and hear", "how different religions answer it."]


def og_image() -> Image.Image:
    """1200x630, all centred: the logo, then the tagline, on the dark page colour with soft colour blobs behind."""
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), PAGE)
    blobs = Image.new("RGB", (w, h), PAGE)
    d = ImageDraw.Draw(blobs)
    d.ellipse([-200, -260, 560, 400], fill="#14586f")
    d.ellipse([720, 120, 1380, 760], fill="#1d4f7a")
    d.ellipse([260, 420, 900, 900], fill="#13404c")
    img = Image.blend(img, blobs.filter(ImageFilter.GaussianBlur(120)), 0.75)
    logo = draw(280)
    img.paste(logo, ((w - 280) // 2, 92), logo)
    d = ImageDraw.Draw(img)
    tag = ImageFont.truetype(FONT_TEXT, 48)
    for i, line in enumerate(TAGLINE):
        d.text((w // 2, 450 + i * 62), line, font=tag, fill="#e8f4f6", anchor="ms")
    return img


def main() -> None:
    (ROOT / "public").mkdir(exist_ok=True)
    og_image().save(ROOT / "public" / "og-image.png", optimize=True)
    draw(1024).save(ROOT / "logo.png", optimize=True)
    out = ROOT / "public"
    for name, size in (("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180), ("favicon.png", 48)):
        draw(size, padding=0.04).save(out / name, optimize=True)
    draw(512, padding=0.2).save(out / "icon-maskable-512.png", optimize=True)  # the logo inside the safe zone that a round or squircle mask keeps
    print("logo.png, public/icon-*.png, apple-touch-icon.png, favicon.png and og-image.png written")


if __name__ == "__main__":
    main()
