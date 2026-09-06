/**
 * Unit Tests - Authentication & Auth Guard Middleware
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { requireAuth } = require('../middleware/auth');
const { JWT_SECRET } = require('../config/constants');

describe('Authentication & Token Security', () => {
  test('generates and verifies valid JWT payload', () => {
    const payload = {
      id: 'mock_user_123',
      email: 'sec_hyderabad@telanganayoga.org',
      role: 'SECRETARY',
      district: 'Hyderabad'
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const decoded = jwt.verify(token, JWT_SECRET);

    assert.equal(decoded.id, payload.id);
    assert.equal(decoded.email, payload.email);
    assert.equal(decoded.role, payload.role);
    assert.equal(decoded.district, payload.district);
  });

  test('requireAuth redirects HTML page requests to /login.html when unauthenticated', () => {
    const req = {
      headers: {},
      cookies: {},
      path: '/dashboard',
      baseUrl: ''
    };

    let redirectUrl = null;
    const res = {
      redirect: (url) => {
        redirectUrl = url;
      },
      clearCookie: () => {}
    };

    let nextCalled = false;
    requireAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(redirectUrl, '/login.html');
  });

  test('requireAuth responds with 401 JSON for unauthenticated API requests', () => {
    const req = {
      headers: { accept: 'application/json' },
      cookies: {},
      path: '/portal/athletes/list',
      baseUrl: '/portal/athletes'
    };

    let statusCode = null;
    let jsonBody = null;

    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => {
            jsonBody = body;
          }
        };
      },
      clearCookie: () => {}
    };

    requireAuth(req, res, () => {});

    assert.equal(statusCode, 401);
    assert.equal(jsonBody.success, false);
    assert.match(jsonBody.error, /Authentication required/);
  });

  test('requireAuth authenticates valid Authorization Bearer header', () => {
    const token = jwt.sign(
      { id: '123', email: 'test@telanganayoga.org', role: 'SECRETARY', district: 'Warangal' },
      JWT_SECRET
    );

    const req = {
      headers: { authorization: `Bearer ${token}` },
      cookies: {},
      path: '/portal/athletes/list',
      baseUrl: '/portal/athletes'
    };

    let nextCalled = false;
    const res = {
      status: () => ({ json: () => {} }),
      redirect: () => {},
      clearCookie: () => {}
    };

    requireAuth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.user.district, 'Warangal');
  });
});
