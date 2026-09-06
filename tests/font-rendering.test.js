const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const TEMPLATES = [
  'index.html',
  'login.html',
  'nominate.html',
  'school-nominate.html',
  'dashboard.html',
  'admitcard.html'
];

describe('Font Rendering & Mobile Compatibility Audit', () => {
  it('verifies local WOFF2 font files exist and are valid WOFF2 binaries', () => {
    const interPath = path.join(ROOT_DIR, 'static', 'fonts', 'inter-variable.woff2');
    const jakartaPath = path.join(ROOT_DIR, 'static', 'fonts', 'plus-jakarta-sans-variable.woff2');

    assert.ok(fs.existsSync(interPath), 'inter-variable.woff2 must exist');
    assert.ok(fs.existsSync(jakartaPath), 'plus-jakarta-sans-variable.woff2 must exist');

    const interBuf = fs.readFileSync(interPath);
    const jakartaBuf = fs.readFileSync(jakartaPath);

    assert.equal(interBuf.slice(0, 4).toString('utf8'), 'wOF2', 'Inter must be valid WOFF2');
    assert.equal(jakartaBuf.slice(0, 4).toString('utf8'), 'wOF2', 'Plus Jakarta Sans must be valid WOFF2');
    assert.ok(interBuf.length > 5000, 'Inter font file size is adequate');
    assert.ok(jakartaBuf.length > 5000, 'Plus Jakarta Sans font file size is adequate');
  });

  it('verifies all 6 HTML templates contain critical font preloads and Google Fonts CDN fallback', () => {
    TEMPLATES.forEach(tpl => {
      const filePath = path.join(ROOT_DIR, 'templates', tpl);
      assert.ok(fs.existsSync(filePath), `${tpl} must exist`);
      const content = fs.readFileSync(filePath, 'utf8');

      assert.ok(
        content.includes('/static/fonts/inter-variable.woff2'),
        `${tpl} must preload inter-variable.woff2`
      );
      assert.ok(
        content.includes('/static/fonts/plus-jakarta-sans-variable.woff2'),
        `${tpl} must preload plus-jakarta-sans-variable.woff2`
      );
      assert.ok(
        content.includes('fonts.googleapis.com/css2'),
        `${tpl} must include Google Fonts stylesheet`
      );
      assert.ok(
        content.includes('fonts.gstatic.com'),
        `${tpl} must include gstatic preconnect`
      );
    });
  });

  it('verifies custom.css completely excludes system-ui and device-theme overrides', () => {
    const customCssPath = path.join(ROOT_DIR, 'static', 'css', 'custom.css');
    const customCss = fs.readFileSync(customCssPath, 'utf8');

    assert.ok(!customCss.includes('system-ui'), 'custom.css must not contain system-ui');
    assert.ok(!customCss.includes('BlinkMacSystemFont'), 'custom.css must not contain BlinkMacSystemFont');
    assert.ok(!customCss.includes('-apple-system'), 'custom.css must not contain -apple-system');
  });

  it('verifies input.css configures Tailwind with custom fonts and allowed fallbacks', () => {
    const inputCssPath = path.join(ROOT_DIR, 'static', 'css', 'input.css');
    const inputCss = fs.readFileSync(inputCssPath, 'utf8');

    assert.ok(!inputCss.includes('system-ui'), 'input.css must not contain system-ui');
    assert.ok(!inputCss.includes('BlinkMacSystemFont'), 'input.css must not contain BlinkMacSystemFont');
    assert.ok(inputCss.includes('--default-font-family: "Inter"'), 'default font family must start with Inter');
    assert.ok(inputCss.includes('--font-sans: "Inter"'), 'font-sans must prioritize Inter');
    assert.ok(inputCss.includes('--font-display: "Plus Jakarta Sans"'), 'font-display must prioritize Plus Jakarta Sans');
  });

  it('verifies custom.css explicitly applies custom font to form inputs, buttons, tables, and headings', () => {
    const customDevPath = path.join(ROOT_DIR, 'static', 'css', 'custom.dev.css');
    const customDevCss = fs.readFileSync(customDevPath, 'utf8');

    const requiredSelectors = ['button', 'input', 'select', 'textarea', 'th', 'td', 'h1', 'h2'];
    requiredSelectors.forEach(sel => {
      assert.ok(customDevCss.includes(sel), `custom.dev.css must explicitly target ${sel}`);
    });
  });

  it('verifies CSP in server.js permits Google Fonts CDN origins', () => {
    const serverJsPath = path.join(ROOT_DIR, 'server.js');
    const serverJs = fs.readFileSync(serverJsPath, 'utf8');

    assert.ok(serverJs.includes('https://fonts.googleapis.com'), 'CSP must allow fonts.googleapis.com');
    assert.ok(serverJs.includes('https://fonts.gstatic.com'), 'CSP must allow fonts.gstatic.com');
  });
});
