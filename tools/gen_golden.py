"""Golden data for the tests, produced by the Python library itself.

    cd ~/code/akai-fire-looper && uv run python ~/code/akaifire-js/tools/gen_golden.py

Writes tests/golden.json: the OLED SysEx for a test pattern and for a line of
text, and the pad-colour SysEx for a few pads.
"""

import hashlib
import json
from pathlib import Path

from akai_fire.canvas import Canvas
from akai_fire.hardware import AkaiFire

OUT = Path(__file__).resolve().parents[1] / "tests" / "golden.json"


class Capture:
    def __init__(self):
        self.sent = []

    def send_message(self, message):
        self.sent.append(list(message))


def oled(canvas):
    """Run the library's own encoder without opening a MIDI port."""
    import threading

    fire = AkaiFire.__new__(AkaiFire)
    fire._io_lock = threading.RLock()
    fire.midi_out = Capture()
    fire._oled_keepalive = False
    fire._oled_thread = None
    fire._deliver_display(canvas)
    return fire.midi_out.sent[0]


pattern = Canvas()
for y in range(64):
    for x in range(128):
        if (x * 7 + y * 13) % 5 == 0:
            pattern.set_pixel(x, y, 0)  # 0 = lit
text = Canvas()
text.draw_text("Hello, Fire! 0123", 4, 10)
single = Canvas()
single.set_pixel(0, 0, 0)

frames = {"pattern": oled(pattern), "single": oled(single), "text": oled(text)}
lit = lambda c: [[x, y] for y in range(64) for x in range(128) if c.get_pixel(x, y) == 0]  # noqa: E731
data = {
    "oled": {
        name: {"length": len(frame), "head": frame[:16], "sha256": hashlib.sha256(bytes(frame)).hexdigest()}
        for name, frame in frames.items()
    },
    "textPixels": lit(text),
    "pads": AkaiFire._create_sysex_message([(0, 127, 0, 0), (15, 0, 64, 0), (63, 1, 2, 3)]),
}
OUT.write_text(json.dumps(data) + "\n")
print({k: v["sha256"][:12] for k, v in data["oled"].items()}, len(data["textPixels"]), "text pixels")
