import { OLED_HEIGHT, OLED_WIDTH } from "./constants.js";
import { FONT, FONT_HEIGHT } from "./font.js";
/**
 * A 128 x 64 one-bit drawing surface for the Fire's OLED. Pixels are 1 (lit)
 * or 0 (dark); every drawing method takes the colour last and defaults to lit.
 * Coordinates outside the screen are ignored, so shapes may run off its edges.
 */
export class Canvas {
    static WIDTH = OLED_WIDTH;
    static HEIGHT = OLED_HEIGHT;
    /** Height of a header band, and where the content under it starts. */
    static HEADER_HEIGHT = 16;
    static CONTENT_START = 18;
    static LINE_HEIGHT = FONT_HEIGHT + 1;
    pixels = new Uint8Array(OLED_WIDTH * OLED_HEIGHT);
    clone() {
        const copy = new Canvas();
        copy.pixels.set(this.pixels);
        return copy;
    }
    clear(color = 0) {
        this.pixels.fill(color ? 1 : 0);
        return this;
    }
    getPixel(x, y) {
        if (x < 0 || y < 0 || x >= OLED_WIDTH || y >= OLED_HEIGHT)
            return undefined;
        return this.pixels[(y | 0) * OLED_WIDTH + (x | 0)];
    }
    setPixel(x, y, color = 1) {
        x = Math.round(x);
        y = Math.round(y);
        if (x >= 0 && y >= 0 && x < OLED_WIDTH && y < OLED_HEIGHT)
            this.pixels[y * OLED_WIDTH + x] = color ? 1 : 0;
        return this;
    }
    fillRect(x, y, width, height, color = 1) {
        const x0 = Math.max(0, Math.round(x));
        const y0 = Math.max(0, Math.round(y));
        const x1 = Math.min(OLED_WIDTH, Math.round(x + width));
        const y1 = Math.min(OLED_HEIGHT, Math.round(y + height));
        for (let row = y0; row < y1; row++)
            this.pixels.fill(color ? 1 : 0, row * OLED_WIDTH + x0, row * OLED_WIDTH + x1);
        return this;
    }
    drawRect(x, y, width, height, color = 1) {
        if (width <= 0 || height <= 0)
            return this;
        this.fillRect(x, y, width, 1, color).fillRect(x, y + height - 1, width, 1, color);
        return this.fillRect(x, y, 1, height, color).fillRect(x + width - 1, y, 1, height, color);
    }
    drawBorder(thickness = 1, color = 1) {
        for (let i = 0; i < thickness; i++)
            this.drawRect(i, i, OLED_WIDTH - 2 * i, OLED_HEIGHT - 2 * i, color);
        return this;
    }
    drawLine(x0, y0, x1, y1, color = 1) {
        x0 = Math.round(x0);
        y0 = Math.round(y0);
        x1 = Math.round(x1);
        y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0);
        const dy = -Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let error = dx + dy;
        for (;;) {
            this.setPixel(x0, y0, color);
            if (x0 === x1 && y0 === y1)
                return this;
            const twice = 2 * error;
            if (twice >= dy) {
                error += dy;
                x0 += sx;
            }
            if (twice <= dx) {
                error += dx;
                y0 += sy;
            }
        }
    }
    drawCircle(cx, cy, radius, color = 1) {
        return this.circle(cx, cy, radius, color, false);
    }
    fillCircle(cx, cy, radius, color = 1) {
        return this.circle(cx, cy, radius, color, true);
    }
    circle(cx, cy, radius, color, fill) {
        let x = Math.round(radius);
        let y = 0;
        let error = 1 - x;
        while (x >= y) {
            if (fill) {
                this.fillRect(cx - x, cy + y, 2 * x + 1, 1, color).fillRect(cx - x, cy - y, 2 * x + 1, 1, color);
                this.fillRect(cx - y, cy + x, 2 * y + 1, 1, color).fillRect(cx - y, cy - x, 2 * y + 1, 1, color);
            }
            else {
                for (const [px, py] of [
                    [x, y],
                    [y, x],
                    [-x, y],
                    [-y, x],
                    [x, -y],
                    [y, -x],
                    [-x, -y],
                    [-y, -x],
                ])
                    this.setPixel(cx + px, cy + py, color);
            }
            y++;
            if (error < 0)
                error += 2 * y + 1;
            else {
                x--;
                error += 2 * (y - x) + 1;
            }
        }
        return this;
    }
    /** Width of one line of text in pixels. Characters the font lacks count as "?". */
    static textWidth(text) {
        let width = 0;
        for (const ch of text)
            width += (FONT[ch] ?? FONT["?"])[0];
        return width;
    }
    /** `text` cut to fit `width` pixels, with "..." when something was cut. */
    static fitText(text, width) {
        const line = text.replace(/\n/g, " ");
        if (width <= 0)
            return "";
        if (Canvas.textWidth(line) <= width)
            return line;
        let suffix = "...";
        while (suffix && Canvas.textWidth(suffix) > width)
            suffix = suffix.slice(0, -1);
        const chars = [...line];
        while (chars.length && Canvas.textWidth(chars.join("") + suffix) > width)
            chars.pop();
        return chars.join("") + suffix;
    }
    /** Draw one line of text with its top-left corner at (x, y). Returns the x after the last character. */
    drawText(text, x, y, color = 1) {
        let at = Math.round(x);
        const top = Math.round(y);
        for (const ch of text) {
            const [advance, rows] = FONT[ch] ?? FONT["?"];
            for (let row = 0; row < rows.length; row++) {
                let bits = rows[row];
                for (let column = 0; bits; column++, bits >>>= 1)
                    if (bits & 1)
                        this.setPixel(at + column, top + row, color);
            }
            at += advance;
        }
        return at;
    }
    /** Text cut to the given width (default: what is left of the screen, less a 2 px margin). */
    drawTextFitted(text, x, y, color = 1, width = OLED_WIDTH - x - 2) {
        const line = Canvas.fitText(text, width);
        if (line)
            this.drawText(line, x, y, color);
        return this;
    }
    drawTextCentered(text, y, color = 1) {
        const line = Canvas.fitText(text, OLED_WIDTH - 4);
        this.drawText(line, (OLED_WIDTH - Canvas.textWidth(line)) / 2, y, color);
        return this;
    }
    /** A title band on top (inverted by default). */
    drawHeader(title, inverted = true) {
        if (inverted)
            this.fillRect(0, 0, OLED_WIDTH, Canvas.HEADER_HEIGHT, 1);
        else
            this.fillRect(0, Canvas.HEADER_HEIGHT - 1, OLED_WIDTH, 1, 1);
        return this.drawTextFitted(title, 3, 2, inverted ? 0 : 1, OLED_WIDTH - 6);
    }
    /** A whole screen: a title and up to four lines of text. */
    drawPage(title, lines, headerInverted = true) {
        this.clear().drawHeader(title, headerInverted);
        lines
            .slice(0, 4)
            .forEach((line, i) => this.drawTextFitted(line, 3, Canvas.CONTENT_START + i * Canvas.LINE_HEIGHT));
        return this;
    }
    /** A whole screen: a title, a label, a value and a bar showing `ratio` (0..1). */
    drawValuePage(title, label, value, ratio) {
        this.clear().drawHeader(title);
        this.drawTextFitted(label, 3, Canvas.CONTENT_START + 2);
        this.drawText(value, OLED_WIDTH - 3 - Canvas.textWidth(value), Canvas.CONTENT_START + 2);
        if (ratio !== undefined) {
            const width = OLED_WIDTH - 6;
            this.drawRect(3, 44, width, 10);
            this.fillRect(5, 46, Math.round((width - 4) * Math.min(1, Math.max(0, ratio))), 6);
        }
        return this;
    }
    /** A whole screen: a title and a scrolling list with one entry highlighted. */
    drawMenu(title, items, selected) {
        this.clear().drawHeader(title);
        const visible = 4;
        const first = Math.min(Math.max(0, selected - visible + 1), Math.max(0, items.length - visible));
        for (let i = 0; i < visible && first + i < items.length; i++) {
            const y = Canvas.CONTENT_START + i * Canvas.LINE_HEIGHT;
            const active = first + i === selected;
            if (active)
                this.fillRect(0, y - 1, OLED_WIDTH, Canvas.LINE_HEIGHT, 1);
            this.drawTextFitted(items[first + i], 3, y, active ? 0 : 1);
        }
        return this;
    }
    /**
     * Copy an image onto the canvas, e.g. `context.getImageData(0, 0, 128, 64)`
     * from a browser canvas. Pixels brighter than `threshold` (0..255) are lit.
     */
    drawImageData(image, threshold = 127) {
        const width = Math.min(OLED_WIDTH, image.width);
        const height = Math.min(OLED_HEIGHT, image.height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const at = (y * image.width + x) * 4;
                const luma = 0.299 * image.data[at] + 0.587 * image.data[at + 1] + 0.114 * image.data[at + 2];
                this.pixels[y * OLED_WIDTH + x] = luma * (image.data[at + 3] / 255) > threshold ? 1 : 0;
            }
        }
        return this;
    }
    /** The canvas as text, one line per pixel row ("#" lit, "." dark). For tests and debugging. */
    toString() {
        const rows = [];
        for (let y = 0; y < OLED_HEIGHT; y++) {
            let row = "";
            for (let x = 0; x < OLED_WIDTH; x++)
                row += this.pixels[y * OLED_WIDTH + x] ? "#" : ".";
            rows.push(row);
        }
        return rows.join("\n");
    }
}
