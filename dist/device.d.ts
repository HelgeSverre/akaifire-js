import { Canvas } from "./canvas.js";
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
type Modifiers = {
    shift: boolean;
    alt: boolean;
};
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
export declare function webMidiTransport(input: MIDIInput | null, output: MIDIOutput | null): Transport;
/** The Fire's ports in a MIDIAccess, or null for the ones that are missing. */
export declare function findFirePorts(access: MIDIAccess, portName?: string): {
    input: MIDIInput | null;
    output: MIDIOutput | null;
};
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
export declare class AkaiFire {
    private readonly transport;
    /** The drawing surface that `render()` sends when it is given no other. */
    readonly canvas: Canvas;
    private readonly handlers;
    private readonly stopListening;
    private readonly padState;
    private readonly held;
    private readonly keepAlive;
    private readonly keepAliveInterval;
    private lastFrame;
    private keepAliveTimer;
    private lastFrameAt;
    private closed;
    constructor(transport: Transport, options?: FireOptions);
    /**
     * Find the Fire through Web MIDI and connect to it. Needs a browser with
     * Web MIDI and the user's permission, including SysEx (pads and the OLED are
     * SysEx messages).
     */
    static connect(options?: ConnectOptions): Promise<AkaiFire>;
    /** Listen for an event type. Returns a function that removes the listener. */
    on<K extends keyof FireEvents>(type: K, handler: (event: FireEvents[K]) => void): () => void;
    get shift(): boolean;
    get alt(): boolean;
    /** True while the button is held down. */
    isPressed(button: number): boolean;
    /** Feed one raw MIDI message, as if it came from the device. */
    receive(data: ArrayLike<number>): void;
    private emit;
    /** Row (0 = top) and column (0 = left) of a pad. */
    static padPosition(pad: number): {
        row: number;
        column: number;
    };
    /** Pad index at a row and column. */
    static padAt(row: number, column: number): number;
    /** Set one pad's colour; components are 0..127. Nothing is sent if the pad already has it. */
    setPadColor(pad: number, red: number, green: number, blue: number): void;
    /** Set several pads in one message. Pads that already have their colour are left out. */
    setPadColors(colors: readonly PadColor[]): void;
    setAllPads(red: number, green: number, blue: number): void;
    clearPads(): void;
    /** Button LED, with a `Led` value. */
    setButtonLed(button: number, value: number): void;
    /** Track LED 1..4 (top to bottom), with a `TrackLed` value. */
    setTrackLed(track: number, value: number): void;
    /** The CHANNEL / MIXER / USER indicator, with a `ControlBank` value. */
    setControlBank(state: number): void;
    clearLeds(): void;
    /** Send a canvas to the OLED (default: `this.canvas`). */
    render(canvas?: Canvas): void;
    private sendFrame;
    clearDisplay(): void;
    /** Pads, LEDs and the OLED off. */
    clearAll(): void;
    /** Stop listening and release the ports. With `clear` (default) the device is blanked first. */
    close(clear?: boolean): void;
    [Symbol.dispose](): void;
}
export {};
