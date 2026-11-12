import { afterEach, describe, expect, it, vi } from "vitest";
import { AkaiFire, Button, Canvas, ControlBank, Encoder, type FireEvent } from "../src/index.js";
import { MockTransport } from "../src/testing.js";

function setup(options = {}) {
  const mock = new MockTransport();
  const fire = new AkaiFire(mock, options);
  return { mock, fire };
}

afterEach(() => vi.useRealTimers());

describe("input events", () => {
  it("delivers typed events with the modifier state", () => {
    const { mock, fire } = setup();
    const seen: FireEvent[] = [];
    fire.on("input", (e) => seen.push(e));
    mock.pressPad(5, 90);
    mock.pressButton(Button.Shift);
    mock.pressPad(6);
    mock.releaseButton(Button.Shift);
    mock.turnEncoder(Encoder.Filter, -3);
    mock.touchEncoder(Encoder.Volume);
    expect(seen.map((e) => e.type)).toEqual(["pad", "button", "pad", "button", "encoder", "touch"]);
    expect(seen[0]).toMatchObject({ pad: 5, row: 0, column: 5, velocity: 90, pressed: true, shift: false });
    expect(seen[1]).toMatchObject({ button: Button.Shift, pressed: true, shift: true });
    expect(seen[2]).toMatchObject({ pad: 6, shift: true });
    expect(seen[3]).toMatchObject({ pressed: false, shift: false });
    expect(seen[4]).toMatchObject({ encoder: Encoder.Filter, delta: -3 });
    expect(seen[5]).toMatchObject({ encoder: Encoder.Volume, touched: true });
    expect(fire.shift).toBe(false);
  });

  it("reports pad releases, and on() returns an unsubscribe", () => {
    const { mock, fire } = setup();
    const pads: boolean[] = [];
    const off = fire.on("pad", (e) => pads.push(e.pressed));
    mock.pressPad(0);
    mock.releasePad(0);
    off();
    mock.pressPad(0);
    expect(pads).toEqual([true, false]);
  });

  it("a throwing listener does not stop the others", () => {
    const { mock, fire } = setup();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const seen: number[] = [];
    fire.on("pad", () => {
      throw new Error("boom");
    });
    fire.on("pad", (e) => seen.push(e.pad));
    mock.pressPad(3);
    expect(seen).toEqual([3]);
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});

describe("output", () => {
  it("sets pads, skips unchanged ones and batches", () => {
    const { mock, fire } = setup();
    fire.setPadColor(0, 127, 0, 0);
    fire.setPadColor(0, 127, 0, 0); // no change: not sent
    expect(mock.sent).toHaveLength(1);
    fire.setPadColors([
      [0, 127, 0, 0],
      [1, 0, 10, 0],
      [2, 0, 0, 10],
    ]);
    expect(mock.sent).toHaveLength(2);
    expect(mock.padColor(0)).toEqual([127, 0, 0]);
    expect(mock.padColor(2)).toEqual([0, 0, 10]);
    expect(mock.padColor(9)).toBeUndefined();
    expect(() => fire.setPadColor(64, 0, 0, 0)).toThrow(RangeError);
    expect(AkaiFire.padPosition(17)).toEqual({ row: 1, column: 1 });
    expect(AkaiFire.padAt(3, 15)).toBe(63);
  });

  it("LEDs and clearAll", () => {
    const { mock, fire } = setup({ oledKeepAlive: false });
    fire.setButtonLed(Button.Play, 3);
    fire.setTrackLed(2, 4);
    fire.setControlBank(ControlBank.Mixer);
    expect(mock.ledValue(Button.Play)).toBe(3);
    expect(mock.ledValue(0x29)).toBe(4);
    fire.setPadColor(7, 1, 2, 3);
    fire.clearAll();
    expect(mock.padColor(7)).toEqual([0, 0, 0]);
    expect(mock.ledValue(Button.Play)).toBe(0);
    expect(mock.ledValue(0x1b)).toBe(ControlBank.AllOff);
    expect(mock.frames).toHaveLength(1);
  });

  it("keeps the OLED awake by resending the last frame, and stops on close", () => {
    vi.useFakeTimers();
    const { mock, fire } = setup();
    fire.canvas.drawText("Hi", 2, 2);
    fire.render();
    expect(mock.frames).toHaveLength(1);
    vi.advanceTimersByTime(6100);
    expect(mock.frames).toHaveLength(4);
    expect([...mock.frames[3]!]).toEqual([...mock.frames[0]!]);
    fire.close(false);
    vi.advanceTimersByTime(6000);
    expect(mock.frames).toHaveLength(4);
    expect(mock.closed).toBe(true);
    mock.pressPad(0); // no listener left: nothing happens
  });
});

describe("canvas", () => {
  it("draws shapes inside the screen and ignores the rest", () => {
    const c = new Canvas();
    c.setPixel(-1, 0).setPixel(128, 0).setPixel(0, 64).setPixel(3, 2);
    expect(c.getPixel(3, 2)).toBe(1);
    expect(c.getPixel(200, 2)).toBeUndefined();
    expect(c.pixels.reduce((n, v) => n + v, 0)).toBe(1);
    c.clear().fillRect(126, 62, 10, 10);
    expect(c.pixels.reduce((n, v) => n + v, 0)).toBe(4);
    c.clear().drawRect(0, 0, 4, 3);
    expect(
      c
        .toString()
        .split("\n")
        .slice(0, 3)
        .map((r) => r.slice(0, 5)),
    ).toEqual(["####.", "#..#.", "####."]);
    c.clear().drawLine(0, 0, 3, 3);
    expect([0, 1, 2, 3].every((i) => c.getPixel(i, i) === 1)).toBe(true);
    c.clear().fillCircle(10, 10, 3);
    expect(c.getPixel(10, 10)).toBe(1);
    expect(c.getPixel(10, 14)).toBe(0);
  });

  it("measures, fits and draws text", () => {
    expect(Canvas.textWidth("")).toBe(0);
    expect(Canvas.textWidth("AB")).toBe(Canvas.textWidth("A") + Canvas.textWidth("B"));
    const long = "A very long line of text that cannot fit";
    const fitted = Canvas.fitText(long, 60);
    expect(fitted.endsWith("...")).toBe(true);
    expect(Canvas.textWidth(fitted)).toBeLessThanOrEqual(60);
    expect(Canvas.fitText("short", 60)).toBe("short");
    const c = new Canvas();
    const end = c.drawText("Fire", 4, 4);
    expect(end).toBe(4 + Canvas.textWidth("Fire"));
    expect(c.pixels.reduce((n, v) => n + v, 0)).toBeGreaterThan(20);
    // Everything stays inside the text's box.
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 128; x++)
        if (c.getPixel(x, y)) expect(x >= 4 && x < end && y >= 4 && y < 16).toBe(true);
    c.drawPage("Title", ["one", "two"])
      .drawMenu("Menu", ["a", "b", "c", "d", "e"], 4)
      .drawValuePage("Cutoff", "Value", "64", 0.5);
    expect(c.getPixel(0, 0)).toBe(1); // inverted header
  });

  it("takes image data", () => {
    const data = new Uint8ClampedArray(2 * 1 * 4);
    data.set([255, 255, 255, 255, 0, 0, 0, 255]);
    const c = new Canvas().drawImageData({ width: 2, height: 1, data });
    expect([c.getPixel(0, 0), c.getPixel(1, 0)]).toEqual([1, 0]);
  });
});
