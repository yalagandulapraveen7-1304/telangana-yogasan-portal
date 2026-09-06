const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// 1. Build CSS
try {
  console.log('Compiling Tailwind CSS...');
  execSync('npx @tailwindcss/cli -i ./static/css/input.css -o ./static/css/output.css --minify', {
    cwd: root,
    stdio: 'inherit'
  });
} catch (e) {
  console.warn('Tailwind build fallback, using precompiled CSS:', e.message);
}

// 2. Ensure public/static directory exists and is populated for Vercel Output Directory
const publicDir = path.join(root, 'public');
const publicStaticDir = path.join(publicDir, 'static');
const srcStaticDir = path.join(root, 'static');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

if (fs.existsSync(srcStaticDir)) {
  fs.cpSync(srcStaticDir, publicStaticDir, { recursive: true });
}

// Create a fallback index marker in public
fs.writeFileSync(path.join(publicDir, '.gitkeep'), '');

console.log('Build completed successfully: public/ output directory is ready for Vercel deployment.');
