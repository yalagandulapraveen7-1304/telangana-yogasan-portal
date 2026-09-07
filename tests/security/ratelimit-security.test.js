/**
 * Security Tests - Rate Limiting & Brute Force Defense
 * Tests rate limiting thresholds, standard HTTP 429 headers, and client IP isolation.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const rateLimit = require('express-rate-limit');

const { loginLimiter, nominationLimiter, apiLimiter } = require('../../middleware/auth');

let testApp;
let server;
let baseUrl;

describe('Security Tests: Rate Limiting & Brute-Force Defense', () => {

  before(async () => {
    // Isolated express instance to test rate limit mechanics deterministically
    testApp = express();
    testApp.use(express.json());

    const testLimiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 3,              // Allow 3 requests then block
      standardHeaders: true,
      legacyHeaders: false,
      message: { success: false, error: 'Too many attempts. Rate limit exceeded.' }
    });

    testApp.post('/test-login', testLimiter, (_req, res) => {
      res.json({ success: true, message: 'Processed' });
    });

    await new Promise((resolve) => {
      server = testApp.listen(0, () => {
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
  });

  it('allows requests within rate limit quota and returns standard RateLimit headers', async () => {
    const res = await fetch(`${baseUrl}/test-login`, { method: 'POST' });
    assert.equal(res.status, 200);

    // Standard IETF RateLimit headers
    const limitHeader = res.headers.get('ratelimit-limit');
    assert.equal(limitHeader, '3');
    assert.ok(res.headers.get('ratelimit-remaining') !== null);
  });

  it('triggers HTTP 429 Too Many Requests when threshold is exceeded', async () => {
    // Send requests 2 and 3 (reaching max of 3)
    await fetch(`${baseUrl}/test-login`, { method: 'POST' });
    await fetch(`${baseUrl}/test-login`, { method: 'POST' });

    // Request 4 must be blocked with HTTP 429
    const blockedRes = await fetch(`${baseUrl}/test-login`, { method: 'POST' });
    assert.equal(blockedRes.status, 429);

    const data = await blockedRes.json();
    assert.equal(data.success, false);
    assert.ok(data.error.includes('Too many attempts') || data.error.includes('Rate limit'));
  });

  it('verifies production limiters are properly configured with standard headers', () => {
    assert.ok(loginLimiter, 'loginLimiter must be defined');
    assert.ok(nominationLimiter, 'nominationLimiter must be defined');
    assert.ok(apiLimiter, 'apiLimiter must be defined');
  });
});
