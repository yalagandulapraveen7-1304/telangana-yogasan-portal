const fs = require('fs');
const files = fs.readdirSync('templates').filter(f => f.endsWith('.html'));

files.forEach(f => {
  const content = fs.readFileSync('templates/' + f, 'utf8');
  const alertMatches = [...content.matchAll(/onclick=["']alert\(([^)]*)\)["']/gi)];
  if (alertMatches.length > 0) {
    console.log(`${f}: has ${alertMatches.length} alert click handlers`);
    alertMatches.forEach(m => console.log(`   ${m[0]}`));
  }
});
