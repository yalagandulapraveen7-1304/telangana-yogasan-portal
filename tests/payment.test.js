/**
 * Unit Tests - Payment Utilities
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { verifyPaymentSignature, FEE_PER_EVENT } = require('../utils/payment');
const { RAZORPAY_KEY_SECRET } = require('../config/constants');

describe('Payment & Signature Verification', () => {
  test('constants define valid per-event fee', () => {
    assert.equal(FEE_PER_EVENT, 260);
  });

  test('rejects missing signature or parameters', () => {
    assert.equal(verifyPaymentSignature('', '', ''), false);
    assert.equal(verifyPaymentSignature('order_123', 'pay_123', ''), false);
    assert.equal(verifyPaymentSignature('order_123', '', 'sig_123'), false);
  });

  test('validates correct HMAC SHA-256 signature when secret is configured', () => {
    const orderId = 'order_test_1001';
    const paymentId = 'pay_test_2002';
    const secret = RAZORPAY_KEY_SECRET || 'YOUR_SECRET';

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${orderId}|${paymentId}`);
    const validSignature = hmac.digest('hex');

    const result = verifyPaymentSignature(orderId, paymentId, validSignature);
    assert.equal(result, true);
  });
});
