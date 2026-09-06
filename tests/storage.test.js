/**
 * Unit Tests - Storage Service & Traversal Defense
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  resolveFilePath,
  getFileUrl,
  getStorageDir
} = require('../services/storage');

describe('Storage Service & Security Guard', () => {
  test('returns valid storage directory path', () => {
    const dir = getStorageDir();
    assert.ok(dir);
    assert.equal(typeof dir, 'string');
  });

  test('blocks directory traversal with .. sequence', () => {
    const { isValid, filePath } = resolveFilePath('../../.env');
    assert.equal(isValid, false);
    assert.equal(filePath, null);
  });

  test('blocks directory traversal with forward slashes', () => {
    const { isValid, filePath } = resolveFilePath('subfolder/document.pdf');
    assert.equal(isValid, false);
    assert.equal(filePath, null);
  });

  test('blocks directory traversal with backward slashes', () => {
    const { isValid, filePath } = resolveFilePath('subfolder\\document.pdf');
    assert.equal(isValid, false);
    assert.equal(filePath, null);
  });

  test('allows safe filename and resolves absolute path', () => {
    const safeName = 'athlete_photo_12345.jpg';
    const { isValid, filePath } = resolveFilePath(safeName);
    assert.equal(isValid, true);
    assert.ok(filePath.endsWith(safeName));
  });

  test('constructs proper public file URL', () => {
    assert.equal(getFileUrl('sample.pdf'), '/uploads/sample.pdf');
    assert.equal(getFileUrl(''), '');
  });
});
