# Makes a contact sheet of images so a set can be checked at a glance.
# Usage: python3 tools/contact-sheet.py <folder> <out.png> [columns] [tile]
import os
import sys
from PIL import Image, ImageDraw

folder, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
tile = int(sys.argv[4]) if len(sys.argv) > 4 else 200
files = sorted(f for f in os.listdir(folder) if f.lower().endswith(('.png', '.webp', '.jpg')))
rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tile, rows * (tile + 22)), 'white')
d = ImageDraw.Draw(sheet)
for i, f in enumerate(files):
    im = Image.open(os.path.join(folder, f)).convert('RGB')
    im.thumbnail((tile - 8, tile - 8))
    x, y = (i % cols) * tile, (i // cols) * (tile + 22)
    sheet.paste(im, (x + 4, y + 4))
    label = f.replace('image-20261109-', '').replace('crease-', '')[:28]
    d.text((x + 4, y + tile), label, fill='black')
os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
sheet.save(out)
print(out, len(files))
