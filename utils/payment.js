/**
 * Payment Gateway Helper (Razorpay)
 * Encapsulates order creation and HMAC-SHA256 signature verification.
 */

const crypto = require('crypto');
const Razorpay = require('razorpay');
const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, FEE_PER_EVENT } = require('../config/constants');

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

/**
 * Creates a Razorpay order based on event count.
 */
async function createOrder(eventCount = 1) {
  const count = Math.max(1, eventCount);
  const amountInPaise = count * FEE_PER_EVENT * 100;

  const options = {
    amount: amountInPaise,
    currency: 'INR',
    receipt: `nom_${Date.now()}`
  };

  // If using placeholder/test keys in development or test runs, provide simulated mock order
  if (!RAZORPAY_KEY_SECRET || RAZORPAY_KEY_SECRET === 'YOUR_SECRET' || RAZORPAY_KEY_ID.includes('YOUR_KEY')) {
    const mockId = `order_mock_${Date.now()}`;
    return {
      orderId: mockId,
      order_id: mockId,
      amount: options.amount / 100,
      keyId: RAZORPAY_KEY_ID
    };
  }

  try {
    const order = await razorpay.orders.create(options);
    return {
      orderId: order.id,
      order_id: order.id,
      amount: options.amount / 100,
      keyId: RAZORPAY_KEY_ID
    };
  } catch (err) {
    console.error('Razorpay live order creation failed:', err.message || err);
    throw err;
  }
}

/**
 * Verifies Razorpay payment signature using HMAC SHA256.
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) return false;
  if (!RAZORPAY_KEY_SECRET || RAZORPAY_KEY_SECRET === 'YOUR_SECRET') {
    // In dev mode with placeholder secret, allow pass-through if testing
    return true;
  }

  const hmac = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET);
  hmac.update(`${orderId}|${paymentId}`);
  const generatedSignature = hmac.digest('hex');

  return generatedSignature === signature;
}

module.exports = {
  createOrder,
  verifyPaymentSignature,
  FEE_PER_EVENT
};
