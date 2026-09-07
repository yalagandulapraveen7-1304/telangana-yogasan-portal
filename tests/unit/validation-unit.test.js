/**
 * Unit Tests - Validation Utilities (utils/validators.js)
 * Exhaustive coverage of boundaries, edge cases, types, and injection attempts.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
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
} = require('../../utils/validators');

describe('Unit Tests: Validation Utilities', () => {

  describe('1. Email Validation (isValidEmail)', () => {
    it('accepts valid RFC-compliant emails', () => {
      assert.equal(isValidEmail('sec_hyd@telanganayoga.org'), true);
      assert.equal(isValidEmail('president.sats@gov.in'), true);
      assert.equal(isValidEmail('athlete123+tag@gmail.com'), true);
      assert.equal(isValidEmail('user@sub.domain.co'), true);
    });

    it('rejects invalid or malformed emails', () => {
      assert.equal(isValidEmail(''), false);
      assert.equal(isValidEmail('notanemail'), false);
      assert.equal(isValidEmail('@missinguser.com'), false);
      assert.equal(isValidEmail('user@.com'), false);
      assert.equal(isValidEmail('user@domain'), false);
      assert.equal(isValidEmail('user with spaces@domain.com'), false);
      assert.equal(isValidEmail(null), false);
      assert.equal(isValidEmail(undefined), false);
      assert.equal(isValidEmail(12345), false);
      assert.equal(isValidEmail({}), false);
    });

    it('rejects oversized email addresses to prevent DoS', () => {
      const longEmail = 'a'.repeat(151) + '@domain.com';
      assert.equal(isValidEmail(longEmail), false);
    });
  });

  describe('2. Password Validation (isValidPassword)', () => {
    it('accepts valid passwords between 1 and 128 characters', () => {
      assert.equal(isValidPassword('P@ssword123!'), true);
      assert.equal(isValidPassword('a'), true);
      assert.equal(isValidPassword('A'.repeat(128)), true);
    });

    it('rejects empty, non-string, or oversized passwords (> 128 chars bcrypt DoS)', () => {
      assert.equal(isValidPassword(''), false);
      assert.equal(isValidPassword('A'.repeat(129)), false);
      assert.equal(isValidPassword(null), false);
      assert.equal(isValidPassword(undefined), false);
      assert.equal(isValidPassword(123456), false);
    });
  });

  describe('3. Indian Phone Number Validation (isValidPhone)', () => {
    it('accepts valid 10-digit Indian numbers starting with 6, 7, 8, 9', () => {
      assert.equal(isValidPhone('9876543210'), true);
      assert.equal(isValidPhone('8123456789'), true);
      assert.equal(isValidPhone('7000000001'), true);
      assert.equal(isValidPhone('6999999999'), true);
      assert.equal(isValidPhone(9876543210), true);
    });

    it('rejects invalid phone numbers', () => {
      assert.equal(isValidPhone('5123456789'), false); // Starts with 5
      assert.equal(isValidPhone('1234567890'), false); // Starts with 1
      assert.equal(isValidPhone('987654321'), false);  // 9 digits
      assert.equal(isValidPhone('98765432100'), false); // 11 digits
      assert.equal(isValidPhone('98765abcde'), false); // Letters
      assert.equal(isValidPhone('+919876543210'), false); // With country code (must be 10 digits clean)
      assert.equal(isValidPhone(''), false);
      assert.equal(isValidPhone(null), false);
    });
  });

  describe('4. Aadhaar Last 4 Digits (isValidAadhaarLast4)', () => {
    it('accepts exactly 4 numeric digits', () => {
      assert.equal(isValidAadhaarLast4('1234'), true);
      assert.equal(isValidAadhaarLast4('0000'), true);
      assert.equal(isValidAadhaarLast4('9999'), true);
      assert.equal(isValidAadhaarLast4(5678), true);
    });

    it('rejects invalid Aadhaar last 4 patterns', () => {
      assert.equal(isValidAadhaarLast4('123'), false);   // 3 digits
      assert.equal(isValidAadhaarLast4('12345'), false); // 5 digits
      assert.equal(isValidAadhaarLast4('12a4'), false);  // Contains letter
      assert.equal(isValidAadhaarLast4('-123'), false);  // Negative symbol
      assert.equal(isValidAadhaarLast4(''), false);
      assert.equal(isValidAadhaarLast4(null), false);
    });
  });

  describe('5. Date & Calendar Validation (isValidDate)', () => {
    it('accepts valid dates and verifies permissible age bounds', () => {
      // 10 years ago from today -> valid child
      const tenYearsAgo = new Date();
      tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
      const isoTen = tenYearsAgo.toISOString().split('T')[0];
      assert.equal(isValidDate(isoTen, 5, 100), true);
      assert.equal(isValidDate(tenYearsAgo, 5, 100), true);
    });

    it('rejects invalid calendar dates (e.g. Feb 30, April 31)', () => {
      assert.equal(isValidDate('2015-02-30'), false);
      assert.equal(isValidDate('2015-04-31'), false);
      assert.equal(isValidDate('2015-13-01'), false); // Month 13
      assert.equal(isValidDate('2015-00-10'), false); // Month 0
    });

    it('handles leap years correctly', () => {
      // 2016 was a leap year -> Feb 29 was real
      assert.equal(isValidDate('2016-02-29', 5, 100), true);
      // 2015 was NOT a leap year -> Feb 29 is invalid
      assert.equal(isValidDate('2015-02-29', 5, 100), false);
    });

    it('rejects future dates', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isoTomorrow = tomorrow.toISOString().split('T')[0];
      assert.equal(isValidDate(isoTomorrow), false);
    });

    it('rejects dates below minAge or above maxAge', () => {
      // 2 years old (minAge = 5)
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      assert.equal(isValidDate(twoYearsAgo.toISOString().split('T')[0], 5, 100), false);

      // 110 years old (maxAge = 100)
      const ancient = new Date();
      ancient.setFullYear(ancient.getFullYear() - 110);
      assert.equal(isValidDate(ancient.toISOString().split('T')[0], 5, 100), false);
    });
  });

  describe('6. MongoDB ObjectId (isValidObjectId)', () => {
    it('accepts 24-character hexadecimal IDs', () => {
      assert.equal(isValidObjectId('507f1f77bcf86cd799439011'), true);
      assert.equal(isValidObjectId('65d0a1b2c3d4e5f67890abcd'), true);
    });

    it('rejects non-hex or wrong-length IDs', () => {
      assert.equal(isValidObjectId('507f1f77bcf86cd79943901'), false);  // 23 chars
      assert.equal(isValidObjectId('507f1f77bcf86cd7994390111'), false); // 25 chars
      assert.equal(isValidObjectId('507f1f77bcf86cd79943901g'), false); // 'g' is non-hex
      assert.equal(isValidObjectId(''), false);
      assert.equal(isValidObjectId(null), false);
      assert.equal(isValidObjectId(12345), false);
    });
  });

  describe('7. Chest Number Format (isValidChestNumber)', () => {
    it('accepts standardized chest number formats', () => {
      assert.equal(isValidChestNumber('HYD-JUN-001'), true);
      assert.equal(isValidChestNumber('WGL-SUB-1042'), true);
      assert.equal(isValidChestNumber('RAN-SEN-9999'), true);
    });

    it('rejects invalid chest numbers', () => {
      assert.equal(isValidChestNumber('HYDERABAD-01'), false);
      assert.equal(isValidChestNumber('12-34-56'), false);
      assert.equal(isValidChestNumber(''), false);
      assert.equal(isValidChestNumber(null), false);
    });
  });

  describe('8. District Normalization & Validation (isValidDistrict, normalizeDistrict)', () => {
    it('validates canonical Telangana districts regardless of casing or "District" suffix', () => {
      assert.equal(isValidDistrict('Hyderabad'), true);
      assert.equal(isValidDistrict('hyderabad'), true);
      assert.equal(isValidDistrict('Hyderabad District'), true);
      assert.equal(isValidDistrict('Warangal'), true);
      assert.equal(isValidDistrict('Bhadradri Kothagudem'), true);
      assert.equal(isValidDistrict('Komaram Bheem Asifabad'), true);
    });

    it('normalizes district to official title-cased spelling', () => {
      assert.equal(normalizeDistrict('hyderabad district'), 'Hyderabad');
      assert.equal(normalizeDistrict('RANGA REDDY'), 'Ranga Reddy');
      assert.equal(normalizeDistrict('medchal malkajgiri'), 'Medchal Malkajgiri');
      assert.equal(normalizeDistrict('NonExistentPlace'), null);
      assert.equal(normalizeDistrict(null), null);
    });

    it('rejects out-of-state or made-up districts', () => {
      assert.equal(isValidDistrict('Mumbai'), false);
      assert.equal(isValidDistrict('Bangalore'), false);
      assert.equal(isValidDistrict(''), false);
      assert.equal(isValidDistrict(null), false);
    });
  });

  describe('9. Gender and Status Enums (isValidGender, isValidStatus)', () => {
    it('strictly accepts only allowed genders', () => {
      assert.equal(isValidGender('Male'), true);
      assert.equal(isValidGender('Female'), true);
      assert.equal(isValidGender('Other'), true);
      assert.equal(isValidGender('male'), false); // case-sensitive enum
      assert.equal(isValidGender('Alien'), false);
      assert.equal(isValidGender(null), false);
    });

    it('strictly accepts only allowed athlete statuses', () => {
      assert.equal(isValidStatus('Submitted'), true);
      assert.equal(isValidStatus('Verified'), true);
      assert.equal(isValidStatus('Clarification'), true);
      assert.equal(isValidStatus('Pending'), true);
      assert.equal(isValidStatus('Rejected'), false); // Not in canonical set
      assert.equal(isValidStatus('Approved'), false);
      assert.equal(isValidStatus(''), false);
    });
  });

  describe('10. Competition Events (validateEvents)', () => {
    it('validates valid single and multiple event lists', () => {
      const res1 = validateEvents(['Traditional Yogasana', 'Artistic Yogasana Solo']);
      assert.equal(res1.isValid, true);
      assert.equal(res1.events.length, 2);

      const res2 = validateEvents('Traditional Yogasana');
      assert.equal(res2.isValid, true);
      assert.equal(res2.events[0], 'Traditional Yogasana');
    });

    it('sanitizes event names and removes HTML script tags', () => {
      const res = validateEvents(['Traditional Yogasana<script>alert(1)</script>']);
      assert.equal(res.isValid, true);
      assert.equal(res.events[0], 'Traditional Yogasanaalert(1)');
    });

    it('rejects empty event registrations or registrations exceeding 10 events', () => {
      assert.equal(validateEvents([]).isValid, false);
      assert.equal(validateEvents('').isValid, false);
      assert.equal(validateEvents(null).isValid, false);

      const tooMany = Array(11).fill('Traditional Yogasana');
      assert.equal(validateEvents(tooMany).isValid, false);
    });
  });

  describe('11. Safe Filename Validation (isValidFilename)', () => {
    it('accepts safe alphanumeric filenames with allowed image/pdf extensions', () => {
      assert.equal(isValidFilename('passport_photo_123.jpg'), true);
      assert.equal(isValidFilename('birth-cert-456.pdf'), true);
      assert.equal(isValidFilename('id_card.png'), true);
      assert.equal(isValidFilename('proof.webp'), true);
    });

    it('blocks directory traversal sequences (.. / \\ \0)', () => {
      assert.equal(isValidFilename('../../../etc/passwd.jpg'), false);
      assert.equal(isValidFilename('..\\windows\\system32.pdf'), false);
      assert.equal(isValidFilename('sub/dir/photo.png'), false);
      assert.equal(isValidFilename('file.jpg\0.pdf'), false);
    });

    it('blocks disallowed or dangerous extensions', () => {
      assert.equal(isValidFilename('script.js'), false);
      assert.equal(isValidFilename('payload.exe'), false);
      assert.equal(isValidFilename('shell.php'), false);
      assert.equal(isValidFilename('archive.zip'), false);
    });
  });

  describe('12. Text Sanitization & Bounding (sanitizeBoundedText)', () => {
    it('strips HTML and truncates text to maxLength', () => {
      const dirty = '<b>Ananya</b> <i>Kulkarni</i> Extra Long Suffix';
      const clean = sanitizeBoundedText(dirty, 15);
      assert.equal(clean, 'Ananya Kulkarni');
      assert.ok(clean.length <= 15);
    });

    it('returns default value when input is non-string', () => {
      assert.equal(sanitizeBoundedText(null, 50, 'Default'), 'Default');
      assert.equal(sanitizeBoundedText(undefined, 50, 'Fallback'), 'Fallback');
      assert.equal(sanitizeBoundedText(12345, 50, 'Number'), 'Number');
    });
  });
});
