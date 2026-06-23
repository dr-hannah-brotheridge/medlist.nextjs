/**
 * Generate PWA PNG icons (192, 512, maskable 512) from public/icon.svg.
 * Run: node scripts/generate-pwa-icons.js
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const SOURCE_SVG = path.join(PUBLIC_DIR, "icon.svg");

function maskableSvg(size) {
  // A maskable icon needs its content centered with ~20% safe padding.
  // We render the full logo at 60% scale on a solid brand background.
  const bg = "#237867";
  const inner = size * 0.6;
  const offset = (size - inner) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${bg}" />
  <image href="file://${SOURCE_SVG.replace(/\\/g, "/")}" x="${offset}" y="${offset}" width="${inner}" height="${inner}" />
</svg>`;
}

async function main() {
  if (!fs.existsSync(SOURCE_SVG)) {
    throw new Error(`Source SVG not found at ${SOURCE_SVG}`);
  }

  const svgBuf = fs.readFileSync(SOURCE_SVG);

  // 192
  await sharp(svgBuf, { density: 384 })
    .resize(192, 192)
    .png()
    .toFile(path.join(PUBLIC_DIR, "icon-192.png"));
  console.log("Wrote icon-192.png");

  // 512
  await sharp(svgBuf, { density: 512 })
    .resize(512, 512)
    .png()
    .toFile(path.join(PUBLIC_DIR, "icon-512.png"));
  console.log("Wrote icon-512.png");

  // maskable 512 (padded)
  const maskableBuf = Buffer.from(maskableSvg(512));
  await sharp(maskableBuf, { density: 512 })
    .resize(512, 512)
    .png()
    .toFile(path.join(PUBLIC_DIR, "icon-maskable-512.png"));
  console.log("Wrote icon-maskable-512.png");

  console.log("PWA icon generation complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});