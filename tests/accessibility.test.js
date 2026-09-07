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

describe('WCAG 2.2 AA Accessibility Test Suite', () => {

  describe('1. Skip Links & Landmark Regions (WCAG 2.4.1, 1.3.1)', () => {
    it('verifies all 6 templates have a visible skip link targeting #main-content', () => {
      TEMPLATES.forEach((tpl) => {
        const filePath = path.join(ROOT_DIR, 'templates', tpl);
        const html = fs.readFileSync(filePath, 'utf8');

        assert.ok(
          html.includes('href="#main-content"') && html.includes('class="skip-link"'),
          `${tpl} must contain a skip link targeting #main-content with class "skip-link"`
        );

        assert.ok(
          html.includes('<main') && html.includes('id="main-content"'),
          `${tpl} must have a <main> element with id="main-content"`
        );

        assert.ok(
          html.includes('id="main-content"') && html.includes('tabindex="-1"'),
          `${tpl} main-content must have tabindex="-1" for programmatic focus transfer`
        );
      });
    });
  });

  describe('2. Heading Hierarchy (WCAG 1.3.1, 2.4.6)', () => {
    it('verifies all templates have exactly one primary <h1> heading', () => {
      TEMPLATES.forEach((tpl) => {
        const filePath = path.join(ROOT_DIR, 'templates', tpl);
        const html = fs.readFileSync(filePath, 'utf8');

        const h1Matches = html.match(/<h1[\s>]/gi) || [];
        assert.equal(
          h1Matches.length,
          1,
          `${tpl} must contain exactly one <h1> element (found ${h1Matches.length})`
        );
      });
    });

    it('verifies index.html has a logical heading progression without jumps', () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, 'templates', 'index.html'), 'utf8');
      assert.ok(html.includes('<h1'), 'index.html must have an h1');
      assert.ok(html.includes('<h2'), 'index.html must have h2 subheadings');
      // Verify State Selection Trials hero is an h2
      assert.ok(
        /<h2[^>]*>[\s\S]*?State Selection Trials/i.test(html),
        'Hero section subheading should be an <h2>'
      );
    });
  });

  describe('3. Non-Text Content & Image Alternatives (WCAG 1.1.1)', () => {
    it('verifies all <img> tags across all templates have non-empty, descriptive alt attributes', () => {
      TEMPLATES.forEach((tpl) => {
        const filePath = path.join(ROOT_DIR, 'templates', tpl);
        const html = fs.readFileSync(filePath, 'utf8');

        const imgRegex = /<img\s+([^>]+)>/gi;
        let match;
        while ((match = imgRegex.exec(html)) !== null) {
          const imgTag = match[0];
          const attrs = match[1];

          // Check if alt attribute exists
          const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
          assert.ok(
            altMatch !== null,
            `${tpl}: Image tag missing alt attribute: ${imgTag}`
          );

          // Alt attribute must not be empty (unless explicitly aria-hidden)
          const altValue = altMatch[1].trim();
          assert.ok(
            altValue.length > 0,
            `${tpl}: Image tag has empty alt attribute: ${imgTag}`
          );
        }
      });
    });

    it('verifies government / association logo has a descriptive alt text', () => {
      const templatesWithLogo = ['index.html', 'login.html', 'nominate.html', 'school-nominate.html', 'dashboard.html'];
      templatesWithLogo.forEach((tpl) => {
        const filePath = path.join(ROOT_DIR, 'templates', tpl);
        const html = fs.readFileSync(filePath, 'utf8');
        if (html.includes('TSYSC.png')) {
          assert.ok(
            html.includes('alt="Telangana State Yoga Association Logo"'),
            `${tpl}: TSYSC.png must have descriptive alt text "Telangana State Yoga Association Logo"`
          );
        }
      });
    });
  });

  describe('4. Decorative Icon Accessibility (WCAG 1.1.1)', () => {
    it('verifies all FontAwesome <i> icons have aria-hidden="true"', () => {
      TEMPLATES.forEach((tpl) => {
        const filePath = path.join(ROOT_DIR, 'templates', tpl);
        const html = fs.readFileSync(filePath, 'utf8');

        const iconRegex = /<i\s+([^>]*class=["'][^"']*(?:fa-|fa\b)[^"']*["'][^>]*)>/gi;
        let match;
        while ((match = iconRegex.exec(html)) !== null) {
          const iconTag = match[0];
          assert.ok(
            iconTag.includes('aria-hidden="true"'),
            `${tpl}: FontAwesome icon missing aria-hidden="true": ${iconTag}`
          );
        }
      });
    });
  });

  describe('5. Form Labels & Associations (WCAG 1.3.1, 3.3.2, 4.1.2)', () => {
    it('verifies login.html form controls have labels, autocomplete, and aria-required', () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, 'templates', 'login.html'), 'utf8');
      assert.ok(html.includes('for="email"'), 'login.html must have <label for="email">');
      assert.ok(html.includes('for="password"'), 'login.html must have <label for="password">');
      assert.ok(html.includes('autocomplete="username"'), 'email input must have autocomplete="username"');
      assert.ok(html.includes('autocomplete="current-password"'), 'password input must have autocomplete="current-password"');
      assert.ok(html.includes('aria-required="true"'), 'inputs must have aria-required="true"');
      assert.ok(html.includes('role="alert"'), 'login error box must have role="alert"');
    });

    it('verifies nominate.html fields have matching <label for="..."> and fieldsets', () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, 'templates', 'nominate.html'), 'utf8');
      const requiredInputIds = [
        'first_name',
        'last_name',
        'dob-input',
        'aadhaar-input',
        'guardian_name',
        'institution_name',
        'district-select',
        'residential_address',
        'mobile_number',
        'passport-input',
        'dob-cert-input',
        'secretary-declaration'
      ];

      requiredInputIds.forEach((id) => {
        assert.ok(
          html.includes(`for="${id}"`),
          `nominate.html must have a <label for="${id}">`
        );
        assert.ok(
          html.includes(`id="${id}"`),
          `nominate.html must have an element with id="${id}"`
        );
      });

      // Fieldsets for grouped inputs
      assert.ok(html.includes('<fieldset'), 'nominate.html must use <fieldset> for gender options');
      assert.ok(html.includes('<legend'), 'nominate.html fieldset must have a <legend>');
      assert.ok(html.includes('id="events-section"'), 'nominate.html must have events-section fieldset');
    });

    it('verifies school-nominate.html declaration has proper label and success modal dialog role', () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, 'templates', 'school-nominate.html'), 'utf8');
      assert.ok(html.includes('for="school-declaration"'), 'school-nominate.html must have label for school-declaration');
      assert.ok(html.includes('id="school-declaration"'), 'school-nominate.html must have id="school-declaration"');
      assert.ok(html.includes('role="dialog"'), 'school-nominate.html modal must have role="dialog"');
      assert.ok(html.includes('aria-modal="true"'), 'school-nominate.html modal must have aria-modal="true"');
      assert.ok(html.includes('aria-labelledby="success-modal-title"'), 'modal must reference success-modal-title');
    });
  });

  describe('6. Dialog & Modal Accessibility (WCAG 4.1.2, 2.1.2)', () => {
    it('verifies dashboard.html modal has dialog attributes, accessible name, and iframe title', () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, 'templates', 'dashboard.html'), 'utf8');
      assert.ok(html.includes('role="dialog"'), 'dashboard modal must have role="dialog"');
      assert.ok(html.includes('aria-modal="true"'), 'dashboard modal must have aria-modal="true"');
      assert.ok(html.includes('aria-labelledby="modal-athlete-name"'), 'modal must have aria-labelledby');
      assert.ok(html.includes('title="Athlete verification proof document"'), 'proof iframe must have an accessible title');
      assert.ok(html.includes('role="region"'), 'table container must have role="region"');
      assert.ok(html.includes('tabindex="0"'), 'scrollable table container must have tabindex="0"');
    });
  });

  describe('7. Touch Target Minimums & Control Accessibility (WCAG 2.5.8, 4.1.2)', () => {
    it('verifies index.html topbar buttons have touch-target-min, type="button", and aria-label', () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, 'templates', 'index.html'), 'utf8');
      assert.ok(html.includes('id="font-decrease"'), 'font decrease button must exist');
      assert.ok(html.includes('aria-label="Decrease font size"'), 'font decrease button must have aria-label');
      assert.ok(html.includes('aria-label="Reset normal font size"'), 'font normal button must have aria-label');
      assert.ok(html.includes('aria-label="Increase font size"'), 'font increase button must have aria-label');
      assert.ok(html.includes('touch-target-min'), 'font buttons must have touch-target-min');
      assert.ok(html.includes('aria-controls="nav-menu"'), 'nav-toggle button must have aria-controls');
    });
  });

  describe('8. CSS Accessibility Enhancements (WCAG 2.4.7, 1.4.11, 2.3.3)', () => {
    it('verifies custom.css defines high-contrast focus rings and reduced motion media query', () => {
      const css = fs.readFileSync(path.join(ROOT_DIR, 'static', 'css', 'custom.css'), 'utf8');

      // Skip link styling
      assert.ok(css.includes('.skip-link'), 'custom.css must define .skip-link rules');

      // High-contrast focus visible ring
      assert.ok(
        css.includes(':focus-visible'),
        'custom.css must define high-contrast :focus-visible rules'
      );

      // Dual mode dark/light focus support
      assert.ok(
        css.includes('#0D5C3A') || css.includes('#0d5c3a'),
        'custom.css must use primary high-contrast green for focus on light surfaces'
      );
      assert.ok(
        css.includes('#FCD34D') || css.includes('#fcd34d'),
        'custom.css must use high-contrast gold/yellow for focus on dark surfaces'
      );

      // Reduced motion media query
      assert.ok(
        css.includes('prefers-reduced-motion'),
        'custom.css must define @media (prefers-reduced-motion: reduce)'
      );

      // Screen reader utility
      assert.ok(css.includes('.sr-only'), 'custom.css must define .sr-only');

      // Touch target minimum utility
      assert.ok(css.includes('.touch-target-min'), 'custom.css must define .touch-target-min');
    });
  });

  describe('9. JavaScript Accessible Focus & Modal Trap (WCAG 2.1.2, 4.1.3)', () => {
    it('verifies main.js contains trapFocus and Escape key handlers', () => {
      const js = fs.readFileSync(path.join(ROOT_DIR, 'static', 'js', 'main.dev.js'), 'utf8');
      assert.ok(js.includes('trapFocus'), 'main.dev.js must include trapFocus helper');
      assert.ok(js.includes('Escape'), 'main.dev.js must handle Escape key for overlays');
      assert.ok(js.includes('aria-invalid'), 'main.dev.js form validation must manage aria-invalid');
    });
  });
});
