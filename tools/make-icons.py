# Draws the Crease app icon in code: an ink tile with a big goal crease (light blue, red outline)
# on a red goal line, the same mark as on Today. No image model, no cost.
# Solid PNGs (no transparency): iOS rounds the corners itself.
# Run from the Crease folder: python3 tools/make-icons.py
from PIL import Image, ImageDraw

S = 4096  # drawn large, then scaled down, for smooth edges
INK = (13, 21, 32)  # #0D1520
CREASE = (108, 180, 228)  # #6CB4E4, the light blue painted in a real crease
RED = (210, 31, 46)  # #D21F2E, goal-line red

R = round(S * 0.36)  # crease radius: the crease is 72% of the tile wide
LW = round(S * 0.042)  # line weight for the crease outline and the goal line
EXT = round(S * 0.06)  # the goal line runs a little past the crease, not edge to edge (edge to edge reads as a sunrise)
BASE = round(S * 0.68)  # goal line height, so the mark sits centred


def draw():
    im = Image.new('RGB', (S, S), INK)
    d = ImageDraw.Draw(im)
    cx = S // 2
    # Red half-disc, then the light blue one inside it: an outline of even width.
    d.pieslice([cx - R, BASE - R, cx + R, BASE + R], 180, 360, fill=RED)
    r2 = R - LW
    d.pieslice([cx - r2, BASE - r2, cx + r2, BASE + r2], 180, 360, fill=CREASE)
    d.rectangle([cx - R - EXT, BASE - LW // 2, cx + R + EXT, BASE + LW // 2], fill=RED)
    return im


big = draw()
for size in (180, 192, 512):
    big.resize((size, size), Image.LANCZOS).save(f'icons/crease-{size}.png', optimize=True)
print('icons written')
