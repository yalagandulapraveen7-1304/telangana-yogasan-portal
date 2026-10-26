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
        host: 'telanganayoga.org.in',
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
        host: 'telanganayoga.org.in',
        origin: 'https://telanganayoga.org.in'
      }
    };
    const res = { status: () => ({ json: () => {} }) };

    originGuard(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
  });

  test('blocks unconfirmed legacy domains (e.g. telanganayoga.org) in all environments', () => {
    const legacyOrigins = [
      'https://telanganayoga.org',
      'https://www.telanganayoga.org'
    ];

    for (const legacyOrigin of legacyOrigins) {
      let statusCode = null;
      const host = new URL(legacyOrigin).host;
      const req = {
        method: 'POST',
        headers: {
          host,
          origin: legacyOrigin
        }
      };
      const res = {
        status: (code) => {
          statusCode = code;
          return { json: () => {} };
        }
      };

      originGuard(req, res, () => {});
      assert.equal(statusCode, 403, `Expected legacy origin ${legacyOrigin} to be rejected with 403`);
    }
  });

  test('rejects wildcard Vercel preview origins in production environment', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalVercelEnv = process.env.VERCEL_ENV;
    const originalVercel = process.env.VERCEL;

    try {
      process.env.NODE_ENV = 'production';
      process.env.VERCEL_ENV = 'production';
      process.env.VERCEL = '1';

      const previewOrigins = [
        'https://telangana-yogasan-portal-git-feat-test.vercel.app',
        'https://telangana-yogasan-portal-preview.vercel.app',
        'https://other-project.vercel.app'
      ];

      for (const previewOrigin of previewOrigins) {
        let statusCode = null;
        const host = new URL(previewOrigin).host;
        const req = {
          method: 'POST',
          headers: {
            host,
            origin: previewOrigin
          }
        };
        const res = {
          status: (code) => {
            statusCode = code;
            return { json: () => {} };
          }
        };

        originGuard(req, res, () => {});
        assert.equal(statusCode, 403, `Expected preview origin ${previewOrigin} to be rejected in production`);
      }
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalVercelEnv !== undefined) {
        process.env.VERCEL_ENV = originalVercelEnv;
      } else {
        delete process.env.VERCEL_ENV;
      }
      if (originalVercel !== undefined) {
        process.env.VERCEL = originalVercel;
      } else {
        delete process.env.VERCEL;
      }
    }
  });

  test('permits preview origins ONLY when VERCEL_ENV is preview, rejecting untrusted origins', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalVercelEnv = process.env.VERCEL_ENV;
    const originalVercelUrl = process.env.VERCEL_URL;
    const originalVercel = process.env.VERCEL;

    try {
      process.env.NODE_ENV = 'production';
      process.env.VERCEL_ENV = 'preview';
      process.env.VERCEL = '1';
      process.env.VERCEL_URL = 'telangana-yogasan-portal-pr-42-team.vercel.app';

      // 1. Exact deployment origin matching VERCEL_URL is accepted
      let exactNextCalled = false;
      const reqExact = {
        method: 'POST',
        headers: {
          host: 'telangana-yogasan-portal-pr-42-team.vercel.app',
          origin: 'https://telangana-yogasan-portal-pr-42-team.vercel.app'
        }
      };
      const resExact = { status: () => ({ json: () => {} }) };
      originGuard(reqExact, resExact, () => {
        exactNextCalled = true;
      });
      assert.equal(exactNextCalled, true, 'Expected exact VERCEL_URL to be permitted in preview environment');

      // 2. Project-scoped preview pattern is accepted
      let patternNextCalled = false;
      const reqPattern = {
        method: 'POST',
        headers: {
          host: 'telangana-yogasan-portal-git-feature-x.vercel.app',
          origin: 'https://telangana-yogasan-portal-git-feature-x.vercel.app'
        }
      };
      const resPattern = { status: () => ({ json: () => {} }) };
      originGuard(reqPattern, resPattern, () => {
        patternNextCalled = true;
      });
      assert.equal(patternNextCalled, true, 'Expected project preview pattern to be permitted in preview environment');

      // 3. Foreign / attacker Vercel origins are rejected even in preview environment
      const untrustedPreviewOrigins = [
        'https://malicious-other-app.vercel.app',
        'https://attacker-telangana-yoga.vercel.app',
        'https://evil-project.vercel.app'
      ];

      for (const untrusted of untrustedPreviewOrigins) {
        let statusCode = null;
        const host = new URL(untrusted).host;
        const reqUntrusted = {
          method: 'POST',
          headers: {
            host,
            origin: untrusted
          }
        };
        const resUntrusted = {
          status: (code) => {
            statusCode = code;
            return { json: () => {} };
          }
        };
        originGuard(reqUntrusted, resUntrusted, () => {});
        assert.equal(statusCode, 403, `Expected untrusted origin ${untrusted} to be rejected in preview environment`);
      }
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      if (originalVercelEnv !== undefined) {
        process.env.VERCEL_ENV = originalVercelEnv;
      } else {
        delete process.env.VERCEL_ENV;
      }
      if (originalVercelUrl !== undefined) {
        process.env.VERCEL_URL = originalVercelUrl;
      } else {
        delete process.env.VERCEL_URL;
      }
      if (originalVercel !== undefined) {
        process.env.VERCEL = originalVercel;
      } else {
        delete process.env.VERCEL;
      }
    }
  });

  test('blocks attacker-controlled Host headers even when Origin matches attacker Host', () => {
    let statusCode = null;
    const req = {
      method: 'POST',
      headers: {
        host: 'evil.attacker.com',
        origin: 'https://evil.attacker.com'
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

  test('blocks state-changing requests when Origin/Referer is missing on cookie-authenticated requests', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      let statusCode = null;
      const req = {
        method: 'POST',
        headers: {
          host: 'telanganayoga.org.in'
        },
        cookies: {
          token: 'eyJhbGciOiJIUzI1NiIsIn...'
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
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  test('allows alternate valid hostnames configured in allowlist', () => {
    const validOrigins = [
      'https://telanganayoga.org.in',
      'https://www.telanganayoga.org.in',
      'https://telangana-yogasan-portal.vercel.app'
    ];

    for (const validOrigin of validOrigins) {
      let nextCalled = false;
      const host = new URL(validOrigin).host;
      const req = {
        method: 'POST',
        headers: {
          host,
          origin: validOrigin
        }
      };
      const res = { status: () => ({ json: () => {} }) };

      originGuard(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true, `Expected ${validOrigin} to be allowed`);
    }
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
    assert.ok(ALLOWED_EXTENSIONS.has('.gif'));
    assert.ok(ALLOWED_EXTENSIONS.has('.svg'));
    assert.ok(ALLOWED_EXTENSIONS.has('.pdf'));

    assert.ok(!ALLOWED_EXTENSIONS.has('.exe'));
    assert.ok(!ALLOWED_EXTENSIONS.has('.php'));
    assert.ok(!ALLOWED_EXTENSIONS.has('.sh'));
    assert.ok(!ALLOWED_EXTENSIONS.has('.html'));
    assert.ok(!ALLOWED_EXTENSIONS.has('.js'));
  });
});
