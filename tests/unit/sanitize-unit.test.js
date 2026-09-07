/**
 * Unit Tests - Sanitization & Storage Guard Utilities (middleware/sanitize.js & services/storage.js)
 * Tests NoSQL operator stripping, XSS neutralization, regex escaping, and path traversal defense.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  sanitizeNoSql,
  noSqlSanitizer,
  escapeRegex,
  stripHtml,
  originGuard
} = require('../../middleware/sanitize');
const {
  getStorageDir,
  resolveFilePath,
  fileExists
} = require('../../services/storage');

describe('Unit Tests: Sanitization & Storage Security', () => {

  describe('1. HTML Stripping & XSS Neutralization (stripHtml)', () => {
    it('removes <script> and executable code blocks', () => {
      const dirty = 'Hello <script>alert("pwned")</script>World';
      assert.equal(stripHtml(dirty), 'Hello alert("pwned")World');
    });

    it('removes event-handler image tags', () => {
      const dirty = 'Participant<img src="x" onerror="alert(1)"> Name';
      assert.equal(stripHtml(dirty), 'Participant Name');
    });

    it('removes iframe and object tags', () => {
      const dirty = '<iframe src="evil.com"></iframe>Clean';
      assert.equal(stripHtml(dirty), 'Clean');
    });

    it('safely handles non-string inputs', () => {
      assert.equal(stripHtml(null), '');
      assert.equal(stripHtml(undefined), '');
      assert.equal(stripHtml(12345), '');
      assert.equal(stripHtml({}), '');
    });
  });

  describe('2. Regex Metacharacter Escaping (escapeRegex)', () => {
    it('escapes all standard regex special characters', () => {
      const dangerous = '^$.*+?()[]{}|\\';
      const escaped = escapeRegex(dangerous);
      assert.equal(escaped, '\\^\\$\\.\\*\\+\\?\\(\\)\\[\\]\\{\\}\\|\\\\');

      // Test that new RegExp creates literal match without ReDoS
      const regex = new RegExp(escaped);
      assert.ok(regex.test('^$.*+?()[]{}|\\'));
    });

    it('safely handles non-string or empty input', () => {
      assert.equal(escapeRegex(''), '');
      assert.equal(escapeRegex(123), '123');
    });
  });

  describe('3. NoSQL Injection Cleaning (sanitizeNoSql)', () => {
    it('strips top-level MongoDB operator keys starting with $', () => {
      const payload = {
        email: 'athlete@example.com',
        $gt: '',
        $where: 'sleep(1000)'
      };
      sanitizeNoSql(payload);
      assert.deepEqual(payload, { email: 'athlete@example.com' });
    });

    it('strips keys containing dot notation (prototype/field path pollution)', () => {
      const payload = {
        name: 'Athlete',
        'address.street': 'Main St',
        '__proto__.isAdmin': true
      };
      sanitizeNoSql(payload);
      assert.deepEqual(payload, { name: 'Athlete' });
    });

    it('recursively cleans deeply nested objects and arrays', () => {
      const payload = {
        level1: {
          $ne: null,
          items: [
            { $where: 'bad', valid: 'yes' },
            { nested: { $regex: '.*' } }
          ]
        }
      };
      sanitizeNoSql(payload);
      assert.deepEqual(payload, {
        level1: {
          items: [
            { valid: 'yes' },
            { nested: {} }
          ]
        }
      });
    });

    it('passes through non-object types safely', () => {
      assert.equal(sanitizeNoSql('string'), 'string');
      assert.equal(sanitizeNoSql(123), 123);
      assert.equal(sanitizeNoSql(null), null);
      assert.equal(sanitizeNoSql(undefined), undefined);
    });
  });

  describe('4. Express Middleware Integration (noSqlSanitizer)', () => {
    it('cleans req.body, req.query, and req.params in place', () => {
      const req = {
        body: { $gt: '', name: 'Test' },
        query: { $ne: '', district: 'Hyderabad' },
        params: { id: '123', $param: 'bad' }
      };

      let nextCalled = false;
      noSqlSanitizer(req, {}, () => { nextCalled = true; });

      assert.equal(nextCalled, true);
      assert.deepEqual(req.body, { name: 'Test' });
      assert.deepEqual(req.query, { district: 'Hyderabad' });
      assert.deepEqual(req.params, { id: '123' });
    });
  });

  describe('5. CSRF & Origin Guard (originGuard)', () => {
    it('allows safe methods (GET, HEAD, OPTIONS) without origin checks', () => {
      const req = { method: 'GET', headers: {} };
      let nextCalled = false;
      originGuard(req, {}, () => { nextCalled = true; });
      assert.equal(nextCalled, true);
    });

    it('blocks state-changing POST requests from mismatched origins', () => {
      const req = {
        method: 'POST',
        headers: {
          host: 'telanganayoga.org',
          origin: 'https://attacker.com'
        }
      };
      let statusCode = null;
      let jsonBody = null;
      const res = {
        status: (code) => {
          statusCode = code;
          return {
            json: (data) => { jsonBody = data; }
          };
        }
      };

      originGuard(req, res, () => {});
      assert.equal(statusCode, 403);
      assert.equal(jsonBody.success, false);
    });

    it('allows state-changing requests when Origin matches Host', () => {
      const req = {
        method: 'POST',
        headers: {
          host: 'telanganayoga.org',
          origin: 'https://telanganayoga.org'
        }
      };
      let nextCalled = false;
      originGuard(req, {}, () => { nextCalled = true; });
      assert.equal(nextCalled, true);
    });
  });

  describe('6. File Storage Service (services/storage.js)', () => {
    it('returns a valid absolute storage directory path', () => {
      const dir = getStorageDir();
      assert.ok(typeof dir === 'string' && dir.length > 0);
      assert.ok(path.isAbsolute(dir));
    });

    it('rejects directory traversal attempts with relative or absolute tokens', () => {
      assert.equal(resolveFilePath('../../etc/passwd').isValid, false);
      assert.equal(resolveFilePath('..\\..\\windows\\system32').isValid, false);
      assert.equal(resolveFilePath('/root/secret').isValid, false);
      assert.equal(resolveFilePath('nested/folder/file.jpg').isValid, false);
      assert.equal(resolveFilePath(null).isValid, false);
      assert.equal(resolveFilePath('').isValid, false);
    });

    it('safely resolves a clean filename inside the designated storage folder', () => {
      const res = resolveFilePath('athlete_photo_101.jpg');
      assert.equal(res.isValid, true);
      assert.ok(res.filePath.endsWith('athlete_photo_101.jpg'));
    });

    it('fileExists returns false for non-existent files', () => {
      assert.equal(fileExists('definitely_does_not_exist_99999.png'), false);
    });
  });
});
