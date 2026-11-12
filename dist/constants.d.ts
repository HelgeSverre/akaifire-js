/** Substring of the Fire's MIDI port names on every platform. */
export declare const PORT_NAME = "FL STUDIO FIRE";
export declare const PAD_COUNT = 64;
export declare const PAD_ROWS = 4;
export declare const PAD_COLUMNS = 16;
/** Pad 0 (top left) is note 54; pads count row by row. */
export declare const PAD_NOTE_BASE = 54;
/** Encoders. The four on the left are touch sensitive; SELECT can be pushed (Button.Select). */
export declare const Encoder: {
    readonly Volume: 16;
    readonly Pan: 17;
    readonly Filter: 18;
    readonly Resonance: 19;
    readonly Select: 118;
};
export type EncoderId = (typeof Encoder)[keyof typeof Encoder];
export declare const Button: {
    readonly Select: 25;
    readonly Bank: 26;
    readonly PatternUp: 31;
    readonly PatternDown: 32;
    readonly Browser: 33;
    readonly GridLeft: 34;
    readonly GridRight: 35;
    readonly Solo1: 36;
    readonly Solo2: 37;
    readonly Solo3: 38;
    readonly Solo4: 39;
    readonly Step: 44;
    readonly Note: 45;
    readonly Drum: 46;
    readonly Perform: 47;
    readonly Shift: 48;
    readonly Alt: 49;
    readonly Pattern: 50;
    readonly Play: 51;
    readonly Stop: 52;
    readonly Rec: 53;
};
export type ButtonId = (typeof Button)[keyof typeof Button];
export declare const BUTTON_IDS: ReadonlySet<number>;
export declare const ENCODER_IDS: ReadonlySet<number>;
export declare const TOUCH_ENCODER_IDS: ReadonlySet<number>;
/** Buttons whose LED shows two colours (red or green, and amber). */
export declare const DUAL_COLOR_BUTTONS: ReadonlySet<number>;
/**
 * Button LED values. Single-colour buttons know Off, Dim and Bright. The
 * two-colour buttons use all five: their own colour (red, or green on PATTERN
 * and PLAY) and amber, each dim or bright.
 */
export declare const Led: {
    readonly Off: 0;
    readonly Dim: 1;
    readonly Bright: 2;
    readonly DimPrimary: 1;
    readonly DimAmber: 2;
    readonly BrightPrimary: 3;
    readonly BrightAmber: 4;
};
/** The four rectangular track LEDs beside the pad rows. */
export declare const TrackLed: {
    readonly Off: 0;
    readonly DimRed: 1;
    readonly DimGreen: 2;
    readonly BrightRed: 3;
    readonly BrightGreen: 4;
};
/** Controller numbers of the track LEDs, top to bottom. */
export declare const TRACK_LED_CC: readonly [40, 41, 42, 43];
/** The CHANNEL / MIXER / USER 1 / USER 2 indicator. `AllOff` is 0x10; 0x00 lights CHANNEL. */
export declare const ControlBank: {
    readonly AllOff: 16;
    readonly AllOn: 31;
    readonly Channel: 17;
    readonly Mixer: 18;
    readonly User1: 20;
    /** The hardware wants 0x03 here, not 0x18. */
    readonly User2: 3;
};
export declare const CONTROL_BANK_CC = 27;
export declare const OLED_WIDTH = 128;
export declare const OLED_HEIGHT = 64;
