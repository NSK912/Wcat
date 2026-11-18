import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const sourceImage = 'assets/Wcat seek.png';
const sizes = [16, 24, 32, 48, 64, 128, 256, 512];

async function generate() {
  console.log('Generating icons from:', sourceImage);

  // Ensure directories exist
  fs.mkdirSync('build/icons', { recursive: true });
  fs.mkdirSync('build/appx', { recursive: true });
  fs.mkdirSync('public', { recursive: true });

  // Base 512x512 icon for electron-builder
  await sharp(sourceImage)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile('build/icon.png');

  await sharp(sourceImage)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toFile('public/icon.png');

  // Generate all icon sizes in build/icons/
  for (const size of sizes) {
    const iconPath = path.join('build/icons', `${size}x${size}.png`);
    await sharp(sourceImage)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(iconPath);
    console.log(`Generated: ${iconPath}`);
  }

  // Generate Windows Store / AppX assets in build/appx/
  const appxAssets = [
    { name: 'StoreLogo.png', width: 50, height: 50 },
    { name: 'Square44x44Logo.png', width: 44, height: 44 },
    { name: 'Square150x150Logo.png', width: 150, height: 150 },
    { name: 'Wide310x150Logo.png', width: 310, height: 150 },
    { name: 'SmallTile.png', width: 71, height: 71 },
    { name: 'LargeTile.png', width: 310, height: 310 },
    { name: 'SplashScreen.png', width: 620, height: 300 },
  ];

  for (const asset of appxAssets) {
    const assetPath = path.join('build/appx', asset.name);
    await sharp(sourceImage)
      .resize(asset.width, asset.height, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toFile(assetPath);
    console.log(`Generated AppX asset: ${assetPath} (${asset.width}x${asset.height})`);
  }

  console.log('Icons generated successfully!');
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
