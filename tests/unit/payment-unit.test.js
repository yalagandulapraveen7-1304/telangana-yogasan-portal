/**
 * Unit Tests - Payment & Business Rules (utils/payment.js)
 * Tests tournament registration fee math, Razorpay order structure, and HMAC signature verification.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  createOrder,
  verifyPaymentSignature,
  FEE_PER_EVENT
} = require('../../utils/payment');
const { RAZORPAY_KEY_SECRET } = require('../../config/constants');

describe('Unit Tests: Payment & Tournament Fee Math', () => {

  describe('1. Fee Structure & Math Rules', () => {
    it('verifies standard per-event registration fee matches FEE_PER_EVENT', () => {
      assert.equal(FEE_PER_EVENT, 260, 'Registration fee must be ₹260 per event');
    });

    it('creates simulated or live order with correct amounts for 1 to 5 events', async () => {
      for (let count = 1; count <= 5; count++) {
        const order = await createOrder(count);
        assert.ok(order.orderId || order.order_id, `Order ID must be present for eventCount ${count}`);
        assert.equal(order.amount, count * FEE_PER_EVENT, `Total amount must equal ${count * FEE_PER_EVENT}`);
      }
    });

    it('enforces minimum fee of 1 event when eventCount is 0 or negative', async () => {
      const orderZero = await createOrder(0);
      assert.equal(orderZero.amount, FEE_PER_EVENT);

      const orderNeg = await createOrder(-2);
      assert.equal(orderNeg.amount, FEE_PER_EVENT);
    });
  });

  describe('2. HMAC SHA-256 Signature Verification (verifyPaymentSignature)', () => {
    it('rejects missing parameters', () => {
      assert.equal(verifyPaymentSignature(null, 'pay_123', 'sig_123'), false);
      assert.equal(verifyPaymentSignature('order_123', null, 'sig_123'), false);
      assert.equal(verifyPaymentSignature('order_123', 'pay_123', null), false);
      assert.equal(verifyPaymentSignature('', '', ''), false);
    });

    it('correctly verifies signature against HMAC SHA-256 algorithm', () => {
      const orderId = 'order_test_999';
      const paymentId = 'pay_test_888';

      if (RAZORPAY_KEY_SECRET && RAZORPAY_KEY_SECRET !== 'YOUR_SECRET') {
        const hmac = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET);
        hmac.update(`${orderId}|${paymentId}`);
        const validSig = hmac.digest('hex');

        assert.equal(verifyPaymentSignature(orderId, paymentId, validSig), true);
        assert.equal(verifyPaymentSignature(orderId, paymentId, 'tampered_signature'), false);
      } else {
        // Dev fallback verification
        assert.equal(verifyPaymentSignature(orderId, paymentId, 'any_signature'), true);
      }
    });
  });
});
