/**
 * Authentication Middleware & Rate Limiters
 * Hardened with explicit algorithm pinning and role-based guards.
 */

const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { JWT_SECRET } = require('../config/constants');

// Rate limiter for authentication attempts (brute-force defense)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX, 10) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts from this IP. Please try again after 15 minutes.' }
});

// General rate limiter for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_API_MAX, 10) || 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests from this IP, please try again later.' }
});

// Rate limiter for public read operations (e.g. admit card lookups, QR code validation)
const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_PUBLIC_READ_MAX, 10) || 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many admit card requests from this IP, please try again later.' }
});

// Rate limiter for nomination submissions
const nominationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_NOMINATION_MAX, 10) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many nomination requests. Please try again after 15 minutes.' }
});

/**
 * Extracts bearer token or cookie from request.
 */
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1].trim();
  }
  return req.cookies?.token || null;
}

/**
 * Optional user extraction middleware.
 * Attaches decoded user to req.user if a valid token is present, without blocking unauthenticated requests.
 */
function optionalAuth(req, _res, next) {
  const token = extractToken(req);
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
  } catch {
    req.user = null;
  }

  return next();
}

/**
 * Authentication guard middleware.
 * Enforces algorithm HS256 to prevent algorithm confusion attacks.
 */
function requireAuth(req, res, next) {
  const token = extractToken(req);

  const isApiRequest = req.xhr ||
    (req.headers.accept && req.headers.accept.includes('application/json')) ||
    req.path.startsWith('/auth/logs') ||
    req.baseUrl.startsWith('/portal') ||
    req.path.startsWith('/portal');

  if (!token) {
    if (isApiRequest) {
      return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
    }
    return res.redirect('/login.html');
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
    return next();
  } catch {
    res.clearCookie('token', { path: '/' });
    if (isApiRequest) {
      return res.status(401).json({ success: false, error: 'Session expired or invalid token. Please log in again.' });
    }
    return res.redirect('/login.html');
  }
}

/**
 * Role-Based Access Control Middleware.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Insufficient privileges for this action.'
      });
    }
    return next();
  };
}

module.exports = {
  requireAuth,
  optionalAuth,
  requireRole,
  loginLimiter,
  apiLimiter,
  publicReadLimiter,
  nominationLimiter
};
