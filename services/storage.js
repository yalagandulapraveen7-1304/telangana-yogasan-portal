/**
 * Storage Service
 * Abstract storage provider managing uploaded documents and identity certificates.
 * Supports local filesystem storage, ephemeral serverless directories, and cloud storage extensibility.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Determine storage root directory
const storageDir = process.env.VERCEL
  ? os.tmpdir()
  : path.join(__dirname, '../uploads');

// Ensure storage directory exists
if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

/**
 * Returns absolute path to the storage directory.
 */
function getStorageDir() {
  return storageDir;
}

/**
 * Validates a filename against directory traversal attacks and resolves its absolute path.
 */
function resolveFilePath(filename) {
  if (!filename || typeof filename !== 'string') {
    return { isValid: false, filePath: null };
  }

  // Prevent directory traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return { isValid: false, filePath: null };
  }

  const sanitized = path.basename(filename);
  const filePath = path.resolve(storageDir, sanitized);
  const resolvedStorageDir = path.resolve(storageDir);

  // Ensure path is strictly inside storage directory
  if (!filePath.startsWith(resolvedStorageDir)) {
    return { isValid: false, filePath: null };
  }

  return { isValid: true, filePath };
}

/**
 * Checks if a file exists on disk.
 */
function fileExists(filename) {
  const { isValid, filePath } = resolveFilePath(filename);
  if (!isValid || !filePath) return false;
  return fs.existsSync(filePath);
}

/**
 * Safely removes a file from storage.
 */
function deleteFile(filename) {
  const { isValid, filePath } = resolveFilePath(filename);
  if (isValid && filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Returns endpoint URL for accessing the file.
 * Extensible for external CDN / S3 bucket pre-signed URLs via STORAGE_BASE_URL.
 * Note: Local endpoints (/uploads/:filename) require an authenticated session and district authorization.
 */
function getFileUrl(filename) {
  if (!filename) return '';
  const baseUrl = process.env.STORAGE_BASE_URL || '/uploads';
  return `${baseUrl}/${encodeURIComponent(filename)}`;
}

module.exports = {
  getStorageDir,
  resolveFilePath,
  fileExists,
  deleteFile,
  getFileUrl
};
