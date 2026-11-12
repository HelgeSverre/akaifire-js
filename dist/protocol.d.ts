export type PadInput = {
    type: "pad";
    /** 0..63, row by row from the top left */
    pad: number;
    /** 0 (top) .. 3 */
    row: number;
    /** 0 (left) .. 15 */
    column: number;
    /** 1..127 on a press, 0 on a release */
    velocity: number;
    pressed: boolean;
};
export type ButtonInput = {
    type: "button";
    button: number;
    pressed: boolean;
};
export type EncoderInput = {
    type: "encoder";
    encoder: number;
    /** Signed steps: positive clockwise. Fast turns give more than one step per message. */
    delta: number;
};
export type TouchInput = {
    type: "touch";
    encoder: number;
    touched: boolean;
};
export type FireInput = PadInput | ButtonInput | EncoderInput | TouchInput;
/** True for the Fire's MIDI port names. */
export declare const isFirePort: (name: string | null | undefined) => boolean;
/** A MIDI message from the Fire as an input event, or null for anything else. */
export declare function decode(data: ArrayLike<number>): FireInput | null;
export type PadColor = readonly [pad: number, red: number, green: number, blue: number];
/** SysEx that sets any number of pads; colour components are 0..127. */
export declare function padColors(colors: readonly PadColor[]): Uint8Array;
/** Button LED: 0..2, or 0..4 on the two-colour buttons (see `Led`). */
export declare function buttonLed(button: number, value: number): Uint8Array;
/** Track LED 1..4 (top to bottom) to a `TrackLed` value. */
export declare function trackLed(track: number, value: number): Uint8Array;
/** The bank indicator, to a `ControlBank` value. */
export declare const controlBank: (state: number) => Uint8Array;
/**
 * SysEx for one OLED frame.
 * @param pixels 128 * 64 values, row by row; anything non-zero is a lit pixel
 */
export declare function oledFrame(pixels: ArrayLike<number>): Uint8Array;
/** The pad colours in a pad SysEx message, or null if `data` is not one. For tests and mocks. */
export declare function parsePadColors(data: ArrayLike<number>): PadColor[] | null;
/** True for an OLED frame message. */
export declare const isOledFrame: (data: ArrayLike<number>) => boolean;
