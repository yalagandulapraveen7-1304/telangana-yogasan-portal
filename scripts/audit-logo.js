const fs = require('fs');
const files = fs.readdirSync('templates').filter(f => f.endsWith('.html'));

files.forEach(f => {
  const content = fs.readFileSync('templates/' + f, 'utf8');
  const headerIdx = content.indexOf('<header');
  if (headerIdx === -1) {
    console.log(`${f}: NO HEADER`);
    return;
  }
  const headerEnd = content.indexOf('</header>', headerIdx);
  const headerHtml = content.substring(headerIdx, headerEnd);
  const hasLogoImg = headerHtml.includes('TSYSC.png');
  const hasLogoLink = /<a[^>]*href=["'](?:\/|\/index|\/index\.html)["'][^>]*>[\s\S]*?TSYSC\.png/i.test(headerHtml) ||
                      /<a[^>]*href=["'](?:\/|\/index|\/index\.html)["'][^>]*>[\s\S]*?<img/i.test(headerHtml);
  console.log(`${f}: header logo clickable = ${hasLogoLink ? 'YES' : 'NO'} (hasLogoImg=${hasLogoImg})`);
});
