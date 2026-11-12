import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Button, ControlBank, Encoder, Led, TrackLed, decode, isFirePort, protocol } from "../src/index.js";
import golden from "./golden.json" with { type: "json" };

describe("decoding input", () => {
  it("tells pads, buttons and encoder touches apart, though all are notes", () => {
    expect(decode([0x90, 54, 100])).toEqual({
      type: "pad",
      pad: 0,
      row: 0,
      column: 0,
      velocity: 100,
      pressed: true,
    });
    expect(decode([0x90, 54 + 63, 1])).toMatchObject({ type: "pad", pad: 63, row: 3, column: 15 });
    expect(decode([0x80, 54 + 15, 0])).toMatchObject({
      type: "pad",
      pad: 15,
      row: 0,
      column: 15,
      pressed: false,
    });
    expect(decode([0x90, 54, 0])).toMatchObject({ type: "pad", pressed: false, velocity: 0 }); // running-status release
    expect(decode([0x90, Button.Play, 127])).toEqual({ type: "button", button: 51, pressed: true });
    expect(decode([0x80, Button.Select, 0])).toEqual({ type: "button", button: 25, pressed: false });
    expect(decode([0x90, Encoder.Volume, 127])).toEqual({ type: "touch", encoder: 16, touched: true });
    expect(decode([0x80, Encoder.Resonance, 0])).toEqual({ type: "touch", encoder: 19, touched: false });
  });

  it("reads encoder turns as signed steps", () => {
    expect(decode([0xb0, Encoder.Select, 1])).toEqual({ type: "encoder", encoder: 118, delta: 1 });
    expect(decode([0xb0, Encoder.Select, 127])).toEqual({ type: "encoder", encoder: 118, delta: -1 });
    expect(decode([0xb0, Encoder.Volume, 10])).toMatchObject({ delta: 10 });
    expect(decode([0xb0, Encoder.Pan, 118])).toMatchObject({ delta: -10 });
  });

  it("ignores everything else", () => {
    expect(decode([0x90, 20, 100])).toBeNull(); // a note that is no control
    expect(decode([0x90, 118, 100])).toBeNull(); // above the last pad
    expect(decode([0xb0, 7, 100])).toBeNull();
    expect(decode([0xf8])).toBeNull();
    expect(decode([])).toBeNull();
  });

  it("recognises the port name", () => {
    expect(isFirePort("FL STUDIO FIRE")).toBe(true);
    expect(isFirePort("FL STUDIO FIRE Jack 1")).toBe(true);
    expect(isFirePort("Arturia KeyStep 37")).toBe(false);
    expect(isFirePort(null)).toBe(false);
  });
});

describe("encoding output", () => {
  it("pad colours match the Python library byte for byte", () => {
    const message = protocol.padColors([
      [0, 127, 0, 0],
      [15, 0, 64, 0],
      [63, 1, 2, 3],
    ]);
    expect([...message]).toEqual(golden.pads);
    expect(protocol.parsePadColors(message)).toEqual([
      [0, 127, 0, 0],
      [15, 0, 64, 0],
      [63, 1, 2, 3],
    ]);
  });

  it("LED messages", () => {
    expect([...protocol.buttonLed(Button.Play, Led.BrightPrimary)]).toEqual([0xb0, 0x33, 3]);
    expect([...protocol.buttonLed(Button.Stop, Led.BrightAmber)]).toEqual([0xb0, 0x34, 2]); // single colour: 0..2
    expect(() => protocol.buttonLed(0x40, 1)).toThrow(RangeError);
    expect([...protocol.trackLed(1, TrackLed.BrightGreen)]).toEqual([0xb0, 0x28, 4]);
    expect([...protocol.trackLed(4, TrackLed.DimRed)]).toEqual([0xb0, 0x2b, 1]);
    expect(() => protocol.trackLed(5, 1)).toThrow(RangeError);
    expect([...protocol.controlBank(ControlBank.User2)]).toEqual([0xb0, 0x1b, 0x03]);
    expect([...protocol.controlBank(ControlBank.AllOff)]).toEqual([0xb0, 0x1b, 0x10]);
  });

  it("OLED frames match the Python library byte for byte", () => {
    const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
    const pattern = new Uint8Array(128 * 64);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 128; x++) if ((x * 7 + y * 13) % 5 === 0) pattern[y * 128 + x] = 1;
    const frame = protocol.oledFrame(pattern);
    expect(frame.length).toBe(golden.oled.pattern.length);
    expect([...frame.slice(0, 16)]).toEqual(golden.oled.pattern.head);
    expect(sha(frame)).toBe(golden.oled.pattern.sha256);

    const single = new Uint8Array(128 * 64);
    single[0] = 1;
    expect(sha(protocol.oledFrame(single))).toBe(golden.oled.single.sha256);
    expect(protocol.isOledFrame(frame)).toBe(true);
    expect(() => protocol.oledFrame(new Uint8Array(10))).toThrow(RangeError);
  });
});
