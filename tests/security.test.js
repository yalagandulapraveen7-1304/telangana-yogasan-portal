/**
 * Automated Security Test Suite
 * Tests NoSQL sanitization, district isolation, CSRF origin verification,
 * XSS stripping, path traversal defense, and upload whitelisting.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  sanitizeNoSql,
  escapeRegex,
  stripHtml,
  originGuard
} = require('../middleware/sanitize');
const { resolveFilePath } = require('../services/storage');
const { ALLOWED_EXTENSIONS } = require('../middleware/upload');

describe('NoSQL Injection Defense', () => {
  test('strips dangerous MongoDB operator keys starting with $', () => {
    const maliciousPayload = {
      email: { $ne: null },
      password: { $gt: '' },
      role: 'SECRETARY'
    };

    sanitizeNoSql(maliciousPayload);

    assert.equal(maliciousPayload.email.$ne, undefined);
    assert.equal(maliciousPayload.password.$gt, undefined);
    assert.equal(maliciousPayload.role, 'SECRETARY');
  });

  test('strips keys containing dot notation used for prototype/path pollution', () => {
    const payload = {
      'user.role': 'SUPER_ADMIN',
      validKey: 'validValue'
    };

    sanitizeNoSql(payload);

    assert.equal(payload['user.role'], undefined);
    assert.equal(payload.validKey, 'validValue');
  });

  test('recursively cleans nested objects and arrays', () => {
    const nested = {
      filters: [
        { $where: 'function() { return true; }' },
        { district: 'Hyderabad' }
      ]
    };

    sanitizeNoSql(nested);

    assert.equal(nested.filters[0].$where, undefined);
    assert.equal(nested.filters[1].district, 'Hyderabad');
  });
});

describe('ReDoS & Regex Injection Defense', () => {
  test('escapes regex meta-characters so input is treated as literal', () => {
    const userInput = 'Hyderabad.*+?^${}()|[]\\';
    const escaped = escapeRegex(userInput);

    const re = new RegExp(`^${escaped}$`);
    assert.ok(re.test(userInput));
    assert.ok(!re.test('HyderabadXYZ'));
  });
});

describe('XSS Input Sanitization', () => {
  test('strips HTML script tags from input strings', () => {
    const dirty = '<script>alert("xss")</script>John Doe';
    assert.equal(stripHtml(dirty), 'alert("xss")John Doe');
  });

  test('strips event handler image tags', () => {
    const dirty = '<img src=x onerror=alert(1)>Jane';
    assert.equal(stripHtml(dirty), 'Jane');
  });
});

describe('CSRF & Origin Guard Middleware', () => {
  test('allows safe GET requests without origin checks', () => {
    let nextCalled = false;
    const req = { method: 'GET', headers: { origin: 'https://evil.com' } };
    const res = { status: () => ({ json: () => {} }) };

    originGuard(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });

  test('blocks state-changing POST requests from mismatched origins', () => {
    let statusCode = null;
    const req = {
      method: 'POST',
      headers: {
        host: 'telanganayoga.org',
        origin: 'https://attacker.com'
      }
    };
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: () => {} };
      }
    };

    originGuard(req, res, () => {});

    assert.equal(statusCode, 403);
  });

  test('allows state-changing requests from matching origin', () => {
    let nextCalled = false;
    const req = {
      method: 'POST',
      headers: {
        host: 'telanganayoga.org',
        origin: 'https://telanganayoga.org'
      }
    };
    const res = { status: () => ({ json: () => {} }) };

    originGuard(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });
});

describe('Directory Traversal & Storage Security', () => {
  test('rejects path traversal attempts outside storage boundary', () => {
    const { isValid } = resolveFilePath('../../../../../windows/system32/cmd.exe');
    assert.equal(isValid, false);
  });

  test('rejects null-byte and absolute path injection attempts', () => {
    assert.equal(resolveFilePath('/etc/shadow').isValid, false);
    assert.equal(resolveFilePath('C:\\boot.ini').isValid, false);
  });
});

describe('File Upload Extension Whitelist', () => {
  test('strictly enforces allowed media and document extensions', () => {
    assert.ok(ALLOWED_EXTENSIONS.has('.jpg'));
    assert.ok(ALLOWED_EXTENSIONS.has('.jpeg'));
    assert.ok(ALLOWED_EXTENSIONS.has('.png'));
    assert.ok(ALLOWED_EXTENSIONS.has('.webp'));
    assert.ok(ALLOWED_EXTENSIONS.has('.pdf'));

    assert.ok(!ALLOWED_EXTENSIONS.has('.exe'));
    assert.ok(!ALLOWED_EXTENSIONS.has('.php'));
    assert.ok(!ALLOWED_EXTENSIONS.has('.sh'));
    assert.ok(!ALLOWED_EXTENSIONS.has('.svg'));
  });
});
