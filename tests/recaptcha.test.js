/**
 * reCAPTCHA Enterprise Verification & Fail-Closed Security Test Suite
 *
 * Verifies:
 * 1. Production fail-closed behavior when configuration is missing (rejects arbitrary tokens).
 * 2. Strict rejection of invalid, expired, low-score, or action-mismatched tokens.
 * 3. Fail-closed behavior on verification service errors and network failures.
 * 4. Successful verification with valid tokens from reCAPTCHA Enterprise.
 * 5. Explicit development-only bypass functionality (and its strict rejection in production).
 * 6. Zero logging of secrets (API keys) or token values in stdout/stderr.
 * 7. End-to-end authentication endpoint (POST /auth/login) fail-closed behavior.
 */

'use strict';

const { describe, it, beforeEach, afterEach, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const mongoose = require('mongoose');

const { verifyEnterpriseRecaptcha } = require('../services/recaptchaEnterprise');
const app = require('../server');

describe('Google reCAPTCHA Enterprise Verification & Fail-Closed Enforcement', () => {
  let savedEnv;
  let originalFetch;
  let savedConsoleError;
  let savedConsoleWarn;
  let loggedErrors = [];
  let loggedWarns = [];

  let server;
  let baseUrl;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });

  beforeEach(() => {
    savedEnv = { ...process.env };
    originalFetch = globalThis.fetch;
    loggedErrors = [];
    loggedWarns = [];
    savedConsoleError = console.error;
    savedConsoleWarn = console.warn;
    console.error = (...args) => {
      loggedErrors.push(args.map(String).join(' '));
    };
    console.warn = (...args) => {
      loggedWarns.push(args.map(String).join(' '));
    };
  });

  afterEach(() => {
    process.env = savedEnv;
    globalThis.fetch = originalFetch;
    console.error = savedConsoleError;
    console.warn = savedConsoleWarn;
  });

  describe('1. Missing Configuration Fail-Closed Enforcement', () => {
    it('fails closed in production when RECAPTCHA_API_KEY is missing, rejecting arbitrary tokens', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.VERCEL_ENV;
      process.env.RECAPTCHA_PROJECT_ID = 'test-proj-123';
      process.env.RECAPTCHA_SITE_KEY = 'test-site-key-456';
      process.env.RECAPTCHA_API_KEY = ''; // Missing API key

      const result = await verifyEnterpriseRecaptcha('arbitrary-attacker-token-xyz', 'LOGIN');

      assert.strictEqual(result.success, false, 'Must fail closed when API key is missing');
      assert.ok(result.error.includes('missing or incomplete configuration'));
    });

    it('fails closed in production when RECAPTCHA_PROJECT_ID is missing', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.VERCEL_ENV;
      process.env.RECAPTCHA_PROJECT_ID = ''; // Missing Project ID
      process.env.RECAPTCHA_SITE_KEY = 'test-site-key-456';
      process.env.RECAPTCHA_API_KEY = 'test-api-key-789';

      const result = await verifyEnterpriseRecaptcha('arbitrary-token-xyz', 'LOGIN');

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('missing or incomplete configuration'));
    });

    it('fails closed in production when RECAPTCHA_SITE_KEY is missing', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.VERCEL_ENV;
      process.env.RECAPTCHA_PROJECT_ID = 'test-proj-123';
      process.env.RECAPTCHA_SITE_KEY = ''; // Missing Site Key
      process.env.RECAPTCHA_API_KEY = 'test-api-key-789';

      const result = await verifyEnterpriseRecaptcha('arbitrary-token-xyz', 'LOGIN');

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('missing or incomplete configuration'));
    });

    it('fails closed in production even when RECAPTCHA_BYPASS=true is set', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_BYPASS = 'true';
      process.env.RECAPTCHA_API_KEY = '';

      const result = await verifyEnterpriseRecaptcha('arbitrary-token-xyz', 'LOGIN');

      assert.strictEqual(result.success, false, 'Production must never allow bypass');
    });

    it('fails closed in production even when DEV_BYPASS_TOKEN is supplied', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_API_KEY = '';

      const result = await verifyEnterpriseRecaptcha('DEV_BYPASS_TOKEN', 'LOGIN');

      assert.strictEqual(result.success, false, 'Dev bypass token must not work in production');
    });

    it('fails closed in development when RECAPTCHA_BYPASS is false and API key is missing', async () => {
      process.env.NODE_ENV = 'development';
      process.env.RECAPTCHA_BYPASS = 'false';
      process.env.RECAPTCHA_API_KEY = '';

      const result = await verifyEnterpriseRecaptcha('arbitrary-token-xyz', 'LOGIN');

      assert.strictEqual(result.success, false);
      assert.ok(result.error.includes('missing or incomplete configuration'));
    });
  });

  describe('2. Invalid Tokens & Payload Validation', () => {
    it('rejects undefined, null, or empty string token', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_PROJECT_ID = 'test-proj';
      process.env.RECAPTCHA_SITE_KEY = 'test-site';
      process.env.RECAPTCHA_API_KEY = 'test-key';

      const res1 = await verifyEnterpriseRecaptcha(undefined, 'LOGIN');
      assert.strictEqual(res1.success, false);
      assert.strictEqual(res1.error, 'reCAPTCHA token is required.');

      const res2 = await verifyEnterpriseRecaptcha(null, 'LOGIN');
      assert.strictEqual(res2.success, false);
      assert.strictEqual(res2.error, 'reCAPTCHA token is required.');

      const res3 = await verifyEnterpriseRecaptcha('', 'LOGIN');
      assert.strictEqual(res3.success, false);
      assert.strictEqual(res3.error, 'reCAPTCHA token is required.');

      const res4 = await verifyEnterpriseRecaptcha('   ', 'LOGIN');
      assert.strictEqual(res4.success, false);
      assert.strictEqual(res4.error, 'reCAPTCHA token is required.');
    });

    it('rejects non-string token types', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_PROJECT_ID = 'test-proj';
      process.env.RECAPTCHA_SITE_KEY = 'test-site';
      process.env.RECAPTCHA_API_KEY = 'test-key';

      const resNumber = await verifyEnterpriseRecaptcha(12345, 'LOGIN');
      assert.strictEqual(resNumber.success, false);
      assert.strictEqual(resNumber.error, 'reCAPTCHA token is required.');

      const resObj = await verifyEnterpriseRecaptcha({ token: 'abc' }, 'LOGIN');
      assert.strictEqual(resObj.success, false);
      assert.strictEqual(resObj.error, 'reCAPTCHA token is required.');
    });

    it('rejects token when reCAPTCHA Enterprise returns tokenProperties.valid = false', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_PROJECT_ID = 'test-proj';
      process.env.RECAPTCHA_SITE_KEY = 'test-site';
      process.env.RECAPTCHA_API_KEY = 'test-key';

      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          tokenProperties: {
            valid: false,
            invalidReason: 'EXPIRED'
          }
        })
      });

      const result = await verifyEnterpriseRecaptcha('expired-token', 'LOGIN');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.invalidReason, 'EXPIRED');
      assert.ok(result.error.includes('reCAPTCHA invalid: EXPIRED'));
    });

    it('rejects token when action mismatches expected action', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_PROJECT_ID = 'test-proj';
      process.env.RECAPTCHA_SITE_KEY = 'test-site';
      process.env.RECAPTCHA_API_KEY = 'test-key';

      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          tokenProperties: {
            valid: true,
            action: 'CHECKOUT'
          },
          riskAnalysis: {
            score: 0.9
          }
        })
      });

      const result = await verifyEnterpriseRecaptcha('valid-token-wrong-action', 'LOGIN');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'reCAPTCHA action mismatch.');
    });

    it('rejects token when risk score is below 0.3 threshold', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_PROJECT_ID = 'test-proj';
      process.env.RECAPTCHA_SITE_KEY = 'test-site';
      process.env.RECAPTCHA_API_KEY = 'test-key';

      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          tokenProperties: {
            valid: true,
            action: 'LOGIN'
          },
          riskAnalysis: {
            score: 0.1,
            reasons: ['AUTOMATION']
          }
        })
      });

      const result = await verifyEnterpriseRecaptcha('bot-token', 'LOGIN');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.score, 0.1);
      assert.ok(result.error.includes('Low security score detected'));
    });
  });

  describe('3. Verification Service Errors & Resilience', () => {
    it('fails closed when reCAPTCHA Enterprise service returns HTTP 400 Bad Request', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_PROJECT_ID = 'test-proj';
      process.env.RECAPTCHA_SITE_KEY = 'test-site';
      process.env.RECAPTCHA_API_KEY = 'test-key';

      globalThis.fetch = async () => ({
        ok: false,
        status: 400,
        text: async () => '{"error": "Bad Request"}'
      });

      const result = await verifyEnterpriseRecaptcha('valid-format-token', 'LOGIN');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'reCAPTCHA Enterprise assessment verification failed.');
    });

    it('fails closed when reCAPTCHA Enterprise service returns HTTP 403 Forbidden', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_PROJECT_ID = 'test-proj';
      process.env.RECAPTCHA_SITE_KEY = 'test-site';
      process.env.RECAPTCHA_API_KEY = 'test-key';

      globalThis.fetch = async () => ({
        ok: false,
        status: 403,
        text: async () => '{"error": "Forbidden"}'
      });

      const result = await verifyEnterpriseRecaptcha('valid-format-token', 'LOGIN');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'reCAPTCHA Enterprise assessment verification failed.');
    });

    it('fails closed when reCAPTCHA Enterprise service returns HTTP 500 Internal Error', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_PROJECT_ID = 'test-proj';
      process.env.RECAPTCHA_SITE_KEY = 'test-site';
      process.env.RECAPTCHA_API_KEY = 'test-key';

      globalThis.fetch = async () => ({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      const result = await verifyEnterpriseRecaptcha('valid-format-token', 'LOGIN');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'reCAPTCHA Enterprise assessment verification failed.');
    });

    it('fails closed when fetch throws a network exception', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_PROJECT_ID = 'test-proj';
      process.env.RECAPTCHA_SITE_KEY = 'test-site';
      process.env.RECAPTCHA_API_KEY = 'test-key';

      globalThis.fetch = async () => {
        throw new Error('connect ECONNREFUSED 142.250.190.42:443');
      };

      const result = await verifyEnterpriseRecaptcha('valid-format-token', 'LOGIN');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Failed to communicate with reCAPTCHA Enterprise service.');
    });

    it('fails closed when fetch aborts or times out', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_PROJECT_ID = 'test-proj';
      process.env.RECAPTCHA_SITE_KEY = 'test-site';
      process.env.RECAPTCHA_API_KEY = 'test-key';

      globalThis.fetch = async (_url, options) => {
        return new Promise((_resolve, reject) => {
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          }
          // Intentionally do not resolve to trigger timeout/abort
          setTimeout(() => {
            const timeoutErr = new Error('Timeout');
            reject(timeoutErr);
          }, 50);
        });
      };

      const result = await verifyEnterpriseRecaptcha('valid-format-token', 'LOGIN');

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'Failed to communicate with reCAPTCHA Enterprise service.');
    });
  });

  describe('4. Valid Token Verification', () => {
    it('succeeds when assessment returns valid: true with risk score >= 0.3', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_PROJECT_ID = 'telangana-yogasa-1791657494164';
      process.env.RECAPTCHA_SITE_KEY = '6Ld84ugtAAAAAOo_agUOzrCfeCrZq6W2RbSeLP28';
      process.env.RECAPTCHA_API_KEY = 'valid-test-api-key';

      let capturedUrl;
      let capturedBody;

      globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          json: async () => ({
            tokenProperties: {
              valid: true,
              action: 'LOGIN'
            },
            riskAnalysis: {
              score: 0.9,
              reasons: []
            }
          })
        };
      };

      const result = await verifyEnterpriseRecaptcha('valid-client-token-abc', 'LOGIN');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.score, 0.9);
      assert.strictEqual(result.action, 'LOGIN');

      // Verify payload and URL structure
      assert.ok(capturedUrl.includes('projects/telangana-yogasa-1791657494164/assessments'));
      assert.ok(capturedUrl.includes('key=valid-test-api-key'));
      assert.strictEqual(capturedBody.event.token, 'valid-client-token-abc');
      assert.strictEqual(capturedBody.event.expectedAction, 'LOGIN');
      assert.strictEqual(capturedBody.event.siteKey, '6Ld84ugtAAAAAOo_agUOzrCfeCrZq6W2RbSeLP28');
    });

    it('succeeds when risk score is exactly at 0.3 threshold', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_PROJECT_ID = 'test-proj';
      process.env.RECAPTCHA_SITE_KEY = 'test-site';
      process.env.RECAPTCHA_API_KEY = 'test-key';

      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          tokenProperties: {
            valid: true,
            action: 'LOGIN'
          },
          riskAnalysis: {
            score: 0.3
          }
        })
      });

      const result = await verifyEnterpriseRecaptcha('threshold-token', 'LOGIN');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.score, 0.3);
    });
  });

  describe('5. Explicit Development-Only Bypass', () => {
    it('allows explicit bypass in development when RECAPTCHA_BYPASS=true', async () => {
      process.env.NODE_ENV = 'development';
      process.env.RECAPTCHA_BYPASS = 'true';
      delete process.env.RECAPTCHA_API_KEY;

      const result = await verifyEnterpriseRecaptcha('any-token-or-empty', 'LOGIN');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.bypassed, true);
    });

    it('allows explicit bypass in development with DEV_BYPASS_TOKEN even when RECAPTCHA_BYPASS=false', async () => {
      process.env.NODE_ENV = 'development';
      process.env.RECAPTCHA_BYPASS = 'false';
      delete process.env.RECAPTCHA_API_KEY;

      const result = await verifyEnterpriseRecaptcha('DEV_BYPASS_TOKEN', 'LOGIN');

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.bypassed, true);
    });

    it('strictly denies bypass in production (NODE_ENV=production) regardless of RECAPTCHA_BYPASS flag', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_BYPASS = 'true';
      process.env.RECAPTCHA_API_KEY = '';

      const result = await verifyEnterpriseRecaptcha('DEV_BYPASS_TOKEN', 'LOGIN');

      assert.strictEqual(result.success, false, 'Production must never bypass');
      assert.ok(result.error.includes('missing or incomplete configuration'));
    });

    it('strictly denies bypass in Vercel production (VERCEL_ENV=production)', async () => {
      process.env.NODE_ENV = 'development';
      process.env.VERCEL_ENV = 'production';
      process.env.RECAPTCHA_BYPASS = 'true';
      process.env.RECAPTCHA_API_KEY = '';

      const result = await verifyEnterpriseRecaptcha('DEV_BYPASS_TOKEN', 'LOGIN');

      assert.strictEqual(result.success, false, 'Vercel production must never bypass');
    });
  });

  describe('6. Zero Secret and Token Leakage in Logging', () => {
    it('does not log API key or token values when service returns HTTP error', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_PROJECT_ID = 'test-proj';
      process.env.RECAPTCHA_SITE_KEY = 'test-site';
      const secretApiKey = 'SUPER_SECRET_AIzaSyD_SECRET_KEY_123';
      const secretClientToken = 'SUPER_SECRET_CLIENT_TOKEN_xyz_987';
      process.env.RECAPTCHA_API_KEY = secretApiKey;

      globalThis.fetch = async () => ({
        ok: false,
        status: 403,
        text: async () => `Error: Invalid API key ${secretApiKey} for token ${secretClientToken}`
      });

      await verifyEnterpriseRecaptcha(secretClientToken, 'LOGIN');

      const allLogs = loggedErrors.concat(loggedWarns).join(' ');
      assert.ok(!allLogs.includes(secretApiKey), 'API key must never appear in console logs');
      assert.ok(!allLogs.includes(secretClientToken), 'Client token value must never appear in console logs');
    });

    it('does not log API key or token values when network communication fails', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_PROJECT_ID = 'test-proj';
      process.env.RECAPTCHA_SITE_KEY = 'test-site';
      const secretApiKey = 'SUPER_SECRET_AIzaSyD_SECRET_KEY_456';
      const secretClientToken = 'SUPER_SECRET_CLIENT_TOKEN_abc_321';
      process.env.RECAPTCHA_API_KEY = secretApiKey;

      globalThis.fetch = async () => {
        throw new Error(`fetch to https://recaptchaenterprise.googleapis.com/?key=${secretApiKey} failed with token ${secretClientToken}`);
      };

      await verifyEnterpriseRecaptcha(secretClientToken, 'LOGIN');

      const allLogs = loggedErrors.concat(loggedWarns).join(' ');
      assert.ok(!allLogs.includes(secretApiKey), 'API key must never appear in console logs during network errors');
      assert.ok(!allLogs.includes(secretClientToken), 'Token value must never appear in console logs during network errors');
    });
  });

  describe('7. End-to-End Caller Integration (POST /auth/login)', () => {
    it('POST /auth/login fails closed (400) in production when configuration is missing and arbitrary token is provided', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_API_KEY = '';

      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@telanganayoga.org',
          password: 'SomePassword123!',
          recaptchaToken: 'arbitrary-attacker-token'
        })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('reCAPTCHA verification is unavailable'));
    });

    it('POST /auth/login fails closed (400) in production when invalid token is provided', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_PROJECT_ID = 'test-proj';
      process.env.RECAPTCHA_SITE_KEY = 'test-site';
      process.env.RECAPTCHA_API_KEY = 'test-api-key';

      globalThis.fetch = async (url, options) => {
        if (typeof url === 'string' && url.includes('recaptchaenterprise.googleapis.com')) {
          return {
            ok: true,
            json: async () => ({
              tokenProperties: { valid: false, invalidReason: 'INVALID' }
            })
          };
        }
        return originalFetch(url, options);
      };

      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@telanganayoga.org',
          password: 'SomePassword123!',
          recaptchaToken: 'invalid-token-123'
        })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('reCAPTCHA invalid'));
    });

    it('POST /auth/login fails closed (400) in production when reCAPTCHA service returns 500 error', async () => {
      process.env.NODE_ENV = 'production';
      process.env.RECAPTCHA_PROJECT_ID = 'test-proj';
      process.env.RECAPTCHA_SITE_KEY = 'test-site';
      process.env.RECAPTCHA_API_KEY = 'test-api-key';

      globalThis.fetch = async (url, options) => {
        if (typeof url === 'string' && url.includes('recaptchaenterprise.googleapis.com')) {
          return {
            ok: false,
            status: 500,
            text: async () => 'Service Error'
          };
        }
        return originalFetch(url, options);
      };

      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@telanganayoga.org',
          password: 'SomePassword123!',
          recaptchaToken: 'format-valid-token'
        })
      });

      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.ok(data.error.includes('reCAPTCHA Enterprise assessment verification failed'));
    });

    it('POST /auth/login allows bypass in development when RECAPTCHA_BYPASS=true', async () => {
      process.env.NODE_ENV = 'development';
      process.env.RECAPTCHA_BYPASS = 'true';

      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'nonexistent@telanganayoga.org',
          password: 'Password123!',
          recaptchaToken: 'dev-token'
        })
      });

      // Passes reCAPTCHA gate; fails later on authentication (401 Invalid email or password)
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.success, false);
      assert.strictEqual(data.error, 'Invalid email or password');
    });
  });
});
