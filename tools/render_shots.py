#!/usr/bin/env python3
"""Render Ember Pact's four screenshots with Pillow, from the game's own code
and layout: each scene is staged by the real rules (tools/dump_shot.mjs) and
drawn here with the same table, card faces, values, suits, colours and
positions the canvas renderer uses (game/src/render.js LAYOUT). Same seed,
same frame, every time.

Usage: python3 tools/render_shots.py
"""
import json
import math
import random
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "screenshots"
FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
BOLD = str(FONT_DIR / "DejaVuSans-Bold.ttf")
REG = str(FONT_DIR / "DejaVuSans.ttf")

W, H = 1280, 720
FELT = (30, 82, 51)
FELT_DARK = (13, 42, 24)
WOOD = (90, 58, 34)
CREAM = (247, 239, 220)
INK = (36, 26, 18)
GOLD = (255, 210, 61)

SUITS = {
    "flame": {"name": "Flame", "color": (232, 73, 29), "light": (255, 138, 61), "dark": (143, 29, 5)},
    "tide": {"name": "Tide", "color": (43, 125, 233), "light": (109, 179, 255), "dark": (13, 63, 143)},
    "stone": {"name": "Stone", "color": (138, 125, 107), "light": (194, 180, 155), "dark": (77, 66, 52)},
    "gale": {"name": "Gale", "color": (63, 174, 90), "light": (125, 219, 143), "dark": (23, 92, 43)},
}

LAYOUT = {
    "foeHand": {"x": 640, "y": 30, "w": 64, "h": 92, "gap": 52},
    "foePortrait": {"x": 110, "y": 96, "r": 46},
    "foeLife": {"x": 180, "y": 66, "w": 220, "h": 22},
    "intent": {"x": 640, "y": 172, "w": 460, "h": 40},
    "playedPlayer": {"x": 470, "y": 236, "w": 150, "h": 210},
    "playedFoe": {"x": 660, "y": 236, "w": 150, "h": 210},
    "combo": {"x": 640, "y": 472, "w": 520, "h": 36},
    "hint": {"x": 640, "y": 710},
    "hand": {"x": 640, "y": 492, "w": 150, "h": 210, "gap": 158},
    "playerLife": {"x": 48, "y": 566, "w": 220, "h": 22},
    "ember": {"x": 48, "y": 616},
    "endTurn": {"x": 1062, "y": 622, "w": 170, "h": 56},
    "title": {"x": 640, "y": 178},
    "playButton": {"x": 640, "y": 386, "w": 260, "h": 72},
    "bigButton": {"x": 640, "y": 470, "w": 280, "h": 64},
}


def font(path, size):
    return ImageFont.truetype(path, size)


def rr(d, box, radius, **kw):
    d.rounded_rectangle(box, radius=radius, **kw)


def draw_suit_icon(d, suit, cx, cy, size, color):
    s = size / 2
    if suit == "flame":
        pts = [(cx, cy - s), (cx + s * 0.9, cy - s * 0.2), (cx + s * 0.7, cy + s * 0.5),
               (cx, cy + s), (cx - s * 0.7, cy + s * 0.5), (cx - s * 0.9, cy - s * 0.2)]
        d.polygon(pts, fill=color)
        inner = [(cx, cy - s * 0.1), (cx + s * 0.45, cy + s * 0.25), (cx + s * 0.3, cy + s * 0.7),
                 (cx, cy + s * 0.72), (cx - s * 0.3, cy + s * 0.7), (cx - s * 0.45, cy + s * 0.25)]
        d.polygon(inner, fill=(255, 210, 61))
    elif suit == "tide":
        for row in range(2):
            yy = cy - s * 0.4 + row * s * 0.8
            pts = []
            for i in range(21):
                t = i / 20
                x = cx - s + 2 * s * t
                y = yy + math.sin(t * math.pi * 2) * s * 0.28
                pts.append((x, y))
            d.line(pts, fill=color, width=max(2, int(size * 0.09)))
    elif suit == "stone":
        d.polygon([(cx - s, cy + s * 0.7), (cx - s * 0.45, cy - s * 0.55), (cx, cy + s * 0.1),
                   (cx + s * 0.4, cy - s * 0.9), (cx + s, cy + s * 0.7)], fill=color)
        d.polygon([(cx + s * 0.4, cy - s * 0.9), (cx + s * 0.72, cy - s * 0.1),
                   (cx + s * 0.08, cy - s * 0.1)], fill=(255, 255, 255))
    else:  # gale
        d.arc([cx - s * 0.85, cy - s * 0.85, cx + s * 0.85, cy + s * 0.85],
              35, 250, fill=color, width=max(2, int(size * 0.09)))
        d.arc([cx - s * 0.45, cy - s * 0.45, cx + s * 0.45, cy + s * 0.45],
              125, 320, fill=color, width=max(2, int(size * 0.09)))
        d.ellipse([cx + s * 0.62 - s * 0.16, cy - s * 0.55 - s * 0.16,
                   cx + s * 0.62 + s * 0.16, cy - s * 0.55 + s * 0.16], fill=color)


def ember_pip(d, x, y, r, lit):
    if lit:
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 122, 26))
        d.ellipse([x - r * 0.45, y - r * 0.45, x + r * 0.45, y + r * 0.45], fill=(255, 210, 61))
    else:
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 46),
                  outline=(255, 255, 255, 89), width=1)


def card_face(card, w, h, lift=0, dim=False, selected=False):
    """A face-up card on its own RGBA layer, so it can be fanned/rotated."""
    layer = Image.new("RGBA", (w + 24, h + 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    suit = SUITS[card["suit"]]
    ox, oy = 12, 12 - lift
    rr(d, [ox, oy, ox + w, oy + h], 12, fill=CREAM + (255 if not dim else 140,),
       outline=(GOLD if selected else suit["color"]) + (255,), width=5 if selected else 3)
    rr(d, [ox + 4, oy + 4, ox + w - 4, oy + 38], 9, fill=suit["color"] + (255,))
    for i in range(card["cost"]):
        ember_pip(d, ox + 18 + i * 17, oy + 21, 6, True)
    d.text((ox + w - 12, oy + 21), suit["name"].upper(), font=font(BOLD, round(w * 0.11)),
           fill=(255, 255, 255, 255), anchor="rm")
    d.text((ox + w / 2, oy + h * 0.52), str(card["value"]), font=font(BOLD, round(w * 0.52)),
           fill=INK + (255,), anchor="mm")
    draw_suit_icon(d, card["suit"], ox + w / 2, oy + h * 0.24, w * 0.3, suit["color"])
    d.text((ox + w / 2, oy + h - 18), card["name"], font=font(BOLD, round(w * 0.115)),
           fill=suit["dark"] + (255,), anchor="mm")
    return layer


def card_back(w, h):
    layer = Image.new("RGBA", (w + 8, h + 8), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rr(d, [4, 4, 4 + w, 4 + h], 10, fill=(58, 28, 18, 255),
       outline=(201, 106, 46, 255), width=2)
    rr(d, [10, 10, 4 + w - 6, 4 + h - 6], 7, outline=(201, 106, 46, 153), width=2)
    cx, cy = 4 + w / 2, 4 + h / 2
    s = min(w, h) * 0.2
    d.polygon([(cx, cy - s / 2), (cx + s / 2, cy), (cx, cy + s / 2), (cx - s / 2, cy)],
              fill=(255, 122, 26, 255))
    d.polygon([(cx, cy - s / 4), (cx + s / 4, cy), (cx, cy + s / 4), (cx - s / 4, cy)],
              fill=(255, 210, 61, 255))
    return layer


def life_bar(d, x, y, w, h, life, max_life, shield, label):
    if label:
        d.text((x, y - 14), label, font=font(BOLD, 15), fill=CREAM, anchor="lm")
    rr(d, [x, y, x + w, y + h], 10, fill=(0, 0, 0, 140))
    frac = max(0, life / max_life)
    if frac > 0:
        rr(d, [x + 2, y + 2, x + 2 + (w - 4) * frac, y + h - 2], 8,
           fill=(232, 73, 29) if life <= 8 else (63, 174, 90))
    if shield > 0:
        d.text((x + w, y - 14), f"+{shield} shield", font=font(BOLD, 13),
               fill=(109, 179, 255), anchor="rm")
    d.text((x + w / 2, y + h / 2 + 1), f"{life} / {max_life}", font=font(BOLD, 14),
           fill=(255, 255, 255), anchor="mm")


def button(d, x, y, w, h, text, enabled=True, hot=False):
    rr(d, [x, y, x + w, y + h], 12,
       fill=(255, 138, 61) if hot else ((232, 73, 29) if enabled else (255, 255, 255, 36)),
       outline=(GOLD if enabled else (255, 255, 255, 64)), width=2)
    d.text((x + w / 2, y + h / 2 + 1), text, font=font(BOLD, 20),
           fill=(255, 255, 255) if enabled else (255, 255, 255, 128), anchor="mm")


def draw_table(img):
    d = ImageDraw.Draw(img, "RGBA")
    # Felt: concentric ellipses from the bright centre to the dark edge.
    cx, cy = 640, 360
    steps = 42
    for i in range(steps, 0, -1):
        t = i / steps
        r = int(30 + (1 - t) * 40)
        g = int(82 + (1 - t) * 40)
        b = int(51 + (1 - t) * 27)
        rx, ry = 820 * t, 560 * t
        d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=(r, g, b))
    d.rectangle([0, 0, W, H], outline=WOOD, width=18)
    d.ellipse([80, 60, 1200, 660], outline=(255, 210, 61, 64), width=2)
    return d


def draw_foe_area(img, d, st):
    L = LAYOUT["foeHand"]
    for i in range(5):
        x = L["x"] + (i - 2) * L["gap"] - L["w"] / 2
        img.paste(card_back(L["w"], L["h"]), (int(x) - 4, L["y"] - 4), card_back(L["w"], L["h"]))
    p = LAYOUT["foePortrait"]
    d.ellipse([p["x"] - p["r"], p["y"] - p["r"], p["x"] + p["r"], p["y"] + p["r"]],
              fill=(42, 22, 14), outline=(201, 106, 46), width=4)
    draw_suit_icon(d, "flame", p["x"], p["y"] + 4, 64, SUITS["flame"]["color"])
    d.ellipse([p["x"] - 18, p["y"] - 16, p["x"] - 10, p["y"] - 8], fill=GOLD)
    d.ellipse([p["x"] + 10, p["y"] - 16, p["x"] + 18, p["y"] - 8], fill=GOLD)
    fl = LAYOUT["foeLife"]
    d.text((fl["x"], fl["y"] - 26), f"{st['foeName']} — {st['foeTitle']}",
           font=font(BOLD, 20), fill=CREAM, anchor="lm")
    life_bar(d, fl["x"], fl["y"], fl["w"], fl["h"], st["foe"]["life"], st["foe"]["maxLife"],
             st["foe"]["shield"], "")
    d.text((fl["x"], fl["y"] + 44), f"Deck {st['foe']['deck']}  ·  Discard {st['foe']['discard']}",
           font=font(REG, 14), fill=(247, 239, 220, 217), anchor="lm")


def draw_intent(d, st):
    L = LAYOUT["intent"]
    rr(d, [L["x"] - L["w"] / 2, L["y"] - L["h"] / 2, L["x"] + L["w"] / 2, L["y"] + L["h"] / 2],
       20, fill=(0, 0, 0, 115),
       outline=SUITS[st["intent"]["suit"]]["color"] if st["intent"] else (255, 255, 255, 76), width=2)
    if st["intent"]:
        suit = SUITS[st["intent"]["suit"]]
        draw_suit_icon(d, st["intent"]["suit"], L["x"] - L["w"] / 2 + 34, L["y"], 26, suit["light"])
        d.text((L["x"] - L["w"] / 2 + 56, L["y"] + 1),
               f"{st['foeName']} will play a {suit['name']} card",
               font=font(BOLD, 17), fill=CREAM, anchor="lm")
    else:
        d.text((L["x"], L["y"] + 1), f"{st['foeName']} has nothing to play",
               font=font(BOLD, 17), fill=(247, 239, 220, 204), anchor="mm")


def draw_played(img, d, st):
    L = LAYOUT
    d.text((L["playedPlayer"]["x"] + 75, L["playedPlayer"]["y"] - 12), "LAST PLAYED",
           font=font(BOLD, 13), fill=(0, 0, 0, 76), anchor="mm")
    d.text((L["playedFoe"]["x"] + 75, L["playedFoe"]["y"] - 12), "LAST PLAYED",
           font=font(BOLD, 13), fill=(0, 0, 0, 76), anchor="mm")
    for key, card in (("playedPlayer", st["lastPlayedPlayer"]), ("playedFoe", st["lastPlayedFoe"])):
        pos = L[key]
        if card:
            layer = card_face(card, pos["w"], pos["h"])
            img.paste(layer, (pos["x"] - 12, pos["y"] - 12), layer)
        else:
            rr(d, [pos["x"], pos["y"], pos["x"] + pos["w"], pos["y"] + pos["h"]], 12,
               outline=(255, 255, 255, 64), width=2)
    d.text((640, 340), "VS", font=font(BOLD, 26), fill=GOLD, anchor="mm")


def draw_combo(d, st):
    if not st["comboBanner"]:
        return
    L = LAYOUT["combo"]
    suit = SUITS[st["comboBanner"]["suit"]]
    rr(d, [L["x"] - L["w"] / 2, L["y"] - L["h"] / 2, L["x"] + L["w"] / 2, L["y"] + L["h"] / 2],
       18, fill=suit["color"], outline=GOLD, width=3)
    d.text((L["x"], L["y"] + 1), st["comboBanner"]["text"], font=font(BOLD, 20),
           fill=(255, 255, 255), anchor="mm")


def draw_player_area(img, d, st, guided=-1):
    L = LAYOUT
    life_bar(d, L["playerLife"]["x"], L["playerLife"]["y"], L["playerLife"]["w"], L["playerLife"]["h"],
             st["player"]["life"], st["player"]["maxLife"], st["player"]["shield"], "YOU")
    ex, ey = L["ember"]["x"], L["ember"]["y"]
    d.text((ex, ey - 18), "EMBERS", font=font(BOLD, 15), fill=CREAM, anchor="lm")
    for i in range(10):
        ember_pip(d, ex + 12 + i * 24, ey + 8, 9, i < st["player"]["ember"])
    d.text((ex + 12 + 240 + 6, ey + 8), str(st["player"]["ember"]), font=font(BOLD, 18),
           fill=GOLD, anchor="lm")
    d.text((ex, ey + 40),
           f"Turn {st['turn']}  ·  Deck {st['player']['deck']}",
           font=font(REG, 14), fill=(247, 239, 220, 217), anchor="lm")
    hand = st["player"]["hand"]
    n = len(hand)
    for i, card in enumerate(hand):
        slot_x = L["hand"]["x"] + (i - (n - 1) / 2) * L["hand"]["gap"] - L["hand"]["w"] / 2
        fan = (i - (n - 1) / 2) * 0.035
        layer = card_face(card, L["hand"]["w"], L["hand"]["h"],
                          dim=card["cost"] > st["player"]["ember"])
        if fan:
            layer = layer.rotate(math.degrees(fan), resample=Image.BICUBIC, expand=True)
            img.paste(layer, (int(slot_x) - 12 - (layer.width - (L["hand"]["w"] + 24)) // 2,
                              L["hand"]["y"] - 12 - (layer.height - (L["hand"]["h"] + 24)) // 2), layer)
        else:
            img.paste(layer, (int(slot_x) - 12, L["hand"]["y"] - 12), layer)
        if guided == i:
            rr(d, [slot_x - 6, L["hand"]["y"] - 6, slot_x + L["hand"]["w"] + 6, L["hand"]["y"] + L["hand"]["h"] + 6],
               16, outline=GOLD, width=4)
    et = L["endTurn"]
    button(d, et["x"], et["y"], et["w"], et["h"], "END TURN ✓" if False else "END TURN")
    d.text((LAYOUT["hint"]["x"], LAYOUT["hint"]["y"]),
           "Play a card, then End Turn  ·  1-5 play  ·  Enter ends turn  ·  M mutes  ·  R restarts",
           font=font(REG, 15), fill=(247, 239, 220, 230), anchor="mm")


def draw_confetti(d, seed=42, n=160):
    rng = random.Random(seed)
    colors = [(255, 210, 61), (232, 73, 29), (63, 174, 90), (43, 125, 233), (255, 138, 61), (247, 239, 220)]
    for i in range(n):
        x = 100 + rng.random() * 1080
        y = rng.random() * 700
        size = 5 + rng.random() * 7
        d.rectangle([x - size / 2, y - size / 4, x + size / 2, y + size / 4],
                    fill=colors[i % len(colors)])


def draw_overlay(d, title, color, lines, button_text):
    d.rectangle([0, 0, W, H], fill=(8, 16, 10, 184))
    d.text((640, 250), title, font=font(BOLD, 84), fill=color, anchor="mm")
    for i, line in enumerate(lines):
        d.text((640, 310 + i * 34), line, font=font(REG, 22), fill=CREAM, anchor="mm")
    b = LAYOUT["bigButton"]
    button(d, b["x"] - b["w"] / 2, b["y"], b["w"], b["h"], button_text)
    d.text((640, b["y"] + 96), "Press Enter to continue", font=font(REG, 15),
           fill=(247, 239, 220, 191), anchor="mm")


def render_title(st):
    img = Image.new("RGB", (W, H), FELT_DARK)
    d = draw_table(img)
    # The dark band sits behind the title; the fan of cards sits below it, so
    # the subtitle never crosses a card top.
    d.rectangle([0, 96, W, 226], fill=(8, 16, 10, 140))
    suits = ["flame", "tide", "stone", "gale"]
    names = ["Wildfire", "Maelstrom", "Avalanche", "Tempest"]
    for i in range(4):
        card = {"suit": suits[i], "name": names[i], "cost": 3, "value": 6 + i}
        layer = card_face(card, 150, 210)
        layer = layer.rotate((i - 1.5) * 0.12 * 180 / math.pi, resample=Image.BICUBIC, expand=True)
        x = 640 + (i - 1.5) * 120
        img.paste(layer, (int(x) - layer.width // 2, 340 - 105 - (layer.height - 234) // 2), layer)
    d.text((640, 178), "EMBER PACT", font=font(BOLD, 92), fill=GOLD, anchor="mm")
    d.text((640, 214), "A duel of ember-mages", font=font(REG, 24), fill=CREAM, anchor="mm")
    b = LAYOUT["playButton"]
    button(d, b["x"] - b["w"] / 2, b["y"], b["w"], b["h"], "▶  PLAY")
    d.text((640, 500), "Play one card a turn. Two of the same suit in a row triggers its combo.",
           font=font(REG, 18), fill=CREAM, anchor="mm")
    d.text((640, 528), "Flame burns, Tide heals, Stone shields, Gale draws. First to 0 life loses.",
           font=font(REG, 18), fill=CREAM, anchor="mm")
    d.text((640, 580), f"Duel 1: {st['foeName']}, the {st['foeTitle']} — {st['foe']['life']} life, slow embers. Win in about 2 minutes.",
           font=font(BOLD, 18), fill=GOLD, anchor="mm")
    d.text((640, 640), "Mouse or keys 1-5 to play · Enter ends turn · M mutes · R restarts",
           font=font(REG, 15), fill=(247, 239, 220, 179), anchor="mm")
    return img


def render_play(st):
    img = Image.new("RGB", (W, H), FELT_DARK)
    d = draw_table(img)
    draw_foe_area(img, d, st)
    draw_intent(d, st)
    draw_played(img, d, st)
    draw_combo(d, st)
    draw_player_area(img, d, st, guided=0 if st["turn"] == 1 else -1)
    return img


def render_win(st):
    img = render_play(st)
    d = ImageDraw.Draw(img, "RGBA")
    draw_confetti(d)
    draw_overlay(d, "VICTORY", GOLD, [
        f"You {st['player']['life']}  —  {st['foeName']} 0",
        f"Duel {st['level']} won in {st['turn']} turns.",
        f"Next duel: {st['foeName']} returns stronger.",
    ], "NEXT DUEL ▶")
    return img


def render_loss(st):
    img = render_play(st)
    d = ImageDraw.Draw(img, "RGBA")
    draw_overlay(d, "DEFEAT", (255, 90, 60), [
        st["lossLine"],
        f"You fell on turn {st['turn']}.",
        "The pact is not broken. Rematch and take it back.",
    ], "REMATCH ↻")
    return img


SHOTS = [
    ("1-title.jpg", "title", 7, render_title),
    ("2-play.jpg", "play", 7, render_play),
    ("3-win.jpg", "win", 7, render_win),
    ("4-loss.jpg", "loss", 49, render_loss),
]


def stage(name, seed):
    out = subprocess.run(["node", str(ROOT / "tools" / "dump_shot.mjs"), name, str(seed)],
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, shot, seed, render in SHOTS:
        st = stage(shot, seed)
        img = render(st)
        path = OUT / name
        img.save(path, quality=88)
        size = path.stat().st_size
        print(f"{name}: {img.size} {size} bytes screen={st['screen']}")
        assert img.size == (1280, 720), "wrong dimensions"
        assert size <= 262144, f"{name} over 256 KiB"
    print("All screenshots rendered.")


if __name__ == "__main__":
    main()
