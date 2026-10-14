const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const TEMPLATES_DIR = path.join(ROOT_DIR, 'templates');
const SITE_URL = 'https://telanganayoga.org.in';

describe('Production Readiness: 10 Core Deliverables Verification', () => {

  describe('1. sitemap.xml', () => {
    it('verifies public/sitemap.xml is valid, formatted properly, and contains only indexable URLs', () => {
      const sitemapPath = path.join(PUBLIC_DIR, 'sitemap.xml');
      assert.ok(fs.existsSync(sitemapPath), 'sitemap.xml must exist in public/');

      const xml = fs.readFileSync(sitemapPath, 'utf8');
      assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'sitemap must start with XML declaration');
      assert.ok(xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), 'sitemap must have valid urlset');

      // Check URLs
      const urlMatches = xml.match(/<loc>(https?:\/\/[^<]+)<\/loc>/g) || [];
      assert.ok(urlMatches.length >= 16, `sitemap should contain at least 16 canonical URLs (found ${urlMatches.length})`);

      // Verify no private or error pages
      assert.ok(!xml.includes('/login'), 'sitemap must exclude /login');
      assert.ok(!xml.includes('/dashboard'), 'sitemap must exclude /dashboard');
      assert.ok(!xml.includes('/404'), 'sitemap must exclude /404');
      assert.ok(!xml.includes('.html'), 'sitemap must use clean extensionless canonical paths');

      // Verify lastmod tags are present
      assert.ok(xml.includes('<lastmod>'), 'sitemap must include actual modification dates');
    });
  });

  describe('2. robots.txt', () => {
    it('verifies public/robots.txt allows public paths and disallows private/auth directories', () => {
      const robotsPath = path.join(PUBLIC_DIR, 'robots.txt');
      assert.ok(fs.existsSync(robotsPath), 'robots.txt must exist in public/');

      const txt = fs.readFileSync(robotsPath, 'utf8');
      assert.ok(txt.includes('User-agent: *'), 'robots.txt must target User-agent: *');
      assert.ok(txt.includes('Allow: /'), 'robots.txt must allow public content');
      assert.ok(txt.includes('Disallow: /dashboard'), 'robots.txt must disallow /dashboard');
      assert.ok(txt.includes('Disallow: /uploads/'), 'robots.txt must disallow /uploads/');
      assert.ok(txt.includes('Disallow: /auth/'), 'robots.txt must disallow /auth/');
      assert.ok(txt.includes(`Sitemap: ${SITE_URL}/sitemap.xml`), 'robots.txt must link to canonical sitemap.xml');
    });
  });

  describe('3. Canonical Tags', () => {
    it('verifies each public page has a single absolute canonical URL and private pages are noindex', () => {
      const publicPages = [
        { file: 'index.html', canonical: `${SITE_URL}/` },
        { file: 'about.html', canonical: `${SITE_URL}/about` },
        { file: 'activities.html', canonical: `${SITE_URL}/activities` },
        { file: 'events.html', canonical: `${SITE_URL}/events` },
        { file: 'districts.html', canonical: `${SITE_URL}/districts` },
        { file: 'membership.html', canonical: `${SITE_URL}/membership` },
        { file: 'results.html', canonical: `${SITE_URL}/results` },
        { file: 'downloads.html', canonical: `${SITE_URL}/downloads` },
        { file: 'gallery.html', canonical: `${SITE_URL}/gallery` },
        { file: 'help.html', canonical: `${SITE_URL}/help` },
        { file: 'contact.html', canonical: `${SITE_URL}/contact` },
        { file: 'privacy-policy.html', canonical: `${SITE_URL}/privacy-policy` },
        { file: 'terms.html', canonical: `${SITE_URL}/terms` },
        { file: 'nominate.html', canonical: `${SITE_URL}/nominate` },
        { file: 'school-nominate.html', canonical: `${SITE_URL}/school-nominate` },
        { file: 'admitcard.html', canonical: `${SITE_URL}/admitcard` }
      ];

      publicPages.forEach(({ file, canonical }) => {
        const html = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf8');
        const matches = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']\s*\/?>/gi) || [];
        assert.equal(matches.length, 1, `${file} must contain exactly one canonical tag`);
        assert.ok(matches[0].includes(`href="${canonical}"`), `${file} canonical must be ${canonical}`);
      });

      // Verify noindex on private pages
      ['login.html', 'dashboard.html', '404.html'].forEach(file => {
        const html = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf8');
        assert.ok(html.includes('content="noindex, nofollow"'), `${file} must have noindex, nofollow meta tag`);
      });
    });
  });

  describe('4. Structured Data: SportsOrganization & SportsEvent', () => {
    it('verifies valid SportsOrganization JSON-LD schema on index.html', () => {
      const html = fs.readFileSync(path.join(TEMPLATES_DIR, 'index.html'), 'utf8');
      const jsonLdBlocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];
      assert.ok(jsonLdBlocks.length > 0, 'index.html must have JSON-LD script blocks');

      let foundOrg = false;
      jsonLdBlocks.forEach(block => {
        const content = block.replace(/<\/?script[^>]*>/gi, '');
        const data = JSON.parse(content);
        if (data['@type'] === 'SportsOrganization') {
          foundOrg = true;
          assert.equal(data.name, 'Telangana Yoga Association');
          assert.equal(data.url, `${SITE_URL}/`);
          assert.equal(data.sport, 'Yogasana Sports');
        }
      });
      assert.ok(foundOrg, 'index.html must emit valid SportsOrganization schema');
    });

    it('verifies valid SportsEvent JSON-LD schema on events.html', () => {
      const html = fs.readFileSync(path.join(TEMPLATES_DIR, 'events.html'), 'utf8');
      const jsonLdBlocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];

      let foundEvent = false;
      jsonLdBlocks.forEach(block => {
        const content = block.replace(/<\/?script[^>]*>/gi, '');
        const data = JSON.parse(content);
        if (data['@type'] === 'SportsEvent') {
          foundEvent = true;
          assert.ok(data.name.includes('Telangana State Inter-District Yogasana Sports Championship'));
          assert.equal(data.offers.price, '260');
          assert.equal(data.offers.priceCurrency, 'INR');
        }
      });
      assert.ok(foundEvent, 'events.html must emit valid SportsEvent schema');
    });
  });

  describe('5. Data Deletion Procedure: DPDP Act', () => {
    it('verifies privacy-policy.html defines section 5.1 with explicit data erasure procedure and monitored email', () => {
      const html = fs.readFileSync(path.join(TEMPLATES_DIR, 'privacy-policy.html'), 'utf8');
      assert.ok(html.includes('id="data-deletion"'), 'privacy-policy.html must have #data-deletion anchor');
      assert.ok(html.includes('Digital Personal Data Protection (DPDP) Act, 2023'), 'must reference DPDP Act');
      assert.ok(html.includes('privacy@telanganayoga.org.in'), 'must reference privacy officer email');
      assert.ok(html.includes('Retention Exceptions'), 'must document retention exceptions for championship records');
    });
  });

  describe('6. Cookies & Browser Storage Disclosure', () => {
    it('verifies privacy-policy.html defines section 5.2 inventorying auth_token, localStorage, and functional storage', () => {
      const html = fs.readFileSync(path.join(TEMPLATES_DIR, 'privacy-policy.html'), 'utf8');
      assert.ok(html.includes('id="cookies-policy"'), 'privacy-policy.html must have #cookies-policy anchor');
      assert.ok(html.includes('auth_token'), 'must document auth_token cookie');
      assert.ok(html.includes('tya_font_scale'), 'must document tya_font_scale in localStorage');
    });

    it('verifies index.html renders dismissible transparency notice banner', () => {
      const html = fs.readFileSync(path.join(TEMPLATES_DIR, 'index.html'), 'utf8');
      assert.ok(html.includes('id="cookie-notice-banner"'), 'index.html must have cookie notice banner element');
      assert.ok(html.includes('id="cookie-notice-accept"'), 'index.html must have acknowledge button');
    });
  });

  describe('7. WebP Image Compression', () => {
    it('verifies gallery images have compressed WebP counterparts in static/images/gallery', () => {
      const galleryDir = path.join(ROOT_DIR, 'static', 'images', 'gallery');
      const webpFiles = fs.readdirSync(galleryDir).filter(f => f.endsWith('.webp'));
      assert.ok(webpFiles.length >= 46, `Expected at least 46 WebP gallery photos, found ${webpFiles.length}`);

      const html = fs.readFileSync(path.join(TEMPLATES_DIR, 'gallery.html'), 'utf8');
      assert.ok(html.includes('<picture'), 'gallery.html must use <picture> wrappers');
      assert.ok(html.includes('type="image/webp"'), 'gallery.html must provide WebP sources');
    });
  });

  describe('8. Semantic Breadcrumbs & BreadcrumbList Schema', () => {
    it('verifies hierarchical pages have semantic <nav aria-label="Breadcrumb"> and BreadcrumbList schema', () => {
      ['about.html', 'activities.html', 'events.html', 'districts.html', 'membership.html', 'results.html', 'downloads.html', 'gallery.html'].forEach(file => {
        const html = fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf8');
        assert.ok(html.includes('aria-label="Breadcrumb"'), `${file} must contain <nav aria-label="Breadcrumb">`);
        assert.ok(html.includes('aria-current="page"'), `${file} must indicate current page with aria-current="page"`);
        assert.ok(html.includes('"@type": "BreadcrumbList"'), `${file} must include BreadcrumbList JSON-LD schema`);
      });
    });
  });

  describe('9. llms.txt', () => {
    it('verifies public/llms.txt exists with structured markdown overview and public route links', () => {
      const llmsPath = path.join(PUBLIC_DIR, 'llms.txt');
      assert.ok(fs.existsSync(llmsPath), 'llms.txt must exist in public/');

      const content = fs.readFileSync(llmsPath, 'utf8');
      assert.ok(content.includes('Telangana Yoga Association'), 'llms.txt must state organization title');
      assert.ok(content.includes('Sub-Junior'), 'llms.txt must detail championship divisions');
      assert.ok(content.includes('₹260'), 'llms.txt must disclose entry fee');
      assert.ok(content.includes(SITE_URL), 'llms.txt must use absolute URLs');
    });
  });

  describe('10. Font Licenses (OFL)', () => {
    it('verifies SIL Open Font License files and verification document are bundled in static/fonts/', () => {
      const fontsDir = path.join(ROOT_DIR, 'static', 'fonts');
      assert.ok(fs.existsSync(path.join(fontsDir, 'OFL-Inter.txt')), 'OFL-Inter.txt must be bundled');
      assert.ok(fs.existsSync(path.join(fontsDir, 'OFL-PlusJakartaSans.txt')), 'OFL-PlusJakartaSans.txt must be bundled');
      assert.ok(fs.existsSync(path.join(fontsDir, 'FONT-LICENSES.md')), 'FONT-LICENSES.md must document license audit');
    });
  });

});
