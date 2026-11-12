// MIDI constants of the AKAI Fire. Values confirmed on hardware are listed in
// the Python library's docs/HARDWARE_VERIFICATION.md (akai-fire-looper).
/** Substring of the Fire's MIDI port names on every platform. */
export const PORT_NAME = "FL STUDIO FIRE";
export const PAD_COUNT = 64;
export const PAD_ROWS = 4;
export const PAD_COLUMNS = 16;
/** Pad 0 (top left) is note 54; pads count row by row. */
export const PAD_NOTE_BASE = 54;
/** Encoders. The four on the left are touch sensitive; SELECT can be pushed (Button.Select). */
export const Encoder = {
    Volume: 0x10,
    Pan: 0x11,
    Filter: 0x12,
    Resonance: 0x13,
    Select: 0x76,
};
export const Button = {
    Select: 0x19,
    Bank: 0x1a,
    PatternUp: 0x1f,
    PatternDown: 0x20,
    Browser: 0x21,
    GridLeft: 0x22,
    GridRight: 0x23,
    Solo1: 0x24,
    Solo2: 0x25,
    Solo3: 0x26,
    Solo4: 0x27,
    Step: 0x2c,
    Note: 0x2d,
    Drum: 0x2e,
    Perform: 0x2f,
    Shift: 0x30,
    Alt: 0x31,
    Pattern: 0x32,
    Play: 0x33,
    Stop: 0x34,
    Rec: 0x35,
};
export const BUTTON_IDS = new Set(Object.values(Button));
export const ENCODER_IDS = new Set(Object.values(Encoder));
export const TOUCH_ENCODER_IDS = new Set([
    Encoder.Volume,
    Encoder.Pan,
    Encoder.Filter,
    Encoder.Resonance,
]);
/** Buttons whose LED shows two colours (red or green, and amber). */
export const DUAL_COLOR_BUTTONS = new Set([
    Button.Step,
    Button.Note,
    Button.Drum,
    Button.Perform,
    Button.Shift,
    Button.Rec,
    Button.Pattern,
    Button.Play,
]);
/**
 * Button LED values. Single-colour buttons know Off, Dim and Bright. The
 * two-colour buttons use all five: their own colour (red, or green on PATTERN
 * and PLAY) and amber, each dim or bright.
 */
export const Led = {
    Off: 0,
    Dim: 1,
    Bright: 2,
    DimPrimary: 1,
    DimAmber: 2,
    BrightPrimary: 3,
    BrightAmber: 4,
};
/** The four rectangular track LEDs beside the pad rows. */
export const TrackLed = {
    Off: 0,
    DimRed: 1,
    DimGreen: 2,
    BrightRed: 3,
    BrightGreen: 4,
};
/** Controller numbers of the track LEDs, top to bottom. */
export const TRACK_LED_CC = [0x28, 0x29, 0x2a, 0x2b];
/** The CHANNEL / MIXER / USER 1 / USER 2 indicator. `AllOff` is 0x10; 0x00 lights CHANNEL. */
export const ControlBank = {
    AllOff: 0x10,
    AllOn: 0x1f,
    Channel: 0x11,
    Mixer: 0x12,
    User1: 0x14,
    /** The hardware wants 0x03 here, not 0x18. */
    User2: 0x03,
};
export const CONTROL_BANK_CC = 0x1b;
export const OLED_WIDTH = 128;
export const OLED_HEIGHT = 64;
