const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('templates').filter(f => f.endsWith('.html'));
const internalLinks = new Map();
const externalLinks = new Map();
const hashLinks = [];

files.forEach(f => {
  const content = fs.readFileSync(path.join('templates', f), 'utf8');
  const matches = [...content.matchAll(/href=["']([^"']*)["']/g)];
  matches.forEach(m => {
    const raw = m[1].trim();
    if (!raw) return;
    if (raw === '#') {
      hashLinks.push({ file: f, link: raw });
    } else if (raw.startsWith('http://') || raw.startsWith('https://')) {
      if (!externalLinks.has(raw)) externalLinks.set(raw, []);
      externalLinks.get(raw).push(f);
    } else if (raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) {
      // scheme
    } else {
      if (!internalLinks.has(raw)) internalLinks.set(raw, []);
      internalLinks.get(raw).push(f);
    }
  });
});

console.log('--- INTERNAL LINKS ---');
for (const [link, sources] of internalLinks.entries()) {
  console.log(`${link}  (used in: ${sources.slice(0, 3).join(', ')}${sources.length > 3 ? '...' : ''})`);
}

console.log('\n--- HASH ONLY LINKS (#) ---');
console.log(`Count: ${hashLinks.length}`);
hashLinks.slice(0, 10).forEach(h => console.log(`  ${h.file}: ${h.link}`));

console.log('\n--- EXTERNAL LINKS ---');
for (const [link, sources] of externalLinks.entries()) {
  console.log(`${link}  (used in: ${sources.slice(0, 3).join(', ')})`);
}
