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

// 2. Ensure public output directory exists for Vercel & Cloudflare Pages
const publicDir = path.join(root, 'public');
const publicStaticDir = path.join(publicDir, 'static');
const srcStaticDir = path.join(root, 'static');
const srcTemplatesDir = path.join(root, 'templates');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Sync static assets to public/static
if (fs.existsSync(srcStaticDir)) {
  fs.cpSync(srcStaticDir, publicStaticDir, { recursive: true });
}

// Copy HTML templates to public root (for Cloudflare Pages static hosting)
if (fs.existsSync(srcTemplatesDir)) {
  const tplFiles = fs.readdirSync(srcTemplatesDir);
  tplFiles.forEach((file) => {
    if (file.endsWith('.html')) {
      fs.copyFileSync(
        path.join(srcTemplatesDir, file),
        path.join(publicDir, file)
      );
    }
  });
  console.log(`Copied ${tplFiles.length} HTML templates to public/ directory.`);
}

// 3. Create Cloudflare Pages _redirects file for clean URL handling
const redirectsContent = `/index.html / 200
/gallery /gallery.html 200
/login /login.html 200
/nominate /nominate.html 200
/school-nominate /school-nominate.html 200
/admitcard /admitcard.html 200
/dashboard /dashboard.html 200
`;
fs.writeFileSync(path.join(publicDir, '_redirects'), redirectsContent);

// 4. Create Cloudflare Pages _headers file for caching & security
const headersContent = `/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
/static/*
  Cache-Control: public, max-age=2592000, immutable
`;
fs.writeFileSync(path.join(publicDir, '_headers'), headersContent);

fs.writeFileSync(path.join(publicDir, '.gitkeep'), '');

console.log('Build completed successfully: public/ output directory is ready for Vercel & Cloudflare Pages deployment.');
