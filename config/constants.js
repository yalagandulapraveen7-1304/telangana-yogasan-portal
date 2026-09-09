/**
 * Application Constants & Configuration
 * Centralized settings for environment variables, defaults, and business rules.
 */

require('dotenv').config();

const PORT = parseInt(process.env.PORT, 10) || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/telangana_yoga';
const IS_PROD = process.env.NODE_ENV === 'production';

// JWT Secret Validation & Fail-Fast Enforcement
const rawJwtSecret = process.env.JWT_SECRET;
if (!rawJwtSecret) {
  throw new Error('FATAL: JWT_SECRET environment variable is required and not set');
}
if (typeof rawJwtSecret !== 'string' || rawJwtSecret.trim().length < 32) {
  throw new Error('FATAL: JWT_SECRET must be at least 32 characters long to ensure adequate entropy');
}
const JWT_SECRET = rawJwtSecret.trim();

// Championship Business Rules
const FEE_PER_EVENT = 260; // ₹260 per event registration

// Razorpay Credentials & Production Fail-Fast Audit
const rawRazorpayKeyId = process.env.RAZORPAY_KEY_ID;
const rawRazorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

if (IS_PROD) {
  if (!rawRazorpayKeyId || rawRazorpayKeyId === 'rzp_test_YOUR_KEY' || rawRazorpayKeyId.includes('YOUR_KEY')) {
    throw new Error('FATAL: RAZORPAY_KEY_ID environment variable is required in production and cannot use placeholder values');
  }
  if (!rawRazorpayKeySecret || rawRazorpayKeySecret === 'YOUR_SECRET' || rawRazorpayKeySecret.includes('YOUR_SECRET')) {
    throw new Error('FATAL: RAZORPAY_KEY_SECRET environment variable is required in production and cannot use placeholder values');
  }
}

const RAZORPAY_KEY_ID = rawRazorpayKeyId || 'rzp_test_YOUR_KEY';
const RAZORPAY_KEY_SECRET = rawRazorpayKeySecret || 'YOUR_SECRET';

// 33 Administrative Districts of Telangana
const TELANGANA_DISTRICTS = [
  'Adilabad', 'Bhadradri Kothagudem', 'Hyderabad', 'Jagtial', 'Jangaon',
  'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar',
  'Khammam', 'Komaram Bheem Asifabad', 'Mahabubabad', 'Mahabubnagar',
  'Mancherial', 'Medak', 'Medchal Malkajgiri', 'Mulugu', 'Nagarkurnool',
  'Nalgonda', 'Narayanpet', 'Nirmal', 'Nizamabad', 'Peddapalli',
  'Rajanna Sircilla', 'Ranga Reddy', 'Sangareddy', 'Siddipet', 'Suryapet',
  'Vikarabad', 'Wanaparthy', 'Warangal', 'Hanamkonda', 'Yadadri Bhuvanagiri'
];

module.exports = {
  PORT,
  MONGO_URI,
  JWT_SECRET,
  IS_PROD,
  FEE_PER_EVENT,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  TELANGANA_DISTRICTS
};
