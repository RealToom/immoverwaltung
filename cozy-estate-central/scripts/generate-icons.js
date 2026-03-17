import sharp from "sharp";
import { readFileSync, mkdirSync } from "fs";

const svg = readFileSync("public/icons/icon.svg");
const outDir = "public/icons";
mkdirSync(outDir, { recursive: true });

const sizes = [
  { file: "icon-32.png", size: 32, maskable: false },
  { file: "icon-180.png", size: 180, maskable: false },
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  // Maskable: 20% padding per side (Safe Zone für adaptive Icons auf Android 13+)
  { file: "icon-192-maskable.png", size: 192, maskable: true },
  { file: "icon-512-maskable.png", size: 512, maskable: true },
];

for (const { file, size, maskable } of sizes) {
  const padding = maskable ? Math.round(size * 0.2) : 0;
  const innerSize = size - padding * 2;

  await sharp(svg)
    .resize(innerSize, innerSize)
    .extend({
      top: padding, bottom: padding, left: padding, right: padding,
      background: { r: 15, g: 23, b: 42, alpha: 1 }, // #0f172a
    })
    .png()
    .toFile(`${outDir}/${file}`);

  console.log(`✓ ${file} (${size}×${size}${maskable ? ", maskable" : ""})`);
}
console.log("Icons generated.");
