/**
 * Unit & Integration Tests: CAPTCHA Service & Auth Verification
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { generateCaptcha, verifyCaptcha } = require('../../services/captcha');

describe('Security Tests: Accessible CAPTCHA Verification', () => {
  it('generates a valid signed captcha challenge with id, question and audioText', () => {
    const c = generateCaptcha();
    assert.ok(c.captchaId && typeof c.captchaId === 'string');
    assert.ok(c.question && typeof c.question === 'string');
    assert.ok(c.audioText && typeof c.audioText === 'string');
    assert.ok(c.question.startsWith('What is '));
  });

  it('validates a correct answer against generated challenge', () => {
    const c = generateCaptcha();
    // Parse the arithmetic expression
    const cleanExpr = c.question.replace('What is ', '').replace('?', '').trim();
    const parts = cleanExpr.split(' ');
    const a = parseInt(parts[0], 10);
    const op = parts[1];
    const b = parseInt(parts[2], 10);
    const answer = op === '+' ? a + b : a - b;

    const isValid = verifyCaptcha(c.captchaId, answer);
    assert.equal(isValid, true);
    // Also works when passed as string
    assert.equal(verifyCaptcha(c.captchaId, String(answer)), true);
  });

  it('rejects an incorrect answer', () => {
    const c = generateCaptcha();
    const isInvalid = verifyCaptcha(c.captchaId, '999999');
    assert.equal(isInvalid, false);
  });

  it('rejects tampered or malformed captcha tokens', () => {
    assert.equal(verifyCaptcha('invalid-base64', '5'), false);
    assert.equal(verifyCaptcha('', '5'), false);
    assert.equal(verifyCaptcha(null, '5'), false);
    assert.equal(verifyCaptcha(undefined, '5'), false);
  });

  it('rejects expired captcha tokens', () => {
    // Construct manually expired payload
    const crypto = require('crypto');
    const { JWT_SECRET } = require('../../config/constants');
    const expiredExp = Date.now() - 10000; // 10s in the past
    const payload = `10:${expiredExp}`;
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
    const expiredId = Buffer.from(`${payload}:${sig}`).toString('base64url');

    assert.equal(verifyCaptcha(expiredId, '10'), false);
  });

  it('handles Google reCAPTCHA verification gracefully when secret key is unset or bypassed', async () => {
    const { verifyRecaptcha } = require('../../services/captcha');
    const result = await verifyRecaptcha('dummy-token');
    // Without RECAPTCHA_SECRET_KEY set in test env, verifyRecaptcha gracefully bypasses
    assert.equal(result.success, true);
  });

  it('rejects missing or empty tokens in verifyRecaptcha', async () => {
    const { verifyRecaptcha } = require('../../services/captcha');
    const resNull = await verifyRecaptcha(null, '', 'test_secret_key_mock');
    assert.equal(resNull.success, false);
    const resEmpty = await verifyRecaptcha('', '', 'test_secret_key_mock');
    assert.equal(resEmpty.success, false);
  });
});
