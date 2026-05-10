import path from "node:path";

import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "frontend", "public", "icons", "icon-512.png");
const resDir = path.join(root, "frontend", "android", "app", "src", "main", "res");

const legacySizes = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192
};

const foregroundSizes = {
  "mipmap-mdpi": 108,
  "mipmap-hdpi": 162,
  "mipmap-xhdpi": 216,
  "mipmap-xxhdpi": 324,
  "mipmap-xxxhdpi": 432
};

async function renderIcon(size, { adaptive = false } = {}) {
  const padding = adaptive ? Math.round(size * 0.2) : Math.round(size * 0.08);
  const innerSize = size - padding * 2;
  const image = await sharp(source).resize(innerSize, innerSize, { fit: "contain" }).png().toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: adaptive ? 0 : 1 }
    }
  })
    .composite([{ input: image, left: padding, top: padding }])
    .png()
    .toBuffer();
}

for (const [folder, size] of Object.entries(legacySizes)) {
  const targetDir = path.join(resDir, folder);
  const icon = await renderIcon(size);
  await sharp(icon).toFile(path.join(targetDir, "ic_launcher.png"));
  await sharp(icon).toFile(path.join(targetDir, "ic_launcher_round.png"));
}

for (const [folder, size] of Object.entries(foregroundSizes)) {
  const targetDir = path.join(resDir, folder);
  const foreground = await renderIcon(size, { adaptive: true });
  await sharp(foreground).toFile(path.join(targetDir, "ic_launcher_foreground.png"));
}

console.log("Android launcher icons generated from frontend/public/icons/icon-512.png");
