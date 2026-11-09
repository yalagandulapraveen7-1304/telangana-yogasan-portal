/**
 * Unit Tests - Payment Utilities
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const { verifyPaymentSignature, verifyWebhookSignature, FEE_PER_EVENT } = require('../utils/payment');
const { RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET } = require('../config/constants');

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

  test('validates correct Webhook HMAC SHA-256 signature', () => {
    const payload = JSON.stringify({ event: 'payment.captured', id: 'pay_123' });
    const secret = RAZORPAY_WEBHOOK_SECRET || 'test_secret';

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const validSignature = hmac.digest('hex');

    assert.equal(verifyWebhookSignature(payload, validSignature, secret), true);
    assert.equal(verifyWebhookSignature(payload, 'forged_signature_hex_1234567890', secret), false);
    assert.equal(verifyWebhookSignature('', validSignature, secret), false);
  });
});
