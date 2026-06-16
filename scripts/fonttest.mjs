import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import fs from "node:fs";
async function render(file, fam, out) {
  const data = fs.readFileSync(`public/fonts/${file}`);
  const svg = await satori(
    { type: "div", props: { style: { width: 500, height: 200, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: fam, fontSize: 60, color: "#000" }, children: "행복한 하루" } },
    { width: 500, height: 200, fonts: [{ name: fam, data, weight: 400, style: "normal" }] }
  );
  fs.writeFileSync(out, new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng());
  console.log(out, "ok", data.length, "bytes");
}
await render("Jua-Regular.ttf", "cf_jua", "/tmp/t-jua.png");
await render("NanumMyeongjo-Regular.ttf", "cf_myeongjo", "/tmp/t-myeongjo.png");
await render("BlackHanSans-Regular.ttf", "cf_blackhan", "/tmp/t-blackhan.png");
