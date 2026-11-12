import { AkaiFire, Button, Led, type FireEvent } from "../src/index.js";

const $ = (id: string) => document.getElementById(id)!;
const log = $("log");
let fire: AkaiFire | null = null;

function describe(e: FireEvent): string {
  switch (e.type) {
    case "pad":
      return `pad ${e.pad} (row ${e.row}, column ${e.column}) ${e.pressed ? `pressed, velocity ${e.velocity}` : "released"}`;
    case "button":
      return `button ${e.button} ${e.pressed ? "pressed" : "released"}`;
    case "encoder":
      return `encoder ${e.encoder} turned ${e.delta > 0 ? "+" : ""}${e.delta}`;
    case "touch":
      return `encoder ${e.encoder} ${e.touched ? "touched" : "let go"}`;
  }
}

$("connect").addEventListener("click", async () => {
  try {
    fire?.close();
    fire = await AkaiFire.connect();
  } catch (error) {
    $("status").textContent = String((error as Error).message ?? error);
    return;
  }
  $("status").textContent = "Connected";
  ($("clear") as HTMLButtonElement).disabled = false;
  fire.clearAll();
  fire.setButtonLed(Button.Play, Led.DimPrimary);
  fire.canvas.drawPage("akaifire", ["Press a pad,", "turn a knob."]);
  fire.render();

  fire.on("pad", (e) => {
    const level = Math.round(e.velocity * 0.9);
    fire!.setPadColor(e.pad, e.pressed ? level : 0, e.pressed ? 20 : 0, e.pressed ? 127 - level : 8);
  });
  fire.on("input", (e) => {
    const line = `${e.shift ? "SHIFT " : ""}${e.alt ? "ALT " : ""}${describe(e)}`;
    log.textContent = `${line}\n${log.textContent}`.slice(0, 4000);
    fire!.canvas.drawPage("Last event", [line.slice(0, 22), line.slice(22, 44)]);
    fire!.render();
  });
});

$("clear").addEventListener("click", () => fire?.clearPads());
addEventListener("pagehide", () => fire?.close());
