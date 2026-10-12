const fs = require('fs');
const files = ['about.html', 'activities.html', 'contact.html', 'districts.html', 'downloads.html', 'events.html', 'help.html', 'membership.html', 'privacy-policy.html', 'results.html'];
const target = 'Email: <span class="text-amber-300">contact@telanganayoga.org.in</span>';
const replacement = 'Email: <a href="mailto:contact@telanganayoga.org.in" class="text-amber-300 hover:underline">contact@telanganayoga.org.in</a>';

files.forEach(f => {
  const p = 'templates/' + f;
  let text = fs.readFileSync(p, 'utf8');
  if (text.includes(target)) {
    text = text.replace(target, replacement);
    fs.writeFileSync(p, text, 'utf8');
    console.log('Updated footer email in ' + f);
  }
});
