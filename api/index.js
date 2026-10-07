// Serverless entrypoint for Vercel
// Ensure safe fallback environment variables for cold start in Vercel
if (process.env.VERCEL) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim().length < 32) {
    console.warn('[Vercel] Warning: JWT_SECRET not configured in Vercel project environment. Using fallback secret.');
    process.env.JWT_SECRET = 'telangana_yogasana_portal_vercel_default_secure_secret_key_32_chars';
  }
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

