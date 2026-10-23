// Serverless entrypoint for Vercel
// Fail closed if JWT_SECRET is missing or shorter than 32 characters
if (!process.env.JWT_SECRET || typeof process.env.JWT_SECRET !== 'string' || !process.env.JWT_SECRET.trim()) {
  throw new Error('FATAL: JWT_SECRET environment variable is required and not set');
}
if (process.env.JWT_SECRET.trim().length < 32) {
  throw new Error('FATAL: JWT_SECRET must be at least 32 characters long to ensure adequate entropy');
}

// Razorpay test fallbacks when running in preview/test without payment keys
if (process.env.VERCEL) {
  if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes('YOUR_KEY')) {
    console.warn('[Vercel] Warning: RAZORPAY_KEY_ID not configured in Vercel project environment. Running in test mode.');
    process.env.RAZORPAY_KEY_ID = 'rzp_test_vercel_placeholder_key_id';
  }
  if (!process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET.includes('YOUR_SECRET')) {
    console.warn('[Vercel] Warning: RAZORPAY_KEY_SECRET not configured in Vercel project environment. Running in test mode.');
    process.env.RAZORPAY_KEY_SECRET = 'vercel_placeholder_secret_key_prod';
  }
}

const app = require('../server');

module.exports = app;

