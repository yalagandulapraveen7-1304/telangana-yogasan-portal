const fs = require('fs');
const path = require('path');

const files = fs.readdirSync('templates').filter(f => f.endsWith('.html'));

files.forEach(f => {
  const content = fs.readFileSync(path.join('templates', f), 'utf8');
  const titleM = content.match(/<title>([^<]*)<\/title>/i);
  const metaDescM = content.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  const faviconM = content.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*>/i);
  const robotsM = content.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i);
  const yearM = content.match(/202[0-9]/g);
  
  console.log(`[${f}]`);
  console.log(`  Title: ${titleM ? titleM[1].trim() : 'MISSING'}`);
  console.log(`  Desc:  ${metaDescM ? metaDescM[1].trim() : 'MISSING'}`);
  console.log(`  Favicon: ${faviconM ? 'PRESENT' : 'MISSING'}`);
  console.log(`  Robots: ${robotsM ? robotsM[1] : 'NONE'}`);
});
