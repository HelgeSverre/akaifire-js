import { Canvas } from "./canvas.js";
import { BUTTON_IDS, Button, ControlBank, PAD_COLUMNS, PAD_COUNT, PORT_NAME } from "./constants.js";
import * as protocol from "./protocol.js";
import type { ButtonInput, EncoderInput, PadColor, PadInput, TouchInput } from "./protocol.js";

/**
 * How the device reaches a MIDI port. Web MIDI is built in (`webMidiTransport`);
 * for Node, wrap any MIDI package; for tests there is `MockTransport`.
 */
export interface Transport {
  /** Send one complete MIDI message. */
  send(data: Uint8Array): void;
  /** Call `handler` with every incoming message. Returns a function that stops it. */
  onMessage(handler: (data: Uint8Array) => void): () => void;
  /** Release the ports. */
  close?(): void;
}

/** Modifier state at the time of the event. */
type Modifiers = { shift: boolean; alt: boolean };
export type PadEvent = PadInput & Modifiers;
export type ButtonEvent = ButtonInput & Modifiers;
export type EncoderEvent = EncoderInput & Modifiers;
export type TouchEvent = TouchInput & Modifiers;
export type FireEvent = PadEvent | ButtonEvent | EncoderEvent | TouchEvent;

export type FireEvents = {
  pad: PadEvent;
  button: ButtonEvent;
  encoder: EncoderEvent;
  touch: TouchEvent;
  /** Every input event, whatever its type. */
  input: FireEvent;
};

export type FireOptions = {
  /** Resend the last OLED frame while idle; the screen sleeps after about 8 s. Default true. */
  oledKeepAlive?: boolean;
  /** Milliseconds between keep-alive frames. Default 2000. */
  oledKeepAliveInterval?: number;
};

export type ConnectOptions = FireOptions & {
  /** Substring of the port name to look for. Default "FL STUDIO FIRE". */
  portName?: string;
  /** An existing MIDIAccess; it must have been requested with `sysex: true` for pads and the OLED. */
  access?: MIDIAccess;
};

/** A transport on a pair of Web MIDI ports. Either may be missing: input only, or output only. */
export function webMidiTransport(input: MIDIInput | null, output: MIDIOutput | null): Transport {
  // addEventListener does not open a port the way assigning onmidimessage does, so open them here.
  void input?.open?.().catch(() => {});
  void output?.open?.().catch(() => {});
  return {
    send(data) {
      output?.send(data);
    },
    onMessage(handler) {
      if (!input) return () => {};
      const listener = (event: MIDIMessageEvent) => {
        if (event.data) handler(event.data);
      };
      input.addEventListener("midimessage", listener as EventListener);
      return () => input.removeEventListener("midimessage", listener as EventListener);
    },
  };
}

/** The Fire's ports in a MIDIAccess, or null for the ones that are missing. */
export function findFirePorts(
  access: MIDIAccess,
  portName = PORT_NAME,
): { input: MIDIInput | null; output: MIDIOutput | null } {
  const match = (port: MIDIPort) =>
    port.state !== "disconnected" && (port.name ?? "").toUpperCase().includes(portName.toUpperCase());
  return {
    input: [...access.inputs.values()].find(match) ?? null,
    output: [...access.outputs.values()].find(match) ?? null,
  };
}

/**
 * An AKAI Fire: input events, pad colours, LEDs and the OLED.
 *
 * ```ts
 * const fire = await AkaiFire.connect();
 * fire.on("pad", (e) => fire.setPadColor(e.pad, 0, e.pressed ? 100 : 0, 30));
 * fire.canvas.drawText("Hello", 4, 4);
 * fire.render();
 * ```
 */
export class AkaiFire {
  /** The drawing surface that `render()` sends when it is given no other. */
  readonly canvas = new Canvas();

  private readonly handlers: { [K in keyof FireEvents]: Set<(event: FireEvents[K]) => void> } = {
    pad: new Set(),
    button: new Set(),
    encoder: new Set(),
    touch: new Set(),
    input: new Set(),
  };
  private readonly stopListening: () => void;
  private readonly padState = new Map<number, number>(); // pad -> packed colour last sent
  private readonly held = new Set<number>(); // buttons down
  private readonly keepAlive: boolean;
  private readonly keepAliveInterval: number;
  private lastFrame: Uint8Array | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | undefined;
  private lastFrameAt = 0;
  private closed = false;

  constructor(
    private readonly transport: Transport,
    options: FireOptions = {},
  ) {
    this.keepAlive = options.oledKeepAlive ?? true;
    this.keepAliveInterval = options.oledKeepAliveInterval ?? 2000;
    this.stopListening = transport.onMessage((data) => this.receive(data));
  }

  /**
   * Find the Fire through Web MIDI and connect to it. Needs a browser with
   * Web MIDI and the user's permission, including SysEx (pads and the OLED are
   * SysEx messages).
   */
  static async connect(options: ConnectOptions = {}): Promise<AkaiFire> {
    if (!options.access && typeof navigator === "undefined")
      throw new Error("AkaiFire.connect() needs Web MIDI; in Node, pass a Transport to new AkaiFire()");
    const access = options.access ?? (await navigator.requestMIDIAccess({ sysex: true }));
    const { input, output } = findFirePorts(access, options.portName);
    if (!input && !output) {
      const names = [...access.inputs.values()].map((port) => port.name).join(", ") || "none";
      throw new Error(
        `AKAI Fire not found (looked for "${options.portName ?? PORT_NAME}"; inputs: ${names})`,
      );
    }
    return new AkaiFire(webMidiTransport(input, output), options);
  }

  // --- input ------------------------------------------------------------------

  /** Listen for an event type. Returns a function that removes the listener. */
  on<K extends keyof FireEvents>(type: K, handler: (event: FireEvents[K]) => void): () => void {
    this.handlers[type].add(handler);
    return () => this.handlers[type].delete(handler);
  }

  get shift(): boolean {
    return this.held.has(Button.Shift);
  }

  get alt(): boolean {
    return this.held.has(Button.Alt);
  }

  /** True while the button is held down. */
  isPressed(button: number): boolean {
    return this.held.has(button);
  }

  /** Feed one raw MIDI message, as if it came from the device. */
  receive(data: ArrayLike<number>): void {
    const input = protocol.decode(data);
    if (!input) return;
    if (input.type === "button") {
      // The modifier state on a SHIFT or ALT event is the state after it.
      if (input.pressed) this.held.add(input.button);
      else this.held.delete(input.button);
    }
    const event = { ...input, shift: this.shift, alt: this.alt } as FireEvent;
    this.emit(event.type, event as never);
    this.emit("input", event);
  }

  private emit<K extends keyof FireEvents>(type: K, event: FireEvents[K]): void {
    for (const handler of [...this.handlers[type]]) {
      try {
        handler(event);
      } catch (error) {
        // One broken listener must not stop the others or the MIDI callback.
        console.error(`akaifire: a "${type}" listener threw`, error);
      }
    }
  }

  // --- pads -------------------------------------------------------------------

  /** Row (0 = top) and column (0 = left) of a pad. */
  static padPosition(pad: number): { row: number; column: number } {
    return { row: Math.floor(pad / PAD_COLUMNS), column: pad % PAD_COLUMNS };
  }

  /** Pad index at a row and column. */
  static padAt(row: number, column: number): number {
    return row * PAD_COLUMNS + column;
  }

  /** Set one pad's colour; components are 0..127. Nothing is sent if the pad already has it. */
  setPadColor(pad: number, red: number, green: number, blue: number): void {
    this.setPadColors([[pad, red, green, blue]]);
  }

  /** Set several pads in one message. Pads that already have their colour are left out. */
  setPadColors(colors: readonly PadColor[]): void {
    const changed: PadColor[] = [];
    for (const color of colors) {
      const [pad, red, green, blue] = color;
      if (!Number.isInteger(pad) || pad < 0 || pad >= PAD_COUNT)
        throw new RangeError(`pad must be 0..63, got ${pad}`);
      const packed = (clamp7(red) << 14) | (clamp7(green) << 7) | clamp7(blue);
      if (this.padState.get(pad) === packed) continue;
      this.padState.set(pad, packed);
      changed.push(color);
    }
    if (changed.length) this.transport.send(protocol.padColors(changed));
  }

  setAllPads(red: number, green: number, blue: number): void {
    this.setPadColors(Array.from({ length: PAD_COUNT }, (_, pad) => [pad, red, green, blue] as const));
  }

  clearPads(): void {
    this.setAllPads(0, 0, 0);
  }

  // --- LEDs -------------------------------------------------------------------

  /** Button LED, with a `Led` value. */
  setButtonLed(button: number, value: number): void {
    this.transport.send(protocol.buttonLed(button, value));
  }

  /** Track LED 1..4 (top to bottom), with a `TrackLed` value. */
  setTrackLed(track: number, value: number): void {
    this.transport.send(protocol.trackLed(track, value));
  }

  /** The CHANNEL / MIXER / USER indicator, with a `ControlBank` value. */
  setControlBank(state: number): void {
    this.transport.send(protocol.controlBank(state));
  }

  clearLeds(): void {
    for (const button of BUTTON_IDS) this.setButtonLed(button, 0);
    for (let track = 1; track <= 4; track++) this.setTrackLed(track, 0);
    this.setControlBank(ControlBank.AllOff);
  }

  // --- OLED -------------------------------------------------------------------

  /** Send a canvas to the OLED (default: `this.canvas`). */
  render(canvas: Canvas = this.canvas): void {
    this.sendFrame(protocol.oledFrame(canvas.pixels));
    if (this.keepAlive && this.keepAliveTimer === undefined && !this.closed) {
      this.keepAliveTimer = setInterval(() => {
        if (this.lastFrame && Date.now() - this.lastFrameAt >= this.keepAliveInterval - 50)
          this.sendFrame(this.lastFrame);
      }, this.keepAliveInterval);
      // In Node, do not let the timer keep the process alive.
      (this.keepAliveTimer as { unref?: () => void }).unref?.();
    }
  }

  private sendFrame(frame: Uint8Array): void {
    this.transport.send(frame);
    this.lastFrame = frame;
    this.lastFrameAt = Date.now();
  }

  clearDisplay(): void {
    this.canvas.clear();
    this.render();
  }

  // --- lifecycle --------------------------------------------------------------

  /** Pads, LEDs and the OLED off. */
  clearAll(): void {
    this.padState.clear(); // send every pad, whatever we think it shows
    this.clearPads();
    this.clearLeds();
    this.clearDisplay();
  }

  /** Stop listening and release the ports. With `clear` (default) the device is blanked first. */
  close(clear = true): void {
    if (this.closed) return;
    if (clear) {
      try {
        this.clearAll();
      } catch {
        // the device may already be gone
      }
    }
    this.closed = true;
    clearInterval(this.keepAliveTimer);
    this.keepAliveTimer = undefined;
    this.stopListening();
    for (const set of Object.values(this.handlers)) set.clear();
    this.transport.close?.();
  }

  [Symbol.dispose](): void {
    this.close();
  }
}

const clamp7 = (value: number) => Math.min(127, Math.max(0, Math.round(value)));
