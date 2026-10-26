/**
 * Security Sanitization & Request Defense Middleware
 * Protects against NoSQL injection, ReDoS, and CSRF/Origin spoofing.
 */

/**
 * Recursively cleans an object by stripping any keys starting with '$' or containing '.'
 * Prevents NoSQL operator injection attacks in MongoDB/Mongoose queries.
 */
function sanitizeNoSql(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  if (Array.isArray(payload)) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] = sanitizeNoSql(payload[i]);
    }
    return payload;
  }

  for (const key of Object.keys(payload)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete payload[key];
    } else {
      payload[key] = sanitizeNoSql(payload[key]);
    }
  }

  return payload;
}

/**
 * Express middleware for automatic NoSQL sanitization of incoming requests.
 */
function noSqlSanitizer(req, _res, next) {
  if (req.body) sanitizeNoSql(req.body);
  if (req.query) sanitizeNoSql(req.query);
  if (req.params) sanitizeNoSql(req.params);
  next();
}

/**
 * Escapes characters with special meaning in Regular Expressions.
 * Prevents ReDoS (Regular Expression Denial of Service) and regex injection.
 */
function escapeRegex(string = '') {
  return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strips HTML tags from text input to prevent Stored XSS attacks.
 */
function stripHtml(input = '') {
  if (typeof input !== 'string') return '';
  return input.replace(/<[^>]*>?/gm, '').trim();
}

/**
 * Trims, strips HTML tags, and bounds text to a maximum length.
 */
function sanitizeBoundedText(input = '', maxLen = 200) {
  if (typeof input !== 'string') return '';
  return stripHtml(input).trim().substring(0, maxLen);
}

const { IS_PROD } = require('../config/constants');

// Exact, owned production origins (strictly confirmed as owned and active)
const EXACT_OWNED_PRODUCTION_HOSTS = new Set([
  'telanganayoga.org.in',
  'www.telanganayoga.org.in',
  'telangana-yogasan-portal.vercel.app'
]);

// Tightly controlled preview deployment pattern: strictly prefixed with this project name
const PREVIEW_HOSTNAME_PATTERN = /^telangana-yogasan-portal-[a-z0-9_-]+\.vercel\.app$/i;

/**
 * Validates whether an incoming Host or Origin hostname is allowed based on the runtime environment.
 * - In Production: Only exact, owned production origins are accepted. Wildcard previews and legacy domains are strictly rejected.
 * - In Preview (VERCEL_ENV === 'preview'): Accepts exact deployment host (VERCEL_URL / VERCEL_BRANCH_URL) or tightly controlled project preview pattern.
 * - In Development / Test: Localhost and loopback interfaces are allowed.
 */
function isAllowedOriginHost(rawHost) {
  if (!rawHost || typeof rawHost !== 'string') return false;
  const host = rawHost.trim().toLowerCase();
  const hostname = host.split(':')[0]; // strip port if present

  // 1. Exact match against confirmed, owned production origins
  if (EXACT_OWNED_PRODUCTION_HOSTS.has(host) || EXACT_OWNED_PRODUCTION_HOSTS.has(hostname)) {
    return true;
  }

  // 2. Exact match against configured canonical SITE_URL (if provided)
  if (process.env.SITE_URL) {
    try {
      const parsedSite = new URL(process.env.SITE_URL);
      if (parsedSite.host.toLowerCase() === host || parsedSite.hostname.toLowerCase() === hostname) {
        return true;
      }
    } catch {}
  }

  // 3. Vercel Preview Deployments:
  // ONLY permitted when running in the preview environment (VERCEL_ENV === 'preview').
  // Wildcard preview patterns are NEVER permitted in production!
  const isVercelPreviewEnv = process.env.VERCEL_ENV === 'preview';
  if (isVercelPreviewEnv) {
    // Exact deployment URL provisioned by Vercel for this specific PR/branch
    if (process.env.VERCEL_URL) {
      const expectedVercelHost = process.env.VERCEL_URL.trim().toLowerCase().split(':')[0];
      if (hostname === expectedVercelHost || host === expectedVercelHost) {
        return true;
      }
    }
    if (process.env.VERCEL_BRANCH_URL) {
      const expectedBranchHost = process.env.VERCEL_BRANCH_URL.trim().toLowerCase().split(':')[0];
      if (hostname === expectedBranchHost || host === expectedBranchHost) {
        return true;
      }
    }
    // Tightly controlled pattern restricted strictly to this project's prefix
    if (PREVIEW_HOSTNAME_PATTERN.test(hostname)) {
      return true;
    }
  }

  // 4. Local development and test runner environments
  const isNonProd = process.env.NODE_ENV !== 'production' && !process.env.VERCEL;
  const isTestRunner = Boolean(process.env.NODE_TEST_CONTEXT || process.env.npm_lifecycle_event === 'test' || process.env.NODE_ENV === 'test');
  if (isNonProd || isTestRunner) {
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }
  }

  return false;
}

/**
 * Origin Guard Middleware
 * Verifies that state-changing requests (POST, PATCH, PUT, DELETE) originate
 * from an explicit allowlist of authorized site origins, defending against CSRF,
 * Host-header spoofing, and cross-site form submissions.
 */
function originGuard(req, res, next) {
  const stateChangingMethods = ['POST', 'PATCH', 'PUT', 'DELETE'];
  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }

  // 1. Defend against Sec-Fetch-Site cross-site requests
  const secFetchSite = (req.headers['sec-fetch-site'] || '').toLowerCase();
  if (secFetchSite === 'cross-site') {
    return res.status(403).json({
      success: false,
      error: 'Cross-origin state-changing requests are prohibited.'
    });
  }

  const rawOrigin = req.headers.origin || req.headers.referer;

  // 2. Missing Origin/Referer defense:
  // In production, browser requests with cookie authentication MUST provide Origin or Referer.
  const isCookieAuthenticated = Boolean(req.cookies && (req.cookies.token || req.cookies.adminToken));
  if (!rawOrigin) {
    if ((IS_PROD || process.env.NODE_ENV === 'production') && isCookieAuthenticated) {
      return res.status(403).json({
        success: false,
        error: 'Origin or Referer header is required for state-changing operations.'
      });
    }
    // Check Host header even when Origin is absent
    if (req.headers.host && !isAllowedOriginHost(req.headers.host)) {
      return res.status(403).json({
        success: false,
        error: 'Host header not recognized or authorized.'
      });
    }
    return next();
  }

  // 3. Validate Origin / Referer against environment allowlist
  try {
    const originUrl = new URL(rawOrigin);
    if (!isAllowedOriginHost(originUrl.host)) {
      return res.status(403).json({
        success: false,
        error: 'Cross-origin state-changing requests are prohibited.'
      });
    }

    // 4. Validate Host header against environment allowlist (defend against attacker-controlled Host headers)
    if (req.headers.host && !isAllowedOriginHost(req.headers.host)) {
      return res.status(403).json({
        success: false,
        error: 'Host header not recognized or authorized.'
      });
    }
  } catch {
    return res.status(400).json({
      success: false,
      error: 'Invalid Origin or Referer header format.'
    });
  }

  return next();
}

module.exports = {
  sanitizeNoSql,
  noSqlSanitizer,
  escapeRegex,
  stripHtml,
  sanitizeBoundedText,
  originGuard,
  isAllowedOriginHost
};
