/**
 * End-to-End (E2E) Tests - Public Homepage & Static Assets
 * Tests public visitor user journey, static asset serving, caching, and security headers.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const app = require('../../server');
const { connectDB } = require('../../config/db');

let server;
let baseUrl;

describe('E2E Tests: Public Homepage & Navigation Workflow', () => {

  before(async () => {
    await connectDB();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });

  it('serves the public landing page with correct HTML landmarks and CTAs', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);

    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('text/html'));

    const html = await res.text();
    assert.ok(html.includes('Telangana Yoga Association'), 'Page title or brand must be present');
    assert.ok(html.includes('id="main-content"'), 'Accessible main content landmark must exist');
    assert.ok(html.includes('class="skip-link"'), 'Skip navigation link must exist');
    assert.ok(html.includes('/nominate'), 'New Athlete registration CTA must exist');
    assert.ok(html.includes('/school-nominate'), 'School Delegation CTA must exist');
    assert.ok(html.includes('Yoga Federation Rules'), 'Official rulebook link must exist');
  });

  it('serves static CSS, Fonts, and JS assets with optimal caching headers', async () => {
    // 1. Compiled output CSS
    const cssRes = await fetch(`${baseUrl}/static/css/output.css`);
    assert.equal(cssRes.status, 200);
    assert.ok(cssRes.headers.get('cache-control')?.includes('max-age'));

    // 2. Local WOFF2 font
    const fontRes = await fetch(`${baseUrl}/static/fonts/inter-variable.woff2`);
    assert.equal(fontRes.status, 200);
    assert.ok(fontRes.headers.get('cache-control')?.includes('immutable'));

    // 3. Main client JS
    const jsRes = await fetch(`${baseUrl}/static/js/main.js`);
    assert.equal(jsRes.status, 200);

    // 4. Favicon
    const favRes = await fetch(`${baseUrl}/favicon.ico`);
    assert.equal(favRes.status, 200);
  });

  it('enforces hardened HTTP security headers on all responses', async () => {
    const res = await fetch(`${baseUrl}/`);

    // Helmet security headers
    assert.ok(res.headers.get('content-security-policy'));
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('permissions-policy'));

    // Technology disclosure suppression
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});
