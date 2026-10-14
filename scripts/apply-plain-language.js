/**
 * Plain Language Transformer for Telangana Yoga Portal
 * Rewrites user-facing copy into clear, simple, everyday language
 * following the government & accessibility plain-writing standard.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

function updateFile(relativePath, replacements) {
  const fullPath = path.join(ROOT_DIR, relativePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`File not found: ${fullPath}`);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  let count = 0;
  replacements.forEach(([target, replacement]) => {
    if (content.includes(target)) {
      content = content.replaceAll(target, replacement);
      count++;
    } else {
      console.warn(`[WARN] Target not found in ${relativePath}: ${target.substring(0, 50)}...`);
    }
  });
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`[OK] Updated ${relativePath} with ${count} replacements.`);
}

// School Nomination Form updates
updateFile('templates/school-nominate.html', [
  [
    'Student Athletes Delegation Roster',
    'Student athlete list'
  ],
  [
    'Add all students representing your institution with verified DOB and photo proofs.',
    'Add each student representing your school with their date of birth and photo.'
  ],
  [
    'Delegation Summary &amp; Fee Estimation',
    'Team summary and total fee'
  ],
  [
    'Real-time breakdown of athletes and registered disciplines (₹260/event).',
    'Summary of registered athletes and events (₹260 per event).'
  ],
  [
    'Submit School Delegation &amp; Generate Admit Cards',
    'Submit team registration'
  ],
  [
    'Registering Delegation...',
    'Registering student team...'
  ],
  [
    'Please accept the Institutional Certification declaration checkbox before submitting.',
    'Please check the declaration box to confirm your school details before submitting.'
  ],
  [
    "Failed to submit school nomination. Please verify all fields.",
    "We could not submit your team registration. Please check all fields and try again."
  ],
  [
    'Cancel &amp; Return Home',
    'Cancel'
  ]
]);

console.log('Plain language pass completed.');
