const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const galleryDir = path.join(root, 'static', 'images', 'gallery');

async function convertImages() {
  const files = fs.readdirSync(galleryDir).filter(f => f.match(/\.(jpg|jpeg|png)$/i));
  console.log(`Found ${files.length} gallery images to convert to WebP...`);

  let totalOriginalBytes = 0;
  let totalWebpBytes = 0;
  let convertedCount = 0;

  for (const file of files) {
    const inputPath = path.join(galleryDir, file);
    const baseName = path.parse(file).name;
    const outputPath = path.join(galleryDir, `${baseName}.webp`);

    const stat = fs.statSync(inputPath);
    totalOriginalBytes += stat.size;

    // Convert to webp with high visual quality (quality: 80, effort: 4)
    await sharp(inputPath)
      .webp({ quality: 80, effort: 4 })
      .toFile(outputPath);

    const outStat = fs.statSync(outputPath);
    totalWebpBytes += outStat.size;
    convertedCount++;

    const savedPercent = (((stat.size - outStat.size) / stat.size) * 100).toFixed(1);
    console.log(`Converted: ${file} (${(stat.size / 1024).toFixed(1)} KB) -> ${baseName}.webp (${(outStat.size / 1024).toFixed(1)} KB, -${savedPercent}%)`);
  }

  // Also verify yoga-tree.jpg -> yoga-tree.webp in static/images
  const yogaTreeJpg = path.join(root, 'static', 'images', 'yoga-tree.jpg');
  const yogaTreeWebp = path.join(root, 'static', 'images', 'yoga-tree.webp');
  if (fs.existsSync(yogaTreeJpg)) {
    const origTree = fs.statSync(yogaTreeJpg).size;
    await sharp(yogaTreeJpg).webp({ quality: 82 }).toFile(yogaTreeWebp);
    const newTree = fs.statSync(yogaTreeWebp).size;
    console.log(`Converted yoga-tree.jpg (${(origTree / 1024).toFixed(1)} KB) -> yoga-tree.webp (${(newTree / 1024).toFixed(1)} KB)`);
  }

  console.log('\n--- WebP Conversion Summary ---');
  console.log(`Total images converted: ${convertedCount}`);
  console.log(`Original total size: ${(totalOriginalBytes / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`WebP total size: ${(totalWebpBytes / (1024 * 1024)).toFixed(2)} MB`);
  const totalSaved = totalOriginalBytes - totalWebpBytes;
  console.log(`Saved: ${(totalSaved / (1024 * 1024)).toFixed(2)} MB (-${(((totalSaved) / totalOriginalBytes) * 100).toFixed(1)}%)`);
}

convertImages().catch(err => {
  console.error('Error during WebP conversion:', err);
  process.exit(1);
});
