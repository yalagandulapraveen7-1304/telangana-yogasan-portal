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

module.exports = {
  generateCaptcha,
  verifyCaptcha
};
