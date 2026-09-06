/**
 * Unit Tests - Age Category & Chest Numbering
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateAgeCategory,
  getCategoryCode,
  getDistrictCode,
  formatChestNumber,
  sanitizeDistrictName
} = require('../utils/category');

describe('Age Category Regulations', () => {
  test('correctly classifies Sub-Junior athletes (age 8 to <14)', () => {
    const currentYear = new Date().getFullYear();
    const dobSubJunior = `${currentYear - 10}-05-15`;
    assert.equal(calculateAgeCategory(dobSubJunior), 'Sub-Junior');
  });

  test('correctly classifies Junior athletes (age 14 to <18)', () => {
    const currentYear = new Date().getFullYear();
    const dobJunior = `${currentYear - 15}-03-20`;
    assert.equal(calculateAgeCategory(dobJunior), 'Junior');
  });

  test('correctly classifies Senior athletes (age 18+)', () => {
    const currentYear = new Date().getFullYear();
    const dobSenior = `${currentYear - 22}-01-10`;
    assert.equal(calculateAgeCategory(dobSenior), 'Senior');
  });

  test('handles missing or invalid date by defaulting safely', () => {
    assert.equal(calculateAgeCategory(null), 'Junior');
    assert.equal(calculateAgeCategory(''), 'Junior');
    assert.equal(calculateAgeCategory('not-a-date'), 'Junior');
  });
});

describe('Chest Number Generation', () => {
  test('maps category codes properly', () => {
    assert.equal(getCategoryCode('Sub-Junior'), 'SJ');
    assert.equal(getCategoryCode('Junior'), 'JR');
    assert.equal(getCategoryCode('Senior'), 'SR');
  });

  test('extracts 3-letter district prefix', () => {
    assert.equal(getDistrictCode('Hyderabad'), 'HYD');
    assert.equal(getDistrictCode('Warangal'), 'WAR');
    assert.equal(getDistrictCode('Medchal Malkajgiri'), 'MED');
  });

  test('formats standardized chest numbers', () => {
    assert.equal(formatChestNumber('Hyderabad', 'Junior', 1), 'HYD-JR-01');
    assert.equal(formatChestNumber('Warangal', 'Sub-Junior', 9), 'WAR-SJ-09');
    assert.equal(formatChestNumber('Khammam', 'Senior', 25), 'KHA-SR-25');
  });
});

describe('District Sanitization', () => {
  test('strips trailing "District" variations', () => {
    assert.equal(sanitizeDistrictName('Hyderabad District'), 'Hyderabad');
    assert.equal(sanitizeDistrictName('Warangal district'), 'Warangal');
    assert.equal(sanitizeDistrictName('Nizamabad'), 'Nizamabad');
  });
});
