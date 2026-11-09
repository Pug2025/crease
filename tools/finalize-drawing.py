# Turns an accepted drawing into the 640 px WebP the app ships.
# Usage: python3 tools/finalize-drawing.py <source.png> <ID>
import sys
from PIL import Image

src, drill = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB').resize((640, 640), Image.LANCZOS)
# Push the faint grey of the board to pure white so every drawing sits on the same white.
im = im.point(lambda v: 255 if v > 228 else v)
im.save(f'media/draw/{drill}.webp', 'WEBP', quality=82)
print(f'media/draw/{drill}.webp')
