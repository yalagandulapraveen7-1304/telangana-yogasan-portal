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
 * Origin Guard Middleware
 * Verifies that state-changing requests (POST, PATCH, PUT, DELETE) originate
 * from the same domain or trusted hosts to protect against CSRF attacks.
 */
function originGuard(req, res, next) {
  const stateChangingMethods = ['POST', 'PATCH', 'PUT', 'DELETE'];
  if (!stateChangingMethods.includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin || req.headers.referer;
  if (!origin) {
    // Non-browser / API client request without Origin/Referer header
    return next();
  }

  try {
    const originUrl = new URL(origin);
    const hostHeader = req.headers.host;

    // Verify host match
    if (hostHeader && originUrl.host !== hostHeader) {
      return res.status(403).json({
        success: false,
        error: 'Cross-origin state-changing requests are prohibited.'
      });
    }
  } catch {
    return res.status(400).json({
      success: false,
      error: 'Invalid Origin or Referer header.'
    });
  }

  return next();
}

module.exports = {
  sanitizeNoSql,
  noSqlSanitizer,
  escapeRegex,
  stripHtml,
  originGuard
};
