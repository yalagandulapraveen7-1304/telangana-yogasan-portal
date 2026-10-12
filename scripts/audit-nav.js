const fs = require('fs');
const files = fs.readdirSync('templates').filter(f => f.endsWith('.html'));

files.forEach(f => {
  const content = fs.readFileSync('templates/' + f, 'utf8');
  const btnM = content.match(/<button[^>]*id=["']nav-toggle["'][^>]*>/i);
  const menuM = content.match(/id=["']nav-menu["']/i);
  const scriptM = content.match(/nav-toggle/i);
  console.log(`${f}: nav-toggle=${btnM ? 'YES' : 'NO'}, nav-menu=${menuM ? 'YES' : 'NO'}`);
});
