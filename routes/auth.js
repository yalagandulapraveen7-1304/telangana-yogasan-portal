const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Secretary = require('../models/Secretary');
const LoginLog = require('../models/LoginLog');

const JWT_SECRET = process.env.JWT_SECRET || 'tya_secure_jwt_secret_key_2026';

// 1. POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown Device';

  try {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await Secretary.findOne({ email: email.toLowerCase().trim() });

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
      return res.status(401).json({ error: 'Invalid email or password' });
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
        district: user.district,
        role: user.role,
        name: user.secretaryName
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      district: user.district,
      role: user.role,
      secretaryName: user.secretaryName
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// 2. GET /auth/logs (Super Admin Only)
router.get('/logs', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Access denied. State Admin privileges required.' });
    }

    const logs = await LoginLog.find().sort({ loginAt: -1 }).limit(100);
    return res.json(logs);
  } catch (err) {
    console.error('Audit Log Fetch Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve login logs' });
  }
});

// 3. GET /auth/logout
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login.html');
});

// Auth Guard Middleware
function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.redirect('/login.html');

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie('token');
    return res.redirect('/login.html');
  }
}

module.exports = { router, requireAuth };