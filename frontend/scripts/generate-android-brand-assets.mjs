import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(scriptDir, "..");
const iconPath = path.join(frontendDir, "public", "icons", "icon-512.png");
const resDir = path.join(frontendDir, "android", "app", "src", "main", "res");

const launcherSizes = {
  mdpi: 48,
  hdpi: 72,
  xhdpi: 96,
  xxhdpi: 144,
  xxxhdpi: 192
};

async function writeLauncherIcon(dir, name, size, scale) {
  fs.mkdirSync(dir, { recursive: true });
  const logo = await sharp(iconPath)
    .resize(Math.round(size * scale), Math.round(size * scale), { fit: "contain" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(path.join(dir, name));
}

async function writeSplash(file) {
  const metadata = await sharp(file).metadata();
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) return;

  const logoSize = Math.round(Math.min(width, height) * 0.3);
  const captionWidth = Math.round(width * 0.68);
  const captionHeight = Math.max(28, Math.round(height * 0.055));
  const captionFontSize = Math.max(14, Math.round(Math.min(width, height) * 0.035));
  const captionBottom = Math.max(32, Math.round(height * 0.075));
  const logo = await sharp(iconPath)
    .resize(logoSize, logoSize, { fit: "contain" })
    .png()
    .toBuffer();
  const caption = Buffer.from(`
    <svg width="${captionWidth}" height="${captionHeight}" viewBox="0 0 ${captionWidth} ${captionHeight}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="50%"
        y="50%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${captionFontSize}"
        font-weight="600"
        letter-spacing="0.08em"
        fill="#8b7355"
      >from VolcanoTech</text>
    </svg>
  `);

  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#fffdf8"
    }
  })
    .composite([
      { input: logo, gravity: "center" },
      { input: caption, left: Math.round((width - captionWidth) / 2), top: height - captionBottom - captionHeight }
    ])
    .png()
    .toFile(file);
}

function collectSplashFiles(dir, result = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) collectSplashFiles(fullPath, result);
    if (entry.isFile() && entry.name === "splash.png") result.push(fullPath);
  }
  return result;
}

for (const [density, size] of Object.entries(launcherSizes)) {
  const dir = path.join(resDir, `mipmap-${density}`);
  await writeLauncherIcon(dir, "ic_launcher.png", size, 0.86);
  await writeLauncherIcon(dir, "ic_launcher_round.png", size, 0.86);
  await writeLauncherIcon(dir, "ic_launcher_foreground.png", size, 0.72);
}

const splashFiles = collectSplashFiles(resDir);
for (const file of splashFiles) {
  await writeSplash(file);
}

console.log(`Generated ${Object.keys(launcherSizes).length * 3} launcher assets and ${splashFiles.length} splash assets.`);
