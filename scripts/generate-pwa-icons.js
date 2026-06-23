/**
 * Generate PWA PNG icons (192, 512, maskable 512) from public/icon.svg.
 * Run: node scripts/generate-pwa-icons.js
 *
 * Note: requires `sharp` to be installed (npm install sharp --no-save).
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const SOURCE_SVG = path.join(PUBLIC_DIR, "icon.svg");

/**
 * Build a self-contained maskable SVG. The original icon.svg content is
 * inlined (not referenced via <image href>) so sharp/librsvg can rasterize
 * it reliably on Windows. The logo is scaled to 60% and centered on a solid
 * brand background with safe padding.
 */
function buildMaskableSvg(originalSvg, size) {
  const bg = "#237867";

  // Extract the inner content of the source <svg> (everything between the
  // opening <g> and closing </g>, i.e. the clipboard drawing).
  const innerMatch = originalSvg.match(/<g filter="url\(#dropShadow\)">([\s\S]*)<\/g>/);
  const inner = innerMatch ? innerMatch[1] : "";
  const defsMatch = originalSvg.match(/<defs>([\s\S]*)<\/defs>/);
  const defs = defsMatch ? defsMatch[1] : "";

  // The source coordinates are in an 800x800 space. Scale to 60% and center.
  const innerSize = size * 0.6;
  const offset = (size - innerSize) / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${defs}</defs>
  <rect width="${size}" height="${size}" fill="${bg}" />
  <g transform="translate(${offset}, ${offset}) scale(${(innerSize / 800).toFixed(6)})">
    <rect x="0" y="0" width="800" height="800" fill="url(#bgGrad)" />
    ${inner}
  </g>
</svg>`;
}

async function main() {
  if (!fs.existsSync(SOURCE_SVG)) {
    throw new Error(`Source SVG not found at ${SOURCE_SVG}`);
  }

  const svgContent = fs.readFileSync(SOURCE_SVG, "utf8");
  const svgBuf = Buffer.from(svgContent, "utf8");

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

  // maskable 512 (self-contained, inlined)
  const maskableSvg = buildMaskableSvg(svgContent, 512);
  const maskableBuf = Buffer.from(maskableSvg, "utf8");
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