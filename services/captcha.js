/**
 * Secure, Accessibility-Friendly, Zero-Dependency Math & Text CAPTCHA Service
 * Generates signed CAPTCHA challenges with HMAC-SHA256 signatures and timestamps (5-minute expiry).
 * Complies with GIGW 3.0 & WCAG 2.1 AA (audio/text alternative friendly, zero external CDN dependencies).
 */

'use strict';

const crypto = require('crypto');
const { JWT_SECRET } = require('../config/constants');

const CAPTCHA_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes validity

/**
 * Generate a new CAPTCHA challenge
 * Returns { id, question, audioText }
 * where id is an HMAC-signed token containing { ans, exp }
 */
function generateCaptcha() {
  const operations = ['+', '-'];
  const op = operations[Math.floor(Math.random() * operations.length)];

  let a, b, answer, question, audioText;

  if (op === '+') {
    a = Math.floor(Math.random() * 15) + 3; // 3 to 17
    b = Math.floor(Math.random() * 12) + 1; // 1 to 12
    answer = a + b;
    question = `What is ${a} + ${b}?`;
    audioText = `What is ${a} plus ${b}?`;
  } else {
    // For subtraction, ensure positive non-zero result
    a = Math.floor(Math.random() * 15) + 10; // 10 to 24
    b = Math.floor(Math.random() * 8) + 1;   // 1 to 8
    answer = a - b;
    question = `What is ${a} - ${b}?`;
    audioText = `What is ${a} minus ${b}?`;
  }

  const exp = Date.now() + CAPTCHA_EXPIRY_MS;
  const payload = `${answer}:${exp}`;
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
  const captchaId = Buffer.from(`${payload}:${sig}`).toString('base64url');

  return {
    captchaId,
    question,
    audioText
  };
}

/**
 * Verify submitted CAPTCHA answer
 * Returns true if valid and unexpired; false otherwise.
 */
function verifyCaptcha(captchaId, userInput) {
  if (!captchaId || typeof captchaId !== 'string') return false;
  if (userInput === undefined || userInput === null) return false;

  const cleanInput = String(userInput).trim();
  if (!cleanInput) return false;

  try {
    const raw = Buffer.from(captchaId, 'base64url').toString('utf8');
    const parts = raw.split(':');
    if (parts.length !== 3) return false;

    const [expectedAnswer, expStr, sig] = parts;
    const exp = parseInt(expStr, 10);

    // 1. Expiry check
    if (isNaN(exp) || Date.now() > exp) {
      return false;
    }

    // 2. Signature verification (constant-time comparison)
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${expectedAnswer}:${expStr}`)
      .digest('hex');

    const sigBuf = Buffer.from(sig);
    const expectedSigBuf = Buffer.from(expectedSig);

    if (sigBuf.length !== expectedSigBuf.length) return false;
    if (!crypto.timingSafeEqual(sigBuf, expectedSigBuf)) return false;

    // 3. User answer comparison
    return cleanInput.toLowerCase() === expectedAnswer.toLowerCase();
  } catch (err) {
    return false;
  }
}

/**
 * Verify Google reCAPTCHA Token
 * Calls https://www.google.com/recaptcha/api/siteverify
 * Returns { success: boolean, score?: number, error?: string }
 */
async function verifyRecaptcha(token, remoteip = '', secretKeyOverride = null) {
  const constants = require('../config/constants');
  const secretKey = secretKeyOverride !== null ? secretKeyOverride : (process.env.RECAPTCHA_SECRET_KEY || constants.RECAPTCHA_SECRET_KEY);

  // If secret key is not set or placeholder in dev, allow graceful bypass or test pass
  if (!secretKey || secretKey === 'REPLACE_WITH_YOUR_RECAPTCHA_SECRET_KEY') {
    return { success: true, bypassed: true };
  }

  if (!token || typeof token !== 'string') {
    return { success: false, error: 'reCAPTCHA token missing.' };
  }

  try {
    const postData = new URLSearchParams({
      secret: secretKey,
      response: token
    });
    if (remoteip) {
      postData.append('remoteip', remoteip);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postData.toString(),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return { success: false, error: 'reCAPTCHA verification server error.' };
    }

    const data = await res.json();
    return {
      success: !!data.success,
      score: data.score,
      action: data.action,
      errorCodes: data['error-codes']
    };
  } catch (err) {
    console.error('reCAPTCHA verification request error:', err.message);
    return { success: false, error: 'Failed to verify reCAPTCHA with Google servers.' };
  }
}

module.exports = {
  generateCaptcha,
  verifyCaptcha,
  verifyRecaptcha
};
