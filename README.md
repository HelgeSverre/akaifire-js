# akaifire

Control the AKAI Fire from JavaScript and TypeScript: pad, button and encoder input, RGB pads, button and
track LEDs, and the 128 × 64 OLED. Works in the browser over Web MIDI, and anywhere else through a small
transport interface. No dependencies.

It is a port of the device library of [akai-fire-looper](https://github.com/HelgeSverre/akai-fire-looper)
(Python), with the same concepts and an API shaped for JavaScript. The pad and OLED messages are tested to be
byte-identical to the Python library's.

## Install

```sh
npm install github:HelgeSverre/akaifire-js
```

## Use

```ts
import { AkaiFire, Button, Led } from "akaifire";

const fire = await AkaiFire.connect(); // asks for MIDI access, SysEx included

fire.on("pad", (e) => {
  // e: { pad, row, column, velocity, pressed, shift, alt }
  fire.setPadColor(e.pad, 0, e.pressed ? 100 : 0, 30);
});
fire.on("button", (e) => {
  if (e.button === Button.Stop && e.pressed) fire.close();
});
fire.on("encoder", (e) => console.log(e.encoder, e.delta)); // signed steps
fire.on("touch", (e) => console.log(e.encoder, e.touched));

fire.setButtonLed(Button.Play, Led.BrightPrimary);
fire.canvas.drawPage("Hello", ["Press a pad"]);
fire.render();
```

`on()` returns a function that removes the listener. `close()` blanks the device and releases it.

`AkaiFire.connect()` must run in a page the user has interacted with, and the browser asks for permission.
Pads and the OLED are SysEx messages, so the permission has to include SysEx.

### What the Fire sends

The Fire uses note messages for three things, which is why a plain MIDI keyboard handler plays low notes when
you touch a knob:

| Notes    | Control                                   | Event    |
| -------- | ----------------------------------------- | -------- |
| 16 – 19  | Touching VOLUME, PAN, FILTER, RESONANCE   | `touch`  |
| 25 – 53  | Buttons                                   | `button` |
| 54 – 117 | The 64 pads, row by row from the top left | `pad`    |

Encoder turns are control changes 16 – 19 and 118 (SELECT) with relative values; the `encoder` event gives
them as a signed `delta`.

If you only need to make sense of incoming messages, use the pure decoder and skip the device class:

```ts
import { decode, isFirePort } from "akaifire";

input.onmidimessage = (event) => {
  const e = decode(event.data); // { type: "pad" | "button" | "encoder" | "touch", ... } or null
};
```

### Pads and LEDs

```ts
fire.setPadColor(pad, red, green, blue); // components 0..127
fire.setPadColors([
  [0, 127, 0, 0],
  [1, 0, 127, 0],
]); // one message
fire.setAllPads(0, 0, 20);
fire.clearPads();

fire.setButtonLed(Button.Rec, Led.BrightPrimary); // two-colour buttons: Dim/Bright Primary or Amber
fire.setTrackLed(1, TrackLed.BrightGreen); // the four LEDs beside the pad rows
fire.setControlBank(ControlBank.Mixer);
```

Pad colours are cached: setting a pad to the colour it already has sends nothing.

### OLED

`Canvas` is a one-bit 128 × 64 surface with pixels, lines, rectangles, circles and text, plus a few whole-
screen layouts.

```ts
const c = fire.canvas;
c.clear();
c.drawHeader("Cutoff");
c.drawText("Value", 3, 20);
c.fillRect(3, 44, 80, 8);
fire.render();

c.drawPage("Title", ["line one", "line two"]);
c.drawMenu("Menu", ["First", "Second", "Third"], 1);
c.drawValuePage("Filter", "Cutoff", "64", 0.5);
c.drawImageData(context.getImageData(0, 0, 128, 64)); // from a browser canvas
```

The Fire's screen goes dark after about eight seconds without traffic, so the device resends the last frame
every two seconds. Turn that off with `new AkaiFire(transport, { oledKeepAlive: false })`.

### Other environments

`AkaiFire` talks to a `Transport`: `send(bytes)`, `onMessage(handler)` and an optional `close()`. In Node,
wrap the MIDI package you use:

```ts
import { AkaiFire, type Transport } from "akaifire";

const transport: Transport = {
  send: (data) => output.sendMessage([...data]),
  onMessage: (handler) => {
    const listener = (_dt: number, message: number[]) => handler(Uint8Array.from(message));
    input.on("message", listener);
    return () => input.off("message", listener);
  },
};
const fire = new AkaiFire(transport);
```

### Testing your code

```ts
import { AkaiFire } from "akaifire";
import { MockTransport } from "akaifire/testing";

const mock = new MockTransport();
const fire = new AkaiFire(mock);
startMyApp(fire);

mock.pressPad(0, 100);
mock.turnEncoder(Encoder.Filter, -2);
expect(mock.padColor(0)).toEqual([0, 100, 30]);
expect(mock.frames).toHaveLength(1);
```

## Differences from the Python library

- `connect()` is asynchronous; there are no threads and no handler pool.
- One `on(type, handler)` with an event object, instead of `on_pad` / `add_listener` pairs.
- Pad releases are reported (`pressed: false`).
- Encoder events carry a signed `delta` instead of a direction and a velocity.
- The canvas is a plain `Uint8Array`; its font is the same face, rasterised once (`tools/gen_font.py`).
- The application framework (`akai_fire_framework`) is not ported yet.

## Develop

```sh
bun install
bun run test     # vitest
bun run check    # tsc
bun run build    # dist/
bun run demo     # a page that connects to a Fire
```

`dist/` is committed so the package installs straight from GitHub. `tests/golden.json` and `src/font.ts` are
generated from the Python library by the scripts in `tools/`.
