import { PAD_NOTE_BASE } from "./constants.js";
import * as protocol from "./protocol.js";
/**
 * A Fire that is not there: records what is sent and lets a test play the
 * controls.
 *
 * ```ts
 * const mock = new MockTransport();
 * const fire = new AkaiFire(mock);
 * mock.pressPad(0);
 * expect(mock.padColor(0)).toEqual([0, 100, 30]);
 * ```
 */
export class MockTransport {
    /** Every message sent to the device, oldest first. */
    sent = [];
    closed = false;
    listeners = new Set();
    send(data) {
        this.sent.push(Uint8Array.from(data));
    }
    onMessage(handler) {
        this.listeners.add(handler);
        return () => this.listeners.delete(handler);
    }
    close() {
        this.closed = true;
    }
    /** Deliver raw bytes as if the device had sent them. */
    receive(...bytes) {
        const data = Uint8Array.from(bytes);
        for (const listener of [...this.listeners])
            listener(data);
    }
    pressPad(pad, velocity = 100) {
        this.receive(0x90, PAD_NOTE_BASE + pad, velocity);
    }
    releasePad(pad) {
        this.receive(0x80, PAD_NOTE_BASE + pad, 0);
    }
    pressButton(button) {
        this.receive(0x90, button, 127);
    }
    releaseButton(button) {
        this.receive(0x80, button, 0);
    }
    /** Turn an encoder by `steps` (positive = clockwise), one message. */
    turnEncoder(encoder, steps) {
        this.receive(0xb0, encoder, steps >= 0 ? steps & 0x3f : (0x80 + steps) & 0x7f);
    }
    touchEncoder(encoder, touched = true) {
        this.receive(touched ? 0x90 : 0x80, encoder, touched ? 127 : 0);
    }
    /** The colour a pad shows after everything sent so far, or undefined if it was never set. */
    padColor(pad) {
        let color;
        for (const message of this.sent)
            for (const [index, red, green, blue] of protocol.parsePadColors(message) ?? [])
                if (index === pad)
                    color = [red, green, blue];
        return color;
    }
    /** The last value sent to a button, track or bank LED controller. */
    ledValue(controller) {
        let value;
        for (const message of this.sent)
            if (message[0] === 0xb0 && message[1] === controller)
                value = message[2];
        return value;
    }
    /** The OLED frames sent so far. */
    get frames() {
        return this.sent.filter((message) => protocol.isOledFrame(message));
    }
    clear() {
        this.sent.length = 0;
    }
}
