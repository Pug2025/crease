# Draws the Crease app icon: the goal crease (light blue, red outline) on its red goal line.
# Run from the Crease folder: python3 tools/make-icons.py
from PIL import Image, ImageDraw

SIZE = 1024


def icon(size, path):
    im = Image.new('RGB', (SIZE, SIZE), (241, 245, 248))
    d = ImageDraw.Draw(im)
    cx, base, r, lw = SIZE // 2, 690, 330, 34
    d.pieslice([cx - r, base - r, cx + r, base + r], 180, 360, fill=(108, 180, 228), outline=(210, 31, 46), width=lw)
    d.rectangle([90, base - lw // 2, SIZE - 90, base + lw // 2], fill=(210, 31, 46))
    im.resize((size, size), Image.LANCZOS).save(path)


for s in (180, 192, 512):
    icon(s, f'icons/crease-{s}.png')
print('icons written')
