import type { Transport } from "./device.js";
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
export declare class MockTransport implements Transport {
    /** Every message sent to the device, oldest first. */
    readonly sent: Uint8Array[];
    closed: boolean;
    private readonly listeners;
    send(data: Uint8Array): void;
    onMessage(handler: (data: Uint8Array) => void): () => void;
    close(): void;
    /** Deliver raw bytes as if the device had sent them. */
    receive(...bytes: number[]): void;
    pressPad(pad: number, velocity?: number): void;
    releasePad(pad: number): void;
    pressButton(button: number): void;
    releaseButton(button: number): void;
    /** Turn an encoder by `steps` (positive = clockwise), one message. */
    turnEncoder(encoder: number, steps: number): void;
    touchEncoder(encoder: number, touched?: boolean): void;
    /** The colour a pad shows after everything sent so far, or undefined if it was never set. */
    padColor(pad: number): [red: number, green: number, blue: number] | undefined;
    /** The last value sent to a button, track or bank LED controller. */
    ledValue(controller: number): number | undefined;
    /** The OLED frames sent so far. */
    get frames(): Uint8Array[];
    clear(): void;
}
