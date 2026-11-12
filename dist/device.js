import { Canvas } from "./canvas.js";
import { BUTTON_IDS, Button, ControlBank, PAD_COLUMNS, PAD_COUNT, PORT_NAME } from "./constants.js";
import * as protocol from "./protocol.js";
/** A transport on a pair of Web MIDI ports. Either may be missing: input only, or output only. */
export function webMidiTransport(input, output) {
    return {
        send(data) {
            output?.send(data);
        },
        onMessage(handler) {
            if (!input)
                return () => { };
            const listener = (event) => {
                if (event.data)
                    handler(event.data);
            };
            input.addEventListener("midimessage", listener);
            return () => input.removeEventListener("midimessage", listener);
        },
    };
}
/** The Fire's ports in a MIDIAccess, or null for the ones that are missing. */
export function findFirePorts(access, portName = PORT_NAME) {
    const match = (port) => port.state !== "disconnected" && (port.name ?? "").toUpperCase().includes(portName.toUpperCase());
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
    transport;
    /** The drawing surface that `render()` sends when it is given no other. */
    canvas = new Canvas();
    handlers = {
        pad: new Set(),
        button: new Set(),
        encoder: new Set(),
        touch: new Set(),
        input: new Set(),
    };
    stopListening;
    padState = new Map(); // pad -> packed colour last sent
    held = new Set(); // buttons down
    keepAlive;
    keepAliveInterval;
    lastFrame = null;
    keepAliveTimer;
    lastFrameAt = 0;
    closed = false;
    constructor(transport, options = {}) {
        this.transport = transport;
        this.keepAlive = options.oledKeepAlive ?? true;
        this.keepAliveInterval = options.oledKeepAliveInterval ?? 2000;
        this.stopListening = transport.onMessage((data) => this.receive(data));
    }
    /**
     * Find the Fire through Web MIDI and connect to it. Needs a browser with
     * Web MIDI and the user's permission, including SysEx (pads and the OLED are
     * SysEx messages).
     */
    static async connect(options = {}) {
        if (!options.access && typeof navigator === "undefined")
            throw new Error("AkaiFire.connect() needs Web MIDI; in Node, pass a Transport to new AkaiFire()");
        const access = options.access ?? (await navigator.requestMIDIAccess({ sysex: true }));
        const { input, output } = findFirePorts(access, options.portName);
        if (!input && !output) {
            const names = [...access.inputs.values()].map((port) => port.name).join(", ") || "none";
            throw new Error(`AKAI Fire not found (looked for "${options.portName ?? PORT_NAME}"; inputs: ${names})`);
        }
        return new AkaiFire(webMidiTransport(input, output), options);
    }
    // --- input ------------------------------------------------------------------
    /** Listen for an event type. Returns a function that removes the listener. */
    on(type, handler) {
        this.handlers[type].add(handler);
        return () => this.handlers[type].delete(handler);
    }
    get shift() {
        return this.held.has(Button.Shift);
    }
    get alt() {
        return this.held.has(Button.Alt);
    }
    /** True while the button is held down. */
    isPressed(button) {
        return this.held.has(button);
    }
    /** Feed one raw MIDI message, as if it came from the device. */
    receive(data) {
        const input = protocol.decode(data);
        if (!input)
            return;
        if (input.type === "button") {
            // The modifier state on a SHIFT or ALT event is the state after it.
            if (input.pressed)
                this.held.add(input.button);
            else
                this.held.delete(input.button);
        }
        const event = { ...input, shift: this.shift, alt: this.alt };
        this.emit(event.type, event);
        this.emit("input", event);
    }
    emit(type, event) {
        for (const handler of [...this.handlers[type]]) {
            try {
                handler(event);
            }
            catch (error) {
                // One broken listener must not stop the others or the MIDI callback.
                console.error(`akaifire: a "${type}" listener threw`, error);
            }
        }
    }
    // --- pads -------------------------------------------------------------------
    /** Row (0 = top) and column (0 = left) of a pad. */
    static padPosition(pad) {
        return { row: Math.floor(pad / PAD_COLUMNS), column: pad % PAD_COLUMNS };
    }
    /** Pad index at a row and column. */
    static padAt(row, column) {
        return row * PAD_COLUMNS + column;
    }
    /** Set one pad's colour; components are 0..127. Nothing is sent if the pad already has it. */
    setPadColor(pad, red, green, blue) {
        this.setPadColors([[pad, red, green, blue]]);
    }
    /** Set several pads in one message. Pads that already have their colour are left out. */
    setPadColors(colors) {
        const changed = [];
        for (const color of colors) {
            const [pad, red, green, blue] = color;
            if (!Number.isInteger(pad) || pad < 0 || pad >= PAD_COUNT)
                throw new RangeError(`pad must be 0..63, got ${pad}`);
            const packed = (clamp7(red) << 14) | (clamp7(green) << 7) | clamp7(blue);
            if (this.padState.get(pad) === packed)
                continue;
            this.padState.set(pad, packed);
            changed.push(color);
        }
        if (changed.length)
            this.transport.send(protocol.padColors(changed));
    }
    setAllPads(red, green, blue) {
        this.setPadColors(Array.from({ length: PAD_COUNT }, (_, pad) => [pad, red, green, blue]));
    }
    clearPads() {
        this.setAllPads(0, 0, 0);
    }
    // --- LEDs -------------------------------------------------------------------
    /** Button LED, with a `Led` value. */
    setButtonLed(button, value) {
        this.transport.send(protocol.buttonLed(button, value));
    }
    /** Track LED 1..4 (top to bottom), with a `TrackLed` value. */
    setTrackLed(track, value) {
        this.transport.send(protocol.trackLed(track, value));
    }
    /** The CHANNEL / MIXER / USER indicator, with a `ControlBank` value. */
    setControlBank(state) {
        this.transport.send(protocol.controlBank(state));
    }
    clearLeds() {
        for (const button of BUTTON_IDS)
            this.setButtonLed(button, 0);
        for (let track = 1; track <= 4; track++)
            this.setTrackLed(track, 0);
        this.setControlBank(ControlBank.AllOff);
    }
    // --- OLED -------------------------------------------------------------------
    /** Send a canvas to the OLED (default: `this.canvas`). */
    render(canvas = this.canvas) {
        this.sendFrame(protocol.oledFrame(canvas.pixels));
        if (this.keepAlive && this.keepAliveTimer === undefined && !this.closed) {
            this.keepAliveTimer = setInterval(() => {
                if (this.lastFrame && Date.now() - this.lastFrameAt >= this.keepAliveInterval - 50)
                    this.sendFrame(this.lastFrame);
            }, this.keepAliveInterval);
            // In Node, do not let the timer keep the process alive.
            this.keepAliveTimer.unref?.();
        }
    }
    sendFrame(frame) {
        this.transport.send(frame);
        this.lastFrame = frame;
        this.lastFrameAt = Date.now();
    }
    clearDisplay() {
        this.canvas.clear();
        this.render();
    }
    // --- lifecycle --------------------------------------------------------------
    /** Pads, LEDs and the OLED off. */
    clearAll() {
        this.padState.clear(); // send every pad, whatever we think it shows
        this.clearPads();
        this.clearLeds();
        this.clearDisplay();
    }
    /** Stop listening and release the ports. With `clear` (default) the device is blanked first. */
    close(clear = true) {
        if (this.closed)
            return;
        if (clear) {
            try {
                this.clearAll();
            }
            catch {
                // the device may already be gone
            }
        }
        this.closed = true;
        clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = undefined;
        this.stopListening();
        for (const set of Object.values(this.handlers))
            set.clear();
        this.transport.close?.();
    }
    [Symbol.dispose]() {
        this.close();
    }
}
const clamp7 = (value) => Math.min(127, Math.max(0, Math.round(value)));
