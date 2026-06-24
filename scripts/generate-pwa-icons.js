/**
 * Generate PWA PNG icons (192, 512, maskable 512) from public/icon-source.png.
 * Run: node scripts/generate-pwa-icons.js
 *
 * Note: requires `sharp` to be installed (npm install sharp --no-save).
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const SOURCE_PNG = path.join(PUBLIC_DIR, "icon-source.png");
const BRAND_BG = { r: 35, g: 120, b: 103, alpha: 1 }; // #237867

/**
 * Build a maskable icon: the source logo scaled to ~60% of the canvas and
 * centered on a solid brand background, leaving a safe zone for Android.
 */
async function buildMaskable(size) {
  const innerSize = Math.round(size * 0.6);
  const offset = Math.round((size - innerSize) / 2);

  // Resize the source to the inner size (cover).
  const logo = await sharp(SOURCE_PNG)
    .resize(innerSize, innerSize, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();

  // Composite onto a solid brand background.
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_BG,
    },
  })
    .composite([
      { input: logo, left: offset, top: offset },
    ])
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SOURCE_PNG)) {
    throw new Error(`Source PNG not found at ${SOURCE_PNG}`);
  }

  const sourceBuf = fs.readFileSync(SOURCE_PNG);

  // 192
  await sharp(sourceBuf)
    .resize(192, 192, { fit: "cover", position: "centre" })
    .png()
    .toFile(path.join(PUBLIC_DIR, "icon-192.png"));
  console.log("Wrote icon-192.png");

  // 512
  await sharp(sourceBuf)
    .resize(512, 512, { fit: "cover", position: "centre" })
    .png()
    .toFile(path.join(PUBLIC_DIR, "icon-512.png"));
  console.log("Wrote icon-512.png");

  // maskable 512
  const maskableBuf = await buildMaskable(512);
  await sharp(maskableBuf)
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