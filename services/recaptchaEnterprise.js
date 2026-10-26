/**
 * Google reCAPTCHA Enterprise Verification Service
 * Calls https://recaptchaenterprise.googleapis.com/v1/projects/{project-id}/assessments?key={apiKey}
 */

'use strict';

const {
  RECAPTCHA_PROJECT_ID,
  RECAPTCHA_SITE_KEY,
  RECAPTCHA_API_KEY
} = require('../config/constants');

/**
 * Verify reCAPTCHA Enterprise Assessment
 * @param {string} token - Client token received from grecaptcha.enterprise
 * @param {string} expectedAction - Action name (e.g. 'LOGIN')
 * @returns {Promise<{success: boolean, score?: number, action?: string, reasons?: string[], error?: string, bypassed?: boolean}>}
 */
async function verifyEnterpriseRecaptcha(token, expectedAction = 'LOGIN') {
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  // 1. Explicit development-only bypass check.
  // In production (NODE_ENV === 'production' or VERCEL_ENV === 'production'), bypass is strictly FORBIDDEN.
  const isExplicitDevBypass = !isProd && (
    process.env.RECAPTCHA_BYPASS === 'true' ||
    process.env.ALLOW_RECAPTCHA_BYPASS === 'true' ||
    process.env.RECAPTCHA_DEV_BYPASS === 'true' ||
    token === 'DEV_BYPASS_TOKEN' ||
    token === 'dev-bypass-token' ||
    (process.env.NODE_ENV === 'test' && process.env.RECAPTCHA_BYPASS !== 'false')
  );

  if (isExplicitDevBypass) {
    return { success: true, score: 1.0, bypassed: true };
  }

  // 2. Validate token presence and type (fail closed on missing/invalid token)
  if (!token || typeof token !== 'string' || !token.trim()) {
    return { success: false, error: 'reCAPTCHA token is required.' };
  }

  // 3. Resolve configuration
  const projectId = (process.env.RECAPTCHA_PROJECT_ID !== undefined ? process.env.RECAPTCHA_PROJECT_ID : (RECAPTCHA_PROJECT_ID || '')).trim();
  const siteKey = (process.env.RECAPTCHA_SITE_KEY !== undefined ? process.env.RECAPTCHA_SITE_KEY : (RECAPTCHA_SITE_KEY || '')).trim();
  const apiKey = (process.env.RECAPTCHA_API_KEY !== undefined ? process.env.RECAPTCHA_API_KEY : (RECAPTCHA_API_KEY || '')).trim();

  // 4. Fail closed when required configuration is missing or incomplete
  if (!apiKey || !projectId || !siteKey) {
    return {
      success: false,
      error: 'reCAPTCHA verification is unavailable due to missing or incomplete configuration.'
    };
  }

  try {
    const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/assessments?key=${encodeURIComponent(apiKey)}`;

    const payload = {
      event: {
        token: token.trim(),
        expectedAction,
        siteKey
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      // Strictly avoid logging secrets or token values
      console.error(`reCAPTCHA Enterprise assessment request failed (HTTP ${res.status}).`);
      return { success: false, error: 'reCAPTCHA Enterprise assessment verification failed.' };
    }

    const data = await res.json();
    const tokenProps = data.tokenProperties || {};
    const riskAnalysis = data.riskAnalysis || {};

    if (!tokenProps.valid) {
      return {
        success: false,
        invalidReason: tokenProps.invalidReason,
        error: `reCAPTCHA invalid: ${tokenProps.invalidReason || 'Failed verification'}`
      };
    }

    // Verify expected action matches if provided
    if (expectedAction && tokenProps.action && tokenProps.action !== expectedAction) {
      return {
        success: false,
        error: 'reCAPTCHA action mismatch.'
      };
    }

    const score = typeof riskAnalysis.score === 'number' ? riskAnalysis.score : 1.0;

    // Minimum risk score threshold (default 0.3 for human interaction)
    if (score < 0.3) {
      return {
        success: false,
        score,
        error: 'Low security score detected. Verification failed.'
      };
    }

    return {
      success: true,
      score,
      action: tokenProps.action,
      reasons: riskAnalysis.reasons
    };
  } catch (err) {
    // Strictly avoid logging secrets, query parameters, or token values
    console.error('reCAPTCHA Enterprise communication error: network or service failure.');
    return { success: false, error: 'Failed to communicate with reCAPTCHA Enterprise service.' };
  }
}

module.exports = {
  verifyEnterpriseRecaptcha
};
