/**
 * Security Tests - Authentication Tokens & JWT Security
 * Tests token tampering, expired tokens, algorithm confusion, and session handling.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  process.env.JWT_SECRET = 'test_jwt_secret_must_be_at_least_32_characters_long_for_security_suite';
}

const app = require('../../server');
const { JWT_SECRET } = require('../../config/constants');
const { connectDB } = require('../../config/db');

let server;
let baseUrl;

describe('Security Tests: Authentication Tokens & JWT Defense', () => {

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

  it('rejects API request without token with 401 Unauthorized JSON', async () => {
    const res = await fetch(`${baseUrl}/portal/athletes/list`, {
      headers: { Accept: 'application/json' }
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error.includes('Authentication required'));
  });

  it('redirects unauthenticated HTML page request to /login.html', async () => {
    const res = await fetch(`${baseUrl}/dashboard.html`, {
      redirect: 'manual'
    });

    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), '/login.html');
  });

  it('rejects expired tokens with 401 and clears session cookie', async () => {
    const expiredToken = jwt.sign(
      { id: 'user_exp', email: 'exp@example.com', role: 'SECRETARY', district: 'Hyderabad' },
      JWT_SECRET,
      { expiresIn: '-10s', algorithm: 'HS256' }
    );

    const res = await fetch(`${baseUrl}/portal/athletes/list`, {
      headers: {
        Authorization: `Bearer ${expiredToken}`,
        Accept: 'application/json'
      }
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error.includes('expired') || data.error.includes('invalid'));

    // Check Set-Cookie clears token
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie && setCookie.includes('token=;'));
  });

  it('rejects tampered token payloads (signature mismatch)', async () => {
    const validToken = jwt.sign(
      { id: 'user_good', email: 'good@example.com', role: 'SECRETARY', district: 'Hyderabad' },
      JWT_SECRET,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    // Tamper with payload by changing district to 'Warangal' while keeping old signature
    const parts = validToken.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ id: 'user_good', email: 'good@example.com', role: 'SECRETARY', district: 'Warangal' })
    ).toString('base64url');
    const forgedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const res = await fetch(`${baseUrl}/portal/athletes/list`, {
      headers: {
        Authorization: `Bearer ${forgedToken}`,
        Accept: 'application/json'
      }
    });

    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.success, false);
  });

  it('rejects malformed token strings and empty Bearer headers', async () => {
    const malformed = ['not-a-token', 'Bearer', 'Bearer 12345', 'Bearer a.b.c.d'];

    for (const token of malformed) {
      const res = await fetch(`${baseUrl}/portal/athletes/list`, {
        headers: {
          Authorization: token,
          Accept: 'application/json'
        }
      });
      assert.equal(res.status, 401);
    }
  });

  it('rejects algorithm confusion attacks (tokens signed with none or RS256)', async () => {
    // Unsecured token (alg: 'none')
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ id: 'attacker', role: 'SUPER_ADMIN', district: 'ALL' })).toString('base64url');
    const unsignedToken = `${header}.${payload}.`;

    const res = await fetch(`${baseUrl}/auth/logs`, {
      headers: {
        Authorization: `Bearer ${unsignedToken}`,
        Accept: 'application/json'
      }
    });

    assert.equal(res.status, 401);
  });

  it('accepts valid token delivered via HTTP-Only cookie', async () => {
    const validToken = jwt.sign(
      { id: 'user_cookie', email: 'cookie@example.com', role: 'SECRETARY', district: 'Hyderabad' },
      JWT_SECRET,
      { expiresIn: '1h', algorithm: 'HS256' }
    );

    const res = await fetch(`${baseUrl}/portal/athletes/list`, {
      headers: {
        Cookie: `token=${validToken}`,
        Accept: 'application/json'
      }
    });

    assert.equal(res.status, 200);
  });

  describe('Startup Fail-Fast & Secret Validation', () => {
    const rootDir = path.resolve(__dirname, '../../');

    it('fails fast at startup if JWT_SECRET is not set in environment', () => {
      const result = spawnSync(process.execPath, [
        '-e',
        'require("dotenv").config = () => {}; delete process.env.JWT_SECRET; require("./config/constants");'
      ], {
        cwd: rootDir,
        env: { ...process.env, JWT_SECRET: '' },
        encoding: 'utf8'
      });

      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes('FATAL: JWT_SECRET environment variable is required and not set'));
    });

    it('fails fast at startup if JWT_SECRET is under 32 characters', () => {
      const result = spawnSync(process.execPath, [
        '-e',
        'require("./config/constants");'
      ], {
        cwd: rootDir,
        env: { ...process.env, JWT_SECRET: 'too_short_secret_under_32' },
        encoding: 'utf8'
      });

      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes('FATAL: JWT_SECRET must be at least 32 characters long to ensure adequate entropy'));
    });

    it('fails fast in production if RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET use placeholder values', () => {
      const result = spawnSync(process.execPath, [
        '-e',
        'require("./config/constants");'
      ], {
        cwd: rootDir,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          JWT_SECRET: 'valid_strong_secret_key_exceeding_32_characters_length',
          RAZORPAY_KEY_ID: 'rzp_test_YOUR_KEY'
        },
        encoding: 'utf8'
      });

      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes('FATAL: RAZORPAY_KEY_ID environment variable is required in production'));
    });
  });
});
