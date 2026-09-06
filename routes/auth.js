/**
 * Authentication Routes
 * Hardened against NoSQL injection, brute force, bcrypt DoS, and log injection.
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Secretary = require('../models/Secretary');
const LoginLog = require('../models/LoginLog');
const { JWT_SECRET, IS_PROD } = require('../config/constants');
const { requireAuth, loginLimiter, requireRole } = require('../middleware/auth');
const { stripHtml } = require('../middleware/sanitize');
const { isValidEmail, isValidPassword } = require('../utils/validators');

// 1. POST /auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const body = req.body || {};

  // Reject unexpected fields to prevent parameter injection / prototype pollution
  const allowedKeys = new Set(['email', 'password']);
  const receivedKeys = Object.keys(body);
  const unexpectedKeys = receivedKeys.filter((k) => !allowedKeys.has(k));
  if (unexpectedKeys.length > 0) {
    return res.status(400).json({
      success: false,
      error: `Unexpected field(s) in request: ${unexpectedKeys.join(', ')}`
    });
  }

  const { email, password } = body;

  // Strict type checks
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'Email and password must be valid strings.' });
  }

  const cleanEmail = stripHtml(email).toLowerCase().trim();
  if (!cleanEmail || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  // Strict email format and length validation
  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
  }

  // Prevent bcrypt DoS via excessively large password strings
  if (!isValidPassword(password)) {
    return res.status(400).json({ success: false, error: 'Password length must be between 1 and 128 characters.' });
  }

  const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const clientIp = stripHtml(String(Array.isArray(rawIp) ? rawIp[0] : rawIp)).substring(0, 45);
  const userAgent = stripHtml(String(req.headers['user-agent'] || 'Unknown Device')).substring(0, 200);

  try {
    const user = await Secretary.findOne({ email: cleanEmail });

    if (!user || !(await user.comparePassword(password))) {
      if (user) {
        await LoginLog.create({
          email: user.email,
          district: user.district,
          role: user.role,
          secretaryName: user.secretaryName,
          ipAddress: clientIp,
          userAgent,
          status: 'FAILED'
        });
      }
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Record successful login
    await LoginLog.create({
      email: user.email,
      district: user.district,
      role: user.role,
      secretaryName: user.secretaryName,
      ipAddress: clientIp,
      userAgent,
      status: 'SUCCESS'
    });

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        district: user.district
      },
      JWT_SECRET,
      { expiresIn: '1d', algorithm: 'HS256' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'strict',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    return res.json({
      success: true,
      token,
      district: user.district,
      role: user.role,
      secretaryName: user.secretaryName
    });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ success: false, error: 'Authentication failed. Please try again later.' });
  }
});

// 2. GET /auth/logs (Super Admin Only)
router.get('/logs', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    let limit = 100;
    if (req.query.limit !== undefined) {
      const parsed = parseInt(req.query.limit, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 200 || String(parsed) !== String(req.query.limit).trim()) {
        return res.status(400).json({ success: false, error: 'Limit parameter must be an integer between 1 and 200.' });
      }
      limit = parsed;
    }

    const logs = await LoginLog.find().sort({ loginAt: -1 }).limit(limit).lean();
    return res.json(logs);
  } catch (err) {
    console.error('Audit log fetch error:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve login logs' });
  }
});

// 3. GET /auth/logout
router.get('/logout', (_req, res) => {
  res.clearCookie('token', { path: '/' });
  res.redirect('/login.html');
});

module.exports = { router, requireAuth };