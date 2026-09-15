#!/usr/bin/env python3
"""
============================================================
 ROIReaper — генератор фирменного баннера репозитория
 (используется как social preview и шапка README)

 Зависимости: pip install pillow fonttools brotli
 Запуск:      python scripts/make-banner.py
 Результат:   docs/banner.png (1280×640)
============================================================
"""
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont, ImageFilter
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.merge import Merger

ROOT = os.path.join(os.path.dirname(__file__), "..")
FONTS_SRC = os.path.join(ROOT, "src", "renderer", "assets", "fonts")
OUT = os.path.join(ROOT, "docs", "banner.png")
S = 2  # супердискретизация для гладких краёв

BG_TOP = (13, 13, 16)
BG_BOTTOM = (8, 8, 10)
AMBER = (245, 181, 60)
AMBER2 = (255, 138, 61)
TEXT = (244, 244, 246)
TEXT2 = (199, 199, 208)
MUTED = (140, 140, 150)


def build_font(weight):
    """Собирает TTF нужной жирности из latin- и cyrillic-подмножеств Unbounded."""
    parts = []
    for nm in ("Unbounded-Variable", "Unbounded-Cyrillic"):
        f = TTFont(os.path.join(FONTS_SRC, nm + ".woff2"))
        instantiateVariableFont(f, {"wght": weight}, inplace=True)
        p = os.path.join(sys.path[0] if False else "/tmp", f"rr-{nm}-{weight}.ttf")
        f.save(p)
        parts.append(p)
    out = f"/tmp/rr-Unbounded-{weight}.ttf"
    Merger().merge(parts).save(out)
    return out


def hex_points(cx, cy, r):
    return [(cx + r * math.cos(math.radians(60 * i - 30)),
             cy + r * math.sin(math.radians(60 * i - 30))) for i in range(6)]


def draw_tracked(draw, xy, text, font, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + tracking


def remove_white_bg(img):
    """Превращает белый фон вокруг скруглённой плитки иконки в прозрачный."""
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            lum = max(r, g, b)
            if lum >= 246:
                na = 0
            elif lum <= 218:
                na = 255
            else:
                na = int(255 * (246 - lum) / (246 - 218))
            px[x, y] = (r, g, b, min(a, na))
    # сгладим край маски
    alpha = img.getchannel("A").filter(ImageFilter.GaussianBlur(0.6 * S))
    img.putalpha(alpha)
    return img


def wrap(draw, text, font, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def make():
    W, H = 1280 * S, 640 * S
    img = Image.new("RGB", (W, H), BG_BOTTOM)

    # вертикальный градиент фона
    grad = Image.new("RGB", (1, H))
    for y in range(H):
        t = y / H
        grad.putpixel((0, y), tuple(int(BG_TOP[i] + (BG_BOTTOM[i] - BG_TOP[i]) * t) for i in range(3)))
    img.paste(grad.resize((W, H)), (0, 0))

    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(ov)

    # центр композиции с иконкой
    cx, cy = int(W * 0.80), int(H * 0.47)

    # мягкое янтарное свечение за иконкой
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    R = int(H * 0.58)
    for r in range(R, 0, -6):
        a = int(34 * (1 - r / R) ** 2)
        gd.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(*AMBER, a))
    glow = glow.filter(ImageFilter.GaussianBlur(40 * S))
    ov = Image.alpha_composite(ov, glow)
    d = ImageDraw.Draw(ov)

    # медовые соты за иконкой
    R0 = 44 * S
    row_h = R0 * math.sqrt(3)
    for row in range(-2, 10):
        for col in range(-3, 8):
            hx = cx + col * 1.5 * R0 + (row % 2) * 0.75 * R0 - 3 * R0
            hy = cy - 4 * row_h + row * row_h
            dist = math.hypot(hx - cx, hy - cy)
            if dist > 560 * S:
                continue
            a = max(4, int(38 - dist / (560 * S) * 36))
            color = (*AMBER, a) if (row + col) % 5 == 0 else (255, 255, 255, a)
            d.polygon(hex_points(hx, hy, R0), outline=color)

    # шрифты
    f_eye = ImageFont.truetype(build_font(500), 19 * S)
    f_title = ImageFont.truetype(build_font(800), 94 * S)
    f_sub = ImageFont.truetype(build_font(600), 42 * S)
    f_tag = ImageFont.truetype(build_font(400), 23 * S)
    f_chip = ImageFont.truetype(build_font(500), 18 * S)
    f_url = ImageFont.truetype(build_font(400), 17 * S)

    X = 76 * S

    # надбровник
    eye = "ОФИЦИАЛЬНАЯ СБОРКА ДЛЯ WINDOWS"
    draw_tracked(d, (X + 4 * S, 74 * S), eye, f_eye, (*AMBER, 255), 4 * S)
    d.line((X, 120 * S, X + 36 * S, 120 * S), fill=(*AMBER, 220), width=3 * S)

    # заголовок
    d.text((X - 4 * S, 140 * S), "ROIReaper", font=f_title, fill=TEXT)
    tw = d.textlength("ROIReaper", font=f_title)
    # янтарная черта-подчёркивание
    d.rounded_rectangle((X, 246 * S, X + tw + 10 * S, 256 * S), radius=5 * S, fill=(*AMBER, 255))

    # подзаголовок и описание (с авто-переносом)
    d.text((X, 280 * S), "«Жнец Роя»", font=f_sub, fill=(*AMBER, 255))
    ty = 352 * S
    for line in wrap(d, "12 мини-игр: кликер, кейсы, казино, стратегия, аркада, карты и шашки. "
                        "Магазин, своя валюта, тёмная и светлая темы.", f_tag, 690 * S):
        d.text((X + 4 * S, ty), line, font=f_tag, fill=TEXT2)
        ty += 38 * S

    # иконка (без белого фона)
    ISZ = 250 * S
    icon = remove_white_bg(
        Image.open(os.path.join(ROOT, "resources", "icon.png")).resize((ISZ, ISZ), Image.LANCZOS))
    ix, iy = cx - ISZ // 2, cy - ISZ // 2
    d.ellipse((ix - 30 * S, iy - 30 * S, ix + ISZ + 30 * S, iy + ISZ + 30 * S),
              outline=(*AMBER, 80), width=2 * S)
    d.ellipse((ix - 12 * S, iy - 12 * S, ix + ISZ + 12 * S, iy + ISZ + 12 * S),
              outline=(255, 255, 255, 20), width=1 * S)
    ov.alpha_composite(icon, (ix, iy))
    d = ImageDraw.Draw(ov)

    # плашки (переносятся на новую строку, если не влезают)
    chips = ["Windows 10 / 11", "Работает офлайн", "Portable + установщик", "Лицензия MIT"]
    cx0 = X + 4 * S
    cy0 = 478 * S
    limit = int(W * 0.60)
    for ch in chips:
        w = d.textlength(ch, font=f_chip) + 34 * S
        if cx0 + w > limit and cx0 > X:
            cx0 = X + 4 * S
            cy0 += 54 * S
        d.rounded_rectangle((cx0, cy0, cx0 + w, cy0 + 42 * S), radius=21 * S,
                            outline=(255, 255, 255, 38), width=1 * S)
        d.text((cx0 + 17 * S, cy0 + 11 * S), ch, font=f_chip, fill=TEXT2)
        cx0 += w + 14 * S

    # url внизу
    d.text((X + 4 * S, 600 * S), "github.com/kayorissss/ROIReaper", font=f_url, fill=MUTED)

    # тонкая рамка
    d.rectangle((1, 1, W - 2, H - 2), outline=(255, 255, 255, 14), width=1)

    img = Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")
    img = img.resize((1280, 640), Image.LANCZOS)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT, optimize=True)
    print("✓ Баннер:", OUT)


if __name__ == "__main__":
    make()
