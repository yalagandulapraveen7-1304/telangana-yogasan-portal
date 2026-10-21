const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const siteUrl = (process.env.SITE_URL || 'https://telanganayoga.org.in').replace(/\/+$/, '');

// Canonical public indexable routes mapped to their template source file
const publicRoutes = [
  { path: '/', template: 'index.html', priority: '1.0', changefreq: 'weekly' },
  { path: '/about', template: 'about.html', priority: '0.8', changefreq: 'monthly' },
  { path: '/activities', template: 'activities.html', priority: '0.8', changefreq: 'monthly' },
  { path: '/events', template: 'events.html', priority: '0.9', changefreq: 'weekly' },
  { path: '/districts', template: 'districts.html', priority: '0.8', changefreq: 'monthly' },
  { path: '/membership', template: 'membership.html', priority: '0.7', changefreq: 'monthly' },
  { path: '/results', template: 'results.html', priority: '0.8', changefreq: 'weekly' },
  { path: '/downloads', template: 'downloads.html', priority: '0.8', changefreq: 'weekly' },
  { path: '/gallery', template: 'gallery.html', priority: '0.7', changefreq: 'monthly' },
  { path: '/help', template: 'help.html', priority: '0.8', changefreq: 'monthly' },
  { path: '/contact', template: 'contact.html', priority: '0.7', changefreq: 'monthly' },
  { path: '/privacy-policy', template: 'privacy-policy.html', priority: '0.5', changefreq: 'yearly' },
  { path: '/terms', template: 'terms.html', priority: '0.5', changefreq: 'yearly' },
  { path: '/nominate', template: 'nominate.html', priority: '0.9', changefreq: 'weekly' },
  { path: '/school-nominate', template: 'school-nominate.html', priority: '0.9', changefreq: 'weekly' },
  { path: '/admitcard', template: 'admitcard.html', priority: '0.8', changefreq: 'weekly' }
];

function generateSitemap() {
  const templatesDir = path.join(root, 'templates');
  const urlsXml = publicRoutes.map(route => {
    const tplPath = path.join(templatesDir, route.template);
    let lastmod = '';
    if (fs.existsSync(tplPath)) {
      const stat = fs.statSync(tplPath);
      lastmod = `\n    <lastmod>${stat.mtime.toISOString().split('T')[0]}</lastmod>`;
    }
    const loc = route.path === '/' ? `${siteUrl}/` : `${siteUrl}${route.path}`;
    return `  <url>
    <loc>${loc}</loc>${lastmod}
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`;
  }).join('\n');

  const sitemapContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>
`;
  return sitemapContent;
}

function generateRobotsTxt() {
  return `# https://www.robotstxt.org/robotstxt.html
User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /uploads/
Disallow: /auth/
Disallow: /portal/

Sitemap: ${siteUrl}/sitemap.xml
`;
}

function generateLlmsTxt() {
  return `# Telangana Yoga Association — Official Championship & Sports Portal

> Official state sports portal of the Telangana Yoga Association, affiliated with the Yoga Federation of India (YFI) and operating in coordination with the Sports Authority of Telangana State (SATS).

## Organization Overview
The Telangana Yoga Association governs competitive Yogasana sports across all 33 districts of Telangana, conducting district selection trials, state championships, coach accreditation clinics, and national contingent selections.

## Key Championship Information
- Event: 13th Telangana State Inter-District Yogasana Sports Championship
- Age Divisions:
  - Sub-Junior: Ages 8 to under 14 (Sub-Groups: 08–10 Yrs, 10–14 Yrs)
  - Junior: Ages 14 to under 18 (14–18 Yrs)
  - Senior: Ages 18 and above (18–25 Yrs, 25–35 Yrs, Above 35 Yrs)
- Age Calculation Reference Date: December 31st of the competition year
- Entry Fee: Flat ₹260 per competitive discipline event (no hidden fees)
- Primary Disciplines: Traditional Yogasana, Artistic Yogasana (Single & Pair), Rhythmic Yogasana (Pair & Free Flow)

## Public Pages & Resources
- Homepage: ${siteUrl}/
- About the Association: ${siteUrl}/about
- Yogasana Activities & Syllabi: ${siteUrl}/activities
- Events & Championships: ${siteUrl}/events
- District Association Directory: ${siteUrl}/districts
- Membership & Affiliation Programs: ${siteUrl}/membership
- Results & Records: ${siteUrl}/results
- Downloads, Rules & Circulars: ${siteUrl}/downloads
- Photo Gallery: ${siteUrl}/gallery
- Help & Frequently Asked Questions: ${siteUrl}/help
- Athlete Registration: ${siteUrl}/nominate
- School & Institutional Delegations: ${siteUrl}/school-nominate
- Admit Card (Hall Ticket) Verification: ${siteUrl}/admitcard
- Contact & Secretariat Helpdesk: ${siteUrl}/contact
- Privacy Policy & DPDP Data Protection: ${siteUrl}/privacy-policy
- Terms & Conditions: ${siteUrl}/terms

## Contact Information
- Secretariat: State Sports Secretariat, Hyderabad, Telangana – 500001
- Email: contact@telanganayoga.org.in / privacy@telanganayoga.org.in
- Official Communications: contact@telanganayoga.org.in / secretary@telanganayoga.org.in
`;
}

// Write to public/ directory
const publicDir = path.join(root, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), generateSitemap(), 'utf8');
fs.writeFileSync(path.join(publicDir, 'robots.txt'), generateRobotsTxt(), 'utf8');
fs.writeFileSync(path.join(publicDir, 'llms.txt'), generateLlmsTxt(), 'utf8');

console.log('Successfully generated public/sitemap.xml, public/robots.txt, and public/llms.txt');

module.exports = { generateSitemap, generateRobotsTxt, generateLlmsTxt, siteUrl, publicRoutes };
