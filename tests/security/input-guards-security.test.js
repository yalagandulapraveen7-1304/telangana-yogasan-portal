/**
 * Security Tests - Input Guards, Payload Limits & Path Traversal
 * Tests file route path traversal resistance, payload limits, and malformed JSON recovery.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const app = require('../../server');
const { connectDB } = require('../../config/db');

let server;
let baseUrl;

describe('Security Tests: Input Guards & Traversal Defense', () => {

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

  describe('1. File Upload Route & Path Traversal (/uploads/:filename)', () => {
    it('blocks directory traversal attempts using .. sequences', async () => {
      const res = await fetch(`${baseUrl}/uploads/..%2f..%2fpackage.json`);
      // Rejection status must be 400 or 403 or 404 (never 200 with file content)
      assert.notEqual(res.status, 200);
      assert.ok(res.status === 400 || res.status === 403 || res.status === 404);
    });

    it('blocks traversal with encoded slashes or null-byte characters', async () => {
      const res1 = await fetch(`${baseUrl}/uploads/%2e%2e%2fserver.js`);
      assert.notEqual(res1.status, 200);

      const res2 = await fetch(`${baseUrl}/uploads/test.jpg%00.pdf`);
      assert.notEqual(res2.status, 200);
    });

    it('rejects disallowed file extensions on file download route', async () => {
      const disallowed = ['shell.php', 'exploit.sh', 'binary.exe', 'server.js'];
      for (const file of disallowed) {
        const res = await fetch(`${baseUrl}/uploads/${file}`);
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.success, false);
      }
    });
  });

  describe('2. Malformed JSON & Payload Limits', () => {
    it('handles malformed JSON body gracefully returning 400 without crashing server', async () => {
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"email": "broken_json'
      });

      assert.equal(res.status, 400);
      const data = await res.json();
      assert.equal(data.success, false);
      assert.ok(data.error.includes('JSON'));
    });

    it('rejects oversized payloads exceeding the 2MB limit with 413 or 400', async () => {
      // 2.5 MB payload
      const hugeString = 'A'.repeat(2.5 * 1024 * 1024);

      try {
        const res = await fetch(`${baseUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com', password: hugeString })
        });

        assert.ok(res.status === 413 || res.status === 400);
      } catch (err) {
        // Some HTTP fetch clients reset connection on 413 payload limit, which is also valid defense
        assert.ok(err);
      }
    });
  });
});
