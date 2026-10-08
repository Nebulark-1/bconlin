"""Share images: the picture a link to the site shows in LinkedIn, Slack,
iMessage and the like (Open Graph, 1200 x 630). One per page, in the site's
own look: the dark background, the chapter-colored rings around my
portrait, the site's fonts.

    python tools/og.py

Needs Pillow. Fetches the fonts (all open-licensed, from Google Fonts' repo)
into tools/.fonts the first time. Writes public/og/<page>.png.
"""

import math
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
FONTS = Path(__file__).resolve().parent / ".fonts"
OUT = ROOT / "public" / "og"
W, H = 1200, 630

BG = (4, 4, 12)
TEXT = (236, 232, 255)
MUTED = (141, 136, 173)
ACCENT = (255, 180, 140)
GREEN = (57, 255, 136)
# each chapter's color, as on the home page's rings
RINGS = [(169, 155, 255), (255, 138, 122), (57, 255, 136), (255, 77, 166)]

FONT_URLS = {
    "SpaceGrotesk.ttf": "https://github.com/google/fonts/raw/main/ofl/spacegrotesk/SpaceGrotesk%5Bwght%5D.ttf",
    "Inter.ttf": "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf",
    "JetBrainsMono.ttf": "https://github.com/google/fonts/raw/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf",
}

PAGES = {
    "home": {
        "kicker": "OPEN TO WORK  ·  FORT COLLINS, COLORADO",
        "title": "Hi, I'm Ben.",
        "text": "I turn messy real-world processes into software that people rely on.",
        "dot": True,
    },
    "career": {
        "kicker": "CAREER",
        "title": "An interactive timeline",
        "text": "Michigan Tech, a law firm, a surgical department, and an AI coaching startup, one chapter at a time.",
    },
    "resume": {
        "kicker": "RÉSUMÉ",
        "title": "Tailored to your role",
        "text": "My résumé, re-ranked for the job you're hiring for. Every line is mine; the page picks and orders them.",
    },
    "projects": {
        "kicker": "PROJECTS",
        "title": "Things I've built",
        "text": "What I build outside of work, with live demos: flocking on the GPU, a voxel world in WebAssembly, and an AI coach.",
    },
    "eggs": {
        "kicker": "SECRETS",
        "title": "Secrets",
        "text": "Hidden things to find around the site, and the code behind each one.",
    },
}


def font(name, size, axes=None):
    path = FONTS / name
    if not path.exists():
        FONTS.mkdir(exist_ok=True)
        print(f"fetching {name}")
        urllib.request.urlretrieve(FONT_URLS[name], path)
    f = ImageFont.truetype(str(path), size)
    if axes:
        f.set_variation_by_axes(axes)
    return f


def wrap(draw, text, f, width):
    lines, line = [], ""
    for word in text.split():
        trial = f"{line} {word}".strip()
        if draw.textlength(trial, font=f) <= width:
            line = trial
        else:
            lines.append(line)
            line = word
    return lines + [line]


def glow(img):
    """The soft violet light in the top right, as on the home page."""
    layer = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(layer)
    d.ellipse((560, -380, 1460, 380), fill=(34, 28, 84))
    return Image.blend(img, layer.filter(ImageFilter.GaussianBlur(140)), 0.9)


def portrait(img, cx, cy, r):
    """The headshot in a circle, in black and white like the site's."""
    photo = Image.open(ROOT / "public" / "photos" / "headshot-studio.png").convert("L")
    photo = ImageOps.fit(photo, (2 * r, 2 * r), centering=(0.5, 0.4))
    photo = ImageOps.autocontrast(photo, cutoff=1).convert("RGB")
    mask = Image.new("L", (2 * r * 4, 2 * r * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, 2 * r * 4, 2 * r * 4), fill=255)
    mask = mask.resize((2 * r, 2 * r), Image.LANCZOS)
    img.paste(photo, (cx - r, cy - r), mask)


def rings(img, cx, cy, r):
    """Four arcs in the chapter colors, with gaps, round the portrait (drawn big, then shrunk, for smooth edges)."""
    s = 3
    layer = Image.new("RGBA", (W * s, H * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    spans = [(200, 300), (320, 40), (60, 150), (165, 190)]
    for k, (color, (a0, a1)) in enumerate(zip(RINGS, spans)):
        rr = (r + 18 + k * 14) * s
        d.arc((cx * s - rr, cy * s - rr, cx * s + rr, cy * s + rr), a0, a1, fill=color + (255,), width=4 * s)
    # a faint dotted ring outside them all
    rr = (r + 82) * s
    for k in range(120):
        a = k / 120 * 2 * math.pi
        x, y = cx * s + rr * math.cos(a), cy * s + rr * math.sin(a)
        d.ellipse((x - 2 * s, y - 2 * s, x + 2 * s, y + 2 * s), fill=(141, 136, 173, 90))
    layer = layer.resize((W, H), Image.LANCZOS)
    img.paste(layer, (0, 0), layer)


def make(name, page):
    img = glow(Image.new("RGB", (W, H), BG))
    cx, cy, r = 930, 315, 150
    rings(img, cx, cy, r)
    portrait(img, cx, cy, r)
    d = ImageDraw.Draw(img)
    x = 72
    kicker = font("JetBrainsMono.ttf", 20, [500])
    title = font("SpaceGrotesk.ttf", 76 if len(page["title"]) < 16 else 64, [700])
    body = font("Inter.ttf", 30, [28, 450])
    small = font("JetBrainsMono.ttf", 22, [500])
    y = 150
    if page.get("dot"):
        d.ellipse((x, y + 6, x + 12, y + 18), fill=GREEN)
        d.text((x + 24, y), page["kicker"], font=kicker, fill=MUTED)
    else:
        d.text((x, y), page["kicker"], font=kicker, fill=ACCENT)
    y += 50
    for line in wrap(d, page["title"], title, 640):
        d.text((x, y), line, font=title, fill=TEXT)
        y += title.size + 8
    y += 18
    for line in wrap(d, page["text"], body, 620):
        d.text((x, y), line, font=body, fill=(200, 196, 224))
        y += 42
    d.text((x, H - 80), "bconlin.com", font=small, fill=ACCENT)
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / f"{name}.png", optimize=True)
    print(f"wrote public/og/{name}.png")


if __name__ == "__main__":
    for name, page in PAGES.items():
        make(name, page)
