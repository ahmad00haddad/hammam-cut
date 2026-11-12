# Generates public/og-image.png (1200x630) for link previews. Needs: pillow, arabic-reshaper, python-bidi
from PIL import Image, ImageDraw, ImageFont
import arabic_reshaper
from bidi.algorithm import get_display

W, H = 1200, 630
BG, FG, WINE = (24, 24, 24), (221, 221, 220), (100, 16, 32)
img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W, 14], fill=WINE)
d.rectangle([0, H - 14, W, H], fill=WINE)

logo = Image.open("design/logo/razor-icon.png").convert("RGBA").resize((380, 380), Image.LANCZOS)
img.paste(logo, (90, (H - 380) // 2), logo)

def ar(t): return get_display(arabic_reshaper.reshape(t))
def font(p, s): return ImageFont.truetype("C:/Windows/Fonts/" + p, s)

def right(text, y, f, fill):
    w = d.textlength(text, font=f)
    d.text((1110 - w, y), text, font=f, fill=fill)

right("H&M", 120, font("georgiab.ttf", 150), FG)
right(ar("صالون الحلاقة"), 310, font("tahomabd.ttf", 62), FG)
right(ar("احجز موعدك مع همام"), 400, font("tahoma.ttf", 46), (200, 120, 135))
right(ar("بدون انتظار · من ١٢ ظهرًا حتى ١٠ مساءً"), 480, font("tahoma.ttf", 34), (150, 150, 150))
img.save("public/og-image.png", optimize=True)
