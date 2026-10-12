const fs = require('fs');
const files = fs.readdirSync('templates').filter(f => f.endsWith('.html'));

files.forEach(f => {
  const content = fs.readFileSync('templates/' + f, 'utf8');
  const telLinks = content.match(/href=["']tel:[^"']*["']/g);
  const rawPhones = content.match(/(?:\+91[\s-]?)?[6-9]\d{9}/g);
  const mailLinks = content.match(/href=["']mailto:[^"']*["']/g);
  const rawEmails = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);

  console.log(`[${f}]`);
  if (rawPhones) {
    const unlinkedPhones = rawPhones.filter(p => !content.includes(`href="tel:${p.replace(/\s+/g, '')}"`) && !content.includes(`href='tel:${p.replace(/\s+/g, '')}'`));
    console.log(`  Phones: total ${rawPhones.length}, tel: links ${telLinks ? telLinks.length : 0}`);
  }
  if (rawEmails) {
    console.log(`  Emails: total ${rawEmails.length}, mailto: links ${mailLinks ? mailLinks.length : 0}`);
  }
});
