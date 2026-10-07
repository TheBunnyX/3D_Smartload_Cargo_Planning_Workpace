"""Encode real browser screenshots into the 10-second README demo.

Usage: python scripts/build_demo_gif.py
Requires Pillow. Source screenshots are captured from the running app into
docs/demo-frames/: cargo.png, step-00.png through step-18.png, report.png.
This script only composes captured frames; it does not simulate the website.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageSequence

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs' / 'demo-frames'
OUTPUT = ROOT / 'docs' / 'assets' / 'demo.gif'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
WIDTH, HEIGHT = 960, 920
try:
    font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 18)
except OSError:
    font = ImageFont.load_default()

timeline = [('cargo.png', 1500, '01  /  Manage cargo dimensions, quantities and constraints')]
timeline += [('step-00.png', 1000, '02  /  Explore the 3D placement sequence')]
timeline += [(f'step-{i:02}.png', 300, f'02  /  Explore the 3D placement sequence  |  {i} / 18 units') for i in range(1, 19)]
timeline += [('report.png', 2100, '03  /  Review the dispatch report and loading manifest')]
frames = []
for filename, duration, caption in timeline:
    with Image.open(SOURCE / filename) as source:
        source = source.convert('RGB')
        # Keep the app header, configuration and sequence controls visible.
        crop_height = min(source.height, round(source.width * (HEIGHT - 48) / WIDTH))
        content = source.crop((0, 0, source.width, crop_height))
        content = content.resize((WIDTH, round(content.height * WIDTH / content.width)), Image.Resampling.LANCZOS)
    frame = Image.new('RGB', (WIDTH, HEIGHT), '#f4f6fa')
    frame.paste(content, (0, 48))
    draw = ImageDraw.Draw(frame)
    draw.rectangle((0, 0, WIDTH, 47), fill='#24304a')
    draw.text((20, 12), caption, font=font, fill='white')
    frames.append(frame.quantize(colors=192, method=Image.Quantize.MEDIANCUT))

frames[0].save(OUTPUT, save_all=True, append_images=frames[1:], duration=[step[1] for step in timeline], loop=0, optimize=True, disposal=2)
with Image.open(OUTPUT) as gif:
    total = sum(frame.info.get('duration', 0) for frame in ImageSequence.Iterator(gif))
    assert total == 10000, f'Expected 10 seconds, got {total}ms'
    assert gif.n_frames == len(timeline), 'Unexpected collapsed or missing frames'
    print(f'{OUTPUT}: {gif.n_frames} frames, {total / 1000:.2f}s, {gif.size}, {OUTPUT.stat().st_size:,} bytes')
    gif.seek(12)
    gif.convert('RGB').save(SOURCE / 'gif-check.png')
