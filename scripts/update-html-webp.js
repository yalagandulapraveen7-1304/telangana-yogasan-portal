const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// 1. Update gallery.html
const galleryPath = path.join(root, 'templates', 'gallery.html');
let galleryHtml = fs.readFileSync(galleryPath, 'utf8');

const galleryUpdated = galleryHtml.replace(
  /<img\s+src="(\/static\/images\/gallery\/([^"/]+)\.jpg)"([\s\S]*?)class="([^"]*)"\s*\/>/g,
  (match, src, base, rest, cls) => {
    return `<picture class="w-full h-full block">
                <source srcset="/static/images/gallery/${base}.webp" type="image/webp" />
                <img
                  src="${src}"${rest}class="${cls}"
                />
              </picture>`;
  }
);

if (galleryUpdated !== galleryHtml) {
  fs.writeFileSync(galleryPath, galleryUpdated, 'utf8');
  console.log('gallery.html successfully updated with <picture> WebP wrappers.');
} else {
  console.log('No matches updated in gallery.html.');
}

// 2. Update index.html
const indexPath = path.join(root, 'templates', 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// Update yoga-tree.jpg to yoga-tree.webp in inline style
indexHtml = indexHtml.replace('/static/images/yoga-tree.jpg', '/static/images/yoga-tree.webp');

// Update gallery images in index.html
const indexUpdated = indexHtml.replace(
  /<img\s+src="(\/static\/images\/gallery\/([^"/]+)\.jpg)"([\s\S]*?)class="([^"]*)"\s*\/>/g,
  (match, src, base, rest, cls) => {
    return `<picture class="w-full h-full block">
                    <source srcset="/static/images/gallery/${base}.webp" type="image/webp" />
                    <img
                      src="${src}"${rest}class="${cls}"
                    />
                  </picture>`;
  }
);

if (indexUpdated !== indexHtml) {
  fs.writeFileSync(indexPath, indexUpdated, 'utf8');
  console.log('index.html successfully updated with WebP references and picture wrappers.');
} else {
  console.log('No gallery image matches in index.html.');
}
