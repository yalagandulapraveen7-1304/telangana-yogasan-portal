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
 * @returns {Promise<{success: boolean, score?: number, error?: string, bypassed?: boolean}>}
 */
async function verifyEnterpriseRecaptcha(token, expectedAction = 'LOGIN') {
  const projectId = process.env.RECAPTCHA_PROJECT_ID || RECAPTCHA_PROJECT_ID || 'telangana-yogasa-1791657494164';
  const siteKey = process.env.RECAPTCHA_SITE_KEY || RECAPTCHA_SITE_KEY || '6Ld84ugtAAAAAOo_agUOzrCfeCrZq6W2RbSeLP28';
  const apiKey = process.env.RECAPTCHA_API_KEY || RECAPTCHA_API_KEY || '';

  // In test environments or when API key is not yet configured, allow safe bypass
  const isTestEnv = process.env.NODE_ENV === 'test' || !process.env.NODE_ENV;
  if (!apiKey || isTestEnv) {
    if (!token && !isTestEnv) {
      return { success: false, error: 'reCAPTCHA token missing.' };
    }
    return { success: true, bypassed: true };
  }

  if (!token || typeof token !== 'string') {
    return { success: false, error: 'reCAPTCHA token is required.' };
  }

  try {
    const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/assessments?key=${encodeURIComponent(apiKey)}`;

    const payload = {
      event: {
        token,
        expectedAction,
        siteKey
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000); // 7s timeout

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      console.error('reCAPTCHA Enterprise assessment request failed:', res.status, errText);
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
    console.error('reCAPTCHA Enterprise error:', err.message);
    return { success: false, error: 'Failed to communicate with reCAPTCHA Enterprise service.' };
  }
}

module.exports = {
  verifyEnterpriseRecaptcha
};
