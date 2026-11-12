"""Cut a mask drawing out of its flat background and save it small for the phone.

Usage: python3 tools/finalize-mask.py <source.png> <media/masks/mN.webp>

The background is flood-filled from the four corners, so the light area inside the cage
(which the fill can't reach) stays solid. The alpha edge is thresholded then softened one
pixel, because generated edges are never clean.
"""
import sys
from PIL import Image, ImageDraw, ImageFilter

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
w, h = im.size
KEY = (255, 0, 255)
work = im.copy()
for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
    ImageDraw.floodfill(work, xy, KEY, thresh=28)
alpha = Image.new('L', (w, h), 255)
ap = alpha.load()
wp = work.load()
for y in range(h):
    for x in range(w):
        if wp[x, y] == KEY:
            ap[x, y] = 0
# Pull the edge in one pixel to lose the light fringe, then soften it.
alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
rgba = im.convert('RGBA')
rgba.putalpha(alpha)
box = rgba.getbbox()
rgba = rgba.crop(box)
side = max(rgba.size)
pad = int(side * 0.04)
sq = Image.new('RGBA', (side + 2 * pad, side + 2 * pad), (0, 0, 0, 0))
sq.paste(rgba, ((side - rgba.size[0]) // 2 + pad, (side - rgba.size[1]) // 2 + pad))
sq = sq.resize((512, 512), Image.LANCZOS)
sq.save(out, 'WEBP', quality=88, method=6)
print(out, sq.size)
