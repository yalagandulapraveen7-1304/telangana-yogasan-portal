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

// 1. POST /auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};

  // Strict type & length checks (prevents NoSQL injection and bcrypt DoS)
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'Email and password must be valid strings.' });
  }

  const cleanEmail = stripHtml(email).toLowerCase().trim();
  if (!cleanEmail || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  // Prevent bcrypt DoS via excessively large password strings
  if (password.length > 128 || cleanEmail.length > 150) {
    return res.status(400).json({ success: false, error: 'Input exceeds permissible length.' });
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
router.get('/logs', requireAuth, requireRole('SUPER_ADMIN'), async (_req, res) => {
  try {
    const logs = await LoginLog.find().sort({ loginAt: -1 }).limit(100).lean();
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