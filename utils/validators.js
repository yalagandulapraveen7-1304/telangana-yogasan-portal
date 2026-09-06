/**
 * Comprehensive Validation & Sanitization Utilities
 * Zero external dependencies; implements strict server-side validation rules.
 */

'use strict';

const { TELANGANA_DISTRICTS } = require('../config/constants');
const { stripHtml } = require('../middleware/sanitize');

// Pre-compute lowercased set of allowed districts
const DISTRICT_SET = new Set(TELANGANA_DISTRICTS.map((d) => d.toLowerCase().trim()));

// Canonical allowed statuses
const ALLOWED_STATUSES = new Set(['Submitted', 'Verified', 'Clarification', 'Pending']);

// Canonical allowed genders
const ALLOWED_GENDERS = new Set(['Male', 'Female', 'Other']);

// Canonical competition events
const ALLOWED_EVENTS = new Set([
  'Traditional Yogasana',
  'Artistic Yogasana Solo',
  'Artistic Yogasana Pair',
  'Rhythmic Yogasana Pair',
  'Free Flow',
  'Free Flow Yogasana'
]);

/**
 * Validates email address format and length.
 * RFC 5322 compliant practical regex.
 */
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 150) return false;
  // Strict format check: localPart@domain.tld
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(trimmed);
}

/**
 * Validates password format and bounds (prevents bcrypt DoS).
 */
function isValidPassword(password) {
  if (typeof password !== 'string') return false;
  return password.length >= 1 && password.length <= 128;
}

/**
 * Validates Indian 10-digit mobile number format.
 * Must start with 6, 7, 8, or 9 and contain exactly 10 digits.
 */
function isValidPhone(phone) {
  if (typeof phone !== 'string' && typeof phone !== 'number') return false;
  const cleaned = String(phone).trim();
  return /^[6-9]\d{9}$/.test(cleaned);
}

/**
 * Validates Aadhaar last 4 digits.
 * Must be exactly 4 numeric characters.
 */
function isValidAadhaarLast4(aadhaar) {
  if (typeof aadhaar !== 'string' && typeof aadhaar !== 'number') return false;
  const cleaned = String(aadhaar).trim();
  return /^\d{4}$/.test(cleaned);
}

/**
 * Validates date string or Date object.
 * Checks for valid calendar date (e.g. rejects Feb 31) and age bounds.
 * @param {string|Date} dateVal - Date input
 * @param {number} minAge - Minimum permissible age in years (default 5)
 * @param {number} maxAge - Maximum permissible age in years (default 100)
 */
function isValidDate(dateVal, minAge = 5, maxAge = 100) {
  if (!dateVal) return false;

  let parsedDate;
  if (dateVal instanceof Date) {
    parsedDate = dateVal;
  } else if (typeof dateVal === 'string') {
    // Expected ISO format: YYYY-MM-DD
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateVal.trim());
    if (!match) {
      // Also allow full ISO string
      parsedDate = new Date(dateVal);
    } else {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10);
      const day = parseInt(match[3], 10);

      // Month check (1-12)
      if (month < 1 || month > 12) return false;

      // Days in month check
      const daysInMonth = new Date(year, month, 0).getDate();
      if (day < 1 || day > daysInMonth) return false;

      parsedDate = new Date(year, month - 1, day);
    }
  } else {
    return false;
  }

  if (isNaN(parsedDate.getTime())) return false;

  // Age calculation as of today
  const today = new Date();
  const diffTime = today - parsedDate;
  if (diffTime < 0) return false; // Date cannot be in the future

  const ageYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
  return ageYears >= minAge && ageYears <= maxAge;
}

/**
 * Validates MongoDB 24-character hexadecimal ObjectId.
 */
function isValidObjectId(id) {
  if (typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(id.trim());
}

/**
 * Validates athlete chest number format (e.g. HYD-JUN-001, RAN-SUB-042).
 */
function isValidChestNumber(chest) {
  if (typeof chest !== 'string') return false;
  return /^[A-Z]{3}-[A-Z]{3,7}-\d{3,5}$/i.test(chest.trim());
}

/**
 * Validates district name against official 33 Telangana districts.
 */
function isValidDistrict(district) {
  if (typeof district !== 'string') return false;
  const clean = district.trim().toLowerCase().replace(/\s+district$/i, '');
  return DISTRICT_SET.has(clean);
}

/**
 * Resolves and normalizes district name to canonical spelling.
 * Returns null if invalid.
 */
function normalizeDistrict(district) {
  if (typeof district !== 'string') return null;
  const clean = district.trim().toLowerCase().replace(/\s+district$/i, '');
  const match = TELANGANA_DISTRICTS.find((d) => d.toLowerCase() === clean);
  return match || null;
}

/**
 * Validates gender.
 */
function isValidGender(gender) {
  if (typeof gender !== 'string') return false;
  return ALLOWED_GENDERS.has(gender.trim());
}

/**
 * Validates status value.
 */
function isValidStatus(status) {
  if (typeof status !== 'string') return false;
  return ALLOWED_STATUSES.has(status.trim());
}

/**
 * Validates competition events array.
 */
function validateEvents(events) {
  let list = [];
  if (Array.isArray(events)) {
    list = events.flat().filter(Boolean).map((e) => String(e).trim());
  } else if (typeof events === 'string' && events.trim()) {
    list = [events.trim()];
  } else {
    return { isValid: false, error: 'At least one competition event is required.' };
  }

  if (list.length === 0) {
    return { isValid: false, error: 'At least one competition event is required.' };
  }

  if (list.length > 10) {
    return { isValid: false, error: 'Cannot register for more than 10 events simultaneously.' };
  }

  // Sanitize each event name and check length
  const sanitized = list.map((e) => stripHtml(e).substring(0, 100));
  return { isValid: true, events: sanitized };
}

/**
 * Validates safe uploaded file name (prevents path traversal and double extension attacks).
 */
function isValidFilename(filename) {
  if (typeof filename !== 'string') return false;
  const trimmed = filename.trim();
  if (trimmed.length < 5 || trimmed.length > 100) return false;

  // Reject path traversal tokens
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('\0')) {
    return false;
  }

  // Safe character set: alphanumeric, underscores, hyphens, and a single dot for extension
  if (!/^[a-zA-Z0-9_\-]+\.[a-zA-Z0-9]+$/.test(trimmed)) {
    return false;
  }

  // Extension check
  const ext = trimmed.substring(trimmed.lastIndexOf('.')).toLowerCase();
  const allowedExts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
  return allowedExts.has(ext);
}

/**
 * Sanitizes and bounds a text string.
 */
function sanitizeBoundedText(str, maxLength = 100, defaultValue = '') {
  if (typeof str !== 'string') return defaultValue;
  const cleaned = stripHtml(str).trim();
  return cleaned.substring(0, maxLength);
}

module.exports = {
  isValidEmail,
  isValidPassword,
  isValidPhone,
  isValidAadhaarLast4,
  isValidDate,
  isValidObjectId,
  isValidChestNumber,
  isValidDistrict,
  normalizeDistrict,
  isValidGender,
  isValidStatus,
  validateEvents,
  isValidFilename,
  sanitizeBoundedText,
  ALLOWED_STATUSES,
  ALLOWED_GENDERS,
  ALLOWED_EVENTS
};
