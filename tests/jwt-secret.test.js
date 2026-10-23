/**
 * Tests for JWT_SECRET Fail-Closed Enforcement
 * Verifies that the application strictly fails closed when JWT_SECRET is missing or < 32 characters,
 * and boots successfully when a valid secret is provided.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const rootDir = path.resolve(__dirname, '../');

describe('JWT_SECRET Fail-Closed Enforcement', () => {

  describe('Missing JWT_SECRET', () => {
    it('fails closed in config/constants when JWT_SECRET is undefined', () => {
      const result = spawnSync(process.execPath, [
        '-e',
        'require("dotenv").config = () => {}; delete process.env.JWT_SECRET; require("./config/constants");'
      ], {
        cwd: rootDir,
        env: { ...process.env, JWT_SECRET: '' },
        encoding: 'utf8'
      });

      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes('FATAL: JWT_SECRET environment variable is required and not set'));
    });

    it('fails closed in config/constants when JWT_SECRET is an empty string', () => {
      const result = spawnSync(process.execPath, [
        '-e',
        'require("dotenv").config = () => {}; process.env.JWT_SECRET = ""; require("./config/constants");'
      ], {
        cwd: rootDir,
        env: { ...process.env, JWT_SECRET: '' },
        encoding: 'utf8'
      });

      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes('FATAL: JWT_SECRET environment variable is required and not set'));
    });

    it('fails closed in config/constants when JWT_SECRET is whitespace only', () => {
      const result = spawnSync(process.execPath, [
        '-e',
        'require("dotenv").config = () => {}; process.env.JWT_SECRET = "     "; require("./config/constants");'
      ], {
        cwd: rootDir,
        env: { ...process.env, JWT_SECRET: '     ' },
        encoding: 'utf8'
      });

      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes('FATAL: JWT_SECRET environment variable is required and not set'));
    });

    it('fails closed in config/constants when VERCEL=1 and JWT_SECRET is missing (no fallback)', () => {
      const result = spawnSync(process.execPath, [
        '-e',
        'require("dotenv").config = () => {}; delete process.env.JWT_SECRET; process.env.VERCEL = "1"; require("./config/constants");'
      ], {
        cwd: rootDir,
        env: { ...process.env, JWT_SECRET: '', VERCEL: '1' },
        encoding: 'utf8'
      });

      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes('FATAL: JWT_SECRET environment variable is required and not set'));
    });

    it('fails closed in api/index.js when JWT_SECRET is missing', () => {
      const result = spawnSync(process.execPath, [
        '-e',
        'require("dotenv").config = () => {}; delete process.env.JWT_SECRET; process.env.VERCEL = "1"; require("./api/index");'
      ], {
        cwd: rootDir,
        env: { ...process.env, JWT_SECRET: '', VERCEL: '1' },
        encoding: 'utf8'
      });

      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes('FATAL: JWT_SECRET environment variable is required and not set'));
    });
  });

  describe('Short JWT_SECRET (< 32 characters)', () => {
    it('fails closed in config/constants when JWT_SECRET is 1 character', () => {
      const result = spawnSync(process.execPath, [
        '-e',
        'require("./config/constants");'
      ], {
        cwd: rootDir,
        env: { ...process.env, JWT_SECRET: 'x' },
        encoding: 'utf8'
      });

      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes('FATAL: JWT_SECRET must be at least 32 characters long to ensure adequate entropy'));
    });

    it('fails closed in config/constants when JWT_SECRET is 31 characters', () => {
      const result = spawnSync(process.execPath, [
        '-e',
        'require("./config/constants");'
      ], {
        cwd: rootDir,
        env: { ...process.env, JWT_SECRET: '1234567890123456789012345678901' }, // 31 chars
        encoding: 'utf8'
      });

      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes('FATAL: JWT_SECRET must be at least 32 characters long to ensure adequate entropy'));
    });

    it('fails closed in config/constants when JWT_SECRET with whitespace trims to < 32 characters', () => {
      const result = spawnSync(process.execPath, [
        '-e',
        'require("./config/constants");'
      ], {
        cwd: rootDir,
        env: { ...process.env, JWT_SECRET: '   short_with_spaces_padded   ' }, // 24 chars trimmed
        encoding: 'utf8'
      });

      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes('FATAL: JWT_SECRET must be at least 32 characters long to ensure adequate entropy'));
    });

    it('fails closed in config/constants when VERCEL=1 and JWT_SECRET is < 32 characters (no fallback)', () => {
      const result = spawnSync(process.execPath, [
        '-e',
        'require("dotenv").config = () => {}; process.env.VERCEL = "1"; process.env.JWT_SECRET = "under_32_characters"; require("./config/constants");'
      ], {
        cwd: rootDir,
        env: { ...process.env, JWT_SECRET: 'under_32_characters', VERCEL: '1' },
        encoding: 'utf8'
      });

      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes('FATAL: JWT_SECRET must be at least 32 characters long to ensure adequate entropy'));
    });

    it('fails closed in api/index.js when JWT_SECRET is < 32 characters', () => {
      const result = spawnSync(process.execPath, [
        '-e',
        'require("dotenv").config = () => {}; process.env.VERCEL = "1"; process.env.JWT_SECRET = "short_key_under_thirty_two_c"; require("./api/index");'
      ], {
        cwd: rootDir,
        env: { ...process.env, JWT_SECRET: 'short_key_under_thirty_two_c', VERCEL: '1' },
        encoding: 'utf8'
      });

      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes('FATAL: JWT_SECRET must be at least 32 characters long to ensure adequate entropy'));
    });
  });

  describe('Valid JWT_SECRET (>= 32 characters)', () => {
    it('succeeds in config/constants when JWT_SECRET is exactly 32 characters', () => {
      const result = spawnSync(process.execPath, [
        '-e',
        'const { JWT_SECRET } = require("./config/constants"); console.log("SECRET_LEN:" + JWT_SECRET.length);'
      ], {
        cwd: rootDir,
        env: { ...process.env, JWT_SECRET: '12345678901234567890123456789012' }, // exactly 32
        encoding: 'utf8'
      });

      assert.equal(result.status, 0);
      assert.ok(result.stdout.includes('SECRET_LEN:32'));
    });

    it('succeeds in config/constants when JWT_SECRET is longer than 32 characters', () => {
      const secret = 'a_very_secure_high_entropy_jwt_secret_key_for_telangana_yoga_64_bytes_test';
      const result = spawnSync(process.execPath, [
        '-e',
        'const { JWT_SECRET } = require("./config/constants"); console.log("LOADED:" + (JWT_SECRET.length >= 32));'
      ], {
        cwd: rootDir,
        env: { ...process.env, JWT_SECRET: secret },
        encoding: 'utf8'
      });

      assert.equal(result.status, 0);
      assert.ok(result.stdout.includes('LOADED:true'));
    });

    it('trims leading and trailing whitespace while retaining adequate length', () => {
      const paddedSecret = '   12345678901234567890123456789012   ';
      const result = spawnSync(process.execPath, [
        '-e',
        'const { JWT_SECRET } = require("./config/constants"); console.log("TRIMMED:" + JWT_SECRET);'
      ], {
        cwd: rootDir,
        env: { ...process.env, JWT_SECRET: paddedSecret },
        encoding: 'utf8'
      });

      assert.equal(result.status, 0);
      assert.ok(result.stdout.includes('TRIMMED:12345678901234567890123456789012'));
    });

    it('successfully signs and verifies JWT tokens with a valid secret', () => {
      const secret = 'production_standard_jwt_secret_key_exceeding_32_characters!';
      const payload = { userId: 'admin_123', role: 'SUPER_ADMIN', district: 'ALL' };

      const token = jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: '1h' });
      assert.ok(token && typeof token === 'string');

      const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
      assert.equal(decoded.userId, 'admin_123');
      assert.equal(decoded.role, 'SUPER_ADMIN');
      assert.equal(decoded.district, 'ALL');
    });

    it('loads api/index.js successfully when JWT_SECRET is valid in Vercel environment', () => {
      const secret = 'valid_production_secret_32_characters_long_for_vercel_cold_start';
      const result = spawnSync(process.execPath, [
        '-e',
        'process.env.VERCEL = "1"; const app = require("./api/index"); console.log("APP_LOADED:" + typeof app);'
      ], {
        cwd: rootDir,
        env: { ...process.env, JWT_SECRET: secret, VERCEL: '1' },
        encoding: 'utf8'
      });

      assert.equal(result.status, 0);
      assert.ok(result.stdout.includes('APP_LOADED:function'));
    });
  });

});
