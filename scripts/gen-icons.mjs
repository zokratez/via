import sharp from "sharp";
import { writeFileSync } from "node:fs";

const BG = "#1a1614";
const FG = "#c9966b";

function svgIcon(size) {
  const fontSize = Math.round(size * 0.5);
  const padding = Math.round(size * 0.12);
  const r = Math.round(size * 0.18); // rounded corner radius
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="${BG}"/>
    <text x="50%" y="50%" font-family="Georgia, 'Palatino Linotype', serif"
      font-style="italic" font-weight="500" font-size="${fontSize}"
      fill="${FG}" dominant-baseline="central" text-anchor="middle"
      letter-spacing="-2">pp</text>
  </svg>`;
}

const out = process.argv[2];
const sizes = [192, 512];
for (const s of sizes) {
  const buffer = await sharp(Buffer.from(svgIcon(s))).png().toBuffer();
  writeFileSync(`${out}/icon-${s}.png`, buffer);
  console.log(`wrote icon-${s}.png (${buffer.length} bytes)`);
}

// Also generate apple-touch-icon (180x180 is standard)
{
  const s = 180;
  const buffer = await sharp(Buffer.from(svgIcon(s))).png().toBuffer();
  writeFileSync(`${out}/apple-touch-icon.png`, buffer);
  console.log(`wrote apple-touch-icon.png (${buffer.length} bytes)`);
}
