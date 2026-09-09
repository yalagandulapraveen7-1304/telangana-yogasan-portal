/**
 * Environment Validation Utility
 * Validates required configuration keys and emits diagnostics on application boot.
 */

const { JWT_SECRET, MONGO_URI, IS_PROD, PORT } = require('./constants');

function validateEnv() {
  const warnings = [];
  const errors = [];

  // Port validation
  if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
    errors.push(`Invalid PORT configuration: "${PORT}". Must be between 1 and 65535.`);
  }

  // Mongo URI validation
  if (!MONGO_URI) {
    errors.push('MONGO_URI is missing from environment.');
  } else if (IS_PROD && MONGO_URI.includes('127.0.0.1')) {
    warnings.push('Production environment is configured with local MongoDB address (127.0.0.1).');
  }

  // JWT Secret validation
  if (!JWT_SECRET || JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be configured with at least 32 characters.');
  }

  // Razorpay keys validation
  if (IS_PROD) {
    if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes('YOUR_KEY')) {
      errors.push('RAZORPAY_KEY_ID must be set to a valid live key in production.');
    }
    if (!process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET.includes('YOUR_SECRET')) {
      errors.push('RAZORPAY_KEY_SECRET must be set to a valid secret in production.');
    }
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  Configuration Warnings:');
    warnings.forEach((w) => console.warn(`   - ${w}`));
    console.warn('');
  }

  if (errors.length > 0) {
    console.error('\n❌ Configuration Errors:');
    errors.forEach((e) => console.error(`   - ${e}`));
    console.error('');
    throw new Error('Environment validation failed.');
  }

  return { isValid: true, warningsCount: warnings.length };
}

module.exports = { validateEnv };
