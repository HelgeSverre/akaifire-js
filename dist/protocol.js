import { BUTTON_IDS, CONTROL_BANK_CC, DUAL_COLOR_BUTTONS, ENCODER_IDS, OLED_HEIGHT, OLED_WIDTH, PAD_COLUMNS, PAD_COUNT, PAD_NOTE_BASE, PORT_NAME, TOUCH_ENCODER_IDS, TRACK_LED_CC, } from "./constants.js";
/** True for the Fire's MIDI port names. */
export const isFirePort = (name) => (name ?? "").toUpperCase().includes(PORT_NAME);
/** A MIDI message from the Fire as an input event, or null for anything else. */
export function decode(data) {
    if (data.length < 3)
        return null;
    const kind = data[0] & 0xf0;
    const number = data[1];
    const value = data[2];
    if (kind === 0x90 || kind === 0x80) {
        const down = kind === 0x90 && value > 0;
        // Encoder touches share the note messages with the buttons and come first.
        if (TOUCH_ENCODER_IDS.has(number))
            return { type: "touch", encoder: number, touched: down };
        if (BUTTON_IDS.has(number))
            return { type: "button", button: number, pressed: down };
        const pad = number - PAD_NOTE_BASE;
        if (pad < 0 || pad >= PAD_COUNT)
            return null;
        return {
            type: "pad",
            pad,
            row: Math.floor(pad / PAD_COLUMNS),
            column: pad % PAD_COLUMNS,
            velocity: down ? value : 0,
            pressed: down,
        };
    }
    if (kind === 0xb0 && ENCODER_IDS.has(number)) {
        // Two's complement in seven bits: 1, 2, ... clockwise; 127, 126, ... counter-clockwise.
        return { type: "encoder", encoder: number, delta: value < 0x40 ? value : value - 0x80 };
    }
    return null;
}
const SYSEX_HEADER = [0xf0, 0x47, 0x7f, 0x43];
const clamp7 = (v) => Math.min(127, Math.max(0, Math.round(v)));
/** SysEx that sets any number of pads; colour components are 0..127. */
export function padColors(colors) {
    const length = colors.length * 4;
    const out = new Uint8Array(SYSEX_HEADER.length + 3 + length + 1);
    out.set([...SYSEX_HEADER, 0x65, (length >> 7) & 0x7f, length & 0x7f]);
    let at = SYSEX_HEADER.length + 3;
    for (const [pad, red, green, blue] of colors) {
        out[at++] = pad & 0x3f;
        out[at++] = clamp7(red);
        out[at++] = clamp7(green);
        out[at++] = clamp7(blue);
    }
    out[at] = 0xf7;
    return out;
}
/** Button LED: 0..2, or 0..4 on the two-colour buttons (see `Led`). */
export function buttonLed(button, value) {
    if (!BUTTON_IDS.has(button))
        throw new RangeError(`not a Fire button: ${button}`);
    const max = DUAL_COLOR_BUTTONS.has(button) ? 4 : 2;
    return Uint8Array.of(0xb0, button, Math.min(max, Math.max(0, value | 0)));
}
/** Track LED 1..4 (top to bottom) to a `TrackLed` value. */
export function trackLed(track, value) {
    const cc = TRACK_LED_CC[track - 1];
    if (cc === undefined)
        throw new RangeError(`track LED must be 1..4, got ${track}`);
    return Uint8Array.of(0xb0, cc, Math.min(4, Math.max(0, value | 0)));
}
/** The bank indicator, to a `ControlBank` value. */
export const controlBank = (state) => Uint8Array.of(0xb0, CONTROL_BANK_CC, state & 0x7f);
// The OLED takes its 128 x 64 pixels as 8 strips of 8 rows, packed seven bits
// to a byte; this table says where bit (column mod 7, row mod 8) goes.
const OLED_BIT = [
    [13, 0, 1, 2, 3, 4, 5, 6],
    [19, 20, 7, 8, 9, 10, 11, 12],
    [25, 26, 27, 14, 15, 16, 17, 18],
    [31, 32, 33, 34, 21, 22, 23, 24],
    [37, 38, 39, 40, 41, 28, 29, 30],
    [43, 44, 45, 46, 47, 48, 35, 36],
    [49, 50, 51, 52, 53, 54, 55, 42],
];
const OLED_BYTES = 1171; // ceil(128 * 64 / 7)
/**
 * SysEx for one OLED frame.
 * @param pixels 128 * 64 values, row by row; anything non-zero is a lit pixel
 */
export function oledFrame(pixels) {
    if (pixels.length !== OLED_WIDTH * OLED_HEIGHT)
        throw new RangeError("the OLED is 128 x 64 pixels");
    const head = [
        ...SYSEX_HEADER,
        0x0e,
        (OLED_BYTES + 4) >> 7,
        (OLED_BYTES + 4) & 0x7f,
        0, // first strip
        0x07, // last strip
        0, // first column
        0x7f, // last column
    ];
    const out = new Uint8Array(head.length + OLED_BYTES + 1);
    out.set(head);
    for (let y = 0; y < OLED_HEIGHT; y++) {
        const strip = y >> 3;
        const bitRow = y & 7;
        for (let x = 0; x < OLED_WIDTH; x++) {
            if (!pixels[y * OLED_WIDTH + x])
                continue;
            const at = x + OLED_WIDTH * strip;
            const bit = OLED_BIT[at % 7][bitRow];
            const index = head.length + Math.floor(at / 7) * 8 + Math.floor(bit / 7);
            out[index] = out[index] | (1 << (bit % 7));
        }
    }
    out[out.length - 1] = 0xf7;
    return out;
}
/** The pad colours in a pad SysEx message, or null if `data` is not one. For tests and mocks. */
export function parsePadColors(data) {
    if (data.length < 8 || data[0] !== 0xf0 || data[4] !== 0x65)
        return null;
    const length = (data[5] << 7) | data[6];
    const colors = [];
    for (let at = 7; at < 7 + length; at += 4)
        colors.push([data[at], data[at + 1], data[at + 2], data[at + 3]]);
    return colors;
}
/** True for an OLED frame message. */
export const isOledFrame = (data) => data[0] === 0xf0 && data[4] === 0x0e;
