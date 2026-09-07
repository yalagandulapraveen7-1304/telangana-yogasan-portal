/**
 * Unit Tests - Category & Chest Number Utilities (utils/category.js)
 * Tests tournament age boundary rules, leap year handling, and chest number formatting.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateAgeCategory,
  getCategoryCode,
  getDistrictCode,
  formatChestNumber,
  sanitizeDistrictName
} = require('../../utils/category');

describe('Unit Tests: Age Category & Tournament Business Rules', () => {

  describe('1. Age Category Calculation (calculateAgeCategory)', () => {
    const currentYear = new Date().getFullYear();

    it('classifies Sub-Junior athletes (age 8 to < 14)', () => {
      // 10 years old at year-end
      const dob10 = `${currentYear - 10}-06-15`;
      assert.equal(calculateAgeCategory(dob10), 'Sub-Junior');

      // 8 years old boundary
      const dob8 = `${currentYear - 8}-01-01`;
      assert.equal(calculateAgeCategory(dob8), 'Sub-Junior');

      // 13.5 years old
      const dob13 = `${currentYear - 13}-06-01`;
      assert.equal(calculateAgeCategory(dob13), 'Sub-Junior');
    });

    it('classifies Junior athletes (age 14 to < 18)', () => {
      // 15 years old
      const dob15 = `${currentYear - 15}-05-20`;
      assert.equal(calculateAgeCategory(dob15), 'Junior');

      // 14 years old exact boundary
      const dob14 = `${currentYear - 14}-01-01`;
      assert.equal(calculateAgeCategory(dob14), 'Junior');

      // 17.5 years old
      const dob17 = `${currentYear - 17}-06-01`;
      assert.equal(calculateAgeCategory(dob17), 'Junior');
    });

    it('classifies Senior athletes (age 18+)', () => {
      // 20 years old
      const dob20 = `${currentYear - 20}-01-15`;
      assert.equal(calculateAgeCategory(dob20), 'Senior');

      // 18 years old boundary
      const dob18 = `${currentYear - 18}-01-01`;
      assert.equal(calculateAgeCategory(dob18), 'Senior');

      // 45 years old master
      const dob45 = `${currentYear - 45}-08-10`;
      assert.equal(calculateAgeCategory(dob45), 'Senior');
    });

    it('safely handles missing, invalid, or malformed dates by defaulting to Junior', () => {
      assert.equal(calculateAgeCategory(null), 'Junior');
      assert.equal(calculateAgeCategory(undefined), 'Junior');
      assert.equal(calculateAgeCategory('not-a-date'), 'Junior');
      assert.equal(calculateAgeCategory(''), 'Junior');
    });

    it('handles leap-year birthdates correctly', () => {
      // Born on Feb 29 leap day 2012 (14 yrs old -> Junior)
      assert.equal(calculateAgeCategory('2012-02-29'), 'Junior');
    });
  });

  describe('2. Category & District Codes (getCategoryCode, getDistrictCode)', () => {
    it('maps categories to standard 2-letter codes', () => {
      assert.equal(getCategoryCode('Sub-Junior'), 'SJ');
      assert.equal(getCategoryCode('sub-junior'), 'SJ');
      assert.equal(getCategoryCode('Junior'), 'JR');
      assert.equal(getCategoryCode('junior'), 'JR');
      assert.equal(getCategoryCode('Senior'), 'SR');
      assert.equal(getCategoryCode('senior'), 'SR');
      assert.equal(getCategoryCode(''), 'JR'); // default
    });

    it('extracts uppercase 3-letter district prefix', () => {
      assert.equal(getDistrictCode('Hyderabad'), 'HYD');
      assert.equal(getDistrictCode('Warangal'), 'WAR');
      assert.equal(getDistrictCode('Khammam'), 'KHA');
      assert.equal(getDistrictCode('Karimnagar'), 'KAR');
      assert.equal(getDistrictCode('Nizamabad'), 'NIZ');
      assert.equal(getDistrictCode('HY'), 'HYD'); // short fallback
      assert.equal(getDistrictCode(''), 'HYD'); // empty fallback
    });
  });

  describe('3. Standardized Chest Number Formatting (formatChestNumber)', () => {
    it('formats standardized chest number with zero-padded sequence', () => {
      assert.equal(formatChestNumber('Hyderabad', 'Junior', 1), 'HYD-JR-01');
      assert.equal(formatChestNumber('Hyderabad', 'Junior', 9), 'HYD-JR-09');
      assert.equal(formatChestNumber('Hyderabad', 'Junior', 10), 'HYD-JR-10');
      assert.equal(formatChestNumber('Warangal', 'Sub-Junior', 42), 'WAR-SJ-42');
      assert.equal(formatChestNumber('Khammam', 'Senior', 105), 'KHA-SR-105');
    });
  });

  describe('4. District Sanitization (sanitizeDistrictName)', () => {
    it('strips redundant "District" suffix and extra whitespace', () => {
      assert.equal(sanitizeDistrictName('Hyderabad District'), 'Hyderabad');
      assert.equal(sanitizeDistrictName('Warangal district'), 'Warangal');
      assert.equal(sanitizeDistrictName('Medak District'), 'Medak');
      assert.equal(sanitizeDistrictName('Ranga Reddy'), 'Ranga Reddy');
    });
  });
});
