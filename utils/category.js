/**
 * Age Category & Chest Number Utilities
 * Implements Yoga Federation of India competition age boundaries and numbering logic.
 */

/**
 * Calculates official Age Group Category as per Yoga Federation Regulations:
 * 1. Sub-Junior: 08 to <14 Years (Group A: 08-10 Yrs, Group B: 10-14 Yrs)
 * 2. Junior:     14 to <18 Years (14-18 Yrs)
 * 3. Senior:     18+ Years (Group A: 18-25 Yrs, Group B: 25-35 Yrs, Group C: Above 35 Yrs)
 */
function calculateAgeCategory(dob) {
  if (!dob) return 'Junior';
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return 'Junior';

  const today = new Date();
  const refDate = new Date(today.getFullYear(), 11, 31);
  const age = (refDate - birthDate) / (1000 * 60 * 60 * 24 * 365.25);

  if (age >= 8 && age < 14) return 'Sub-Junior';
  if (age >= 14 && age < 18) return 'Junior';
  if (age >= 18) return 'Senior';
  return 'Sub-Junior';
}

/**
 * Returns a 2-letter classification code for chest numbers.
 */
function getCategoryCode(category = '') {
  const catLower = category.toLowerCase();
  if (catLower.includes('sub')) return 'SJ';
  if (catLower.includes('sen')) return 'SR';
  return 'JR';
}

/**
 * Returns 3-letter district prefix for chest numbers.
 */
function getDistrictCode(district = '') {
  const clean = district.trim().toUpperCase();
  return clean.length >= 3 ? clean.substring(0, 3) : 'HYD';
}

/**
 * Formats standard chest number: [DIST]-[CAT]-[SERIAL] (e.g. HYD-JR-01)
 */
function formatChestNumber(district, category, serialNumber) {
  const distCode = getDistrictCode(district);
  const catCode = getCategoryCode(category);
  const serial = String(serialNumber).padStart(2, '0');
  return `${distCode}-${catCode}-${serial}`;
}

/**
 * Cleans district names for regex matching (stripping any accidental "District" suffix).
 */
function sanitizeDistrictName(district = '') {
  return district.replace(/\s+district$/i, '').trim();
}

module.exports = {
  calculateAgeCategory,
  getCategoryCode,
  getDistrictCode,
  formatChestNumber,
  sanitizeDistrictName
};
