/**
 * A 128 x 64 one-bit drawing surface for the Fire's OLED. Pixels are 1 (lit)
 * or 0 (dark); every drawing method takes the colour last and defaults to lit.
 * Coordinates outside the screen are ignored, so shapes may run off its edges.
 */
export declare class Canvas {
    static readonly WIDTH = 128;
    static readonly HEIGHT = 64;
    /** Height of a header band, and where the content under it starts. */
    static readonly HEADER_HEIGHT = 16;
    static readonly CONTENT_START = 18;
    static readonly LINE_HEIGHT: number;
    readonly pixels: Uint8Array<ArrayBuffer>;
    clone(): Canvas;
    clear(color?: number): this;
    getPixel(x: number, y: number): number | undefined;
    setPixel(x: number, y: number, color?: number): this;
    fillRect(x: number, y: number, width: number, height: number, color?: number): this;
    drawRect(x: number, y: number, width: number, height: number, color?: number): this;
    drawBorder(thickness?: number, color?: number): this;
    drawLine(x0: number, y0: number, x1: number, y1: number, color?: number): this;
    drawCircle(cx: number, cy: number, radius: number, color?: number): this;
    fillCircle(cx: number, cy: number, radius: number, color?: number): this;
    private circle;
    /** Width of one line of text in pixels. Characters the font lacks count as "?". */
    static textWidth(text: string): number;
    /** `text` cut to fit `width` pixels, with "..." when something was cut. */
    static fitText(text: string, width: number): string;
    /** Draw one line of text with its top-left corner at (x, y). Returns the x after the last character. */
    drawText(text: string, x: number, y: number, color?: number): number;
    /** Text cut to the given width (default: what is left of the screen, less a 2 px margin). */
    drawTextFitted(text: string, x: number, y: number, color?: number, width?: number): this;
    drawTextCentered(text: string, y: number, color?: number): this;
    /** A title band on top (inverted by default). */
    drawHeader(title: string, inverted?: boolean): this;
    /** A whole screen: a title and up to four lines of text. */
    drawPage(title: string, lines: readonly string[], headerInverted?: boolean): this;
    /** A whole screen: a title, a label, a value and a bar showing `ratio` (0..1). */
    drawValuePage(title: string, label: string, value: string, ratio?: number): this;
    /** A whole screen: a title and a scrolling list with one entry highlighted. */
    drawMenu(title: string, items: readonly string[], selected: number): this;
    /**
     * Copy an image onto the canvas, e.g. `context.getImageData(0, 0, 128, 64)`
     * from a browser canvas. Pixels brighter than `threshold` (0..255) are lit.
     */
    drawImageData(image: {
        width: number;
        height: number;
        data: ArrayLike<number>;
    }, threshold?: number): this;
    /** The canvas as text, one line per pixel row ("#" lit, "." dark). For tests and debugging. */
    toString(): string;
}
