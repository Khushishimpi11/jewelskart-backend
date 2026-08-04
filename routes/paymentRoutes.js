const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');
const { createPaymentSession, verifyZohoSignature } = require('../services/zohoPaymentService');
const notificationService = require('../services/notificationService');

// Track processed webhook event IDs to prevent duplicate processing
const processedWebhookEvents = new Set();

// ========== STEP 5: CREATE ZOHO PAYMENT SESSION ==========
router.post('/create-session', protect, async (req, res) => {
    try {
        const { amount, currency = 'INR', description, invoice_number, reference_number, orderId, configurations } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid amount is required'
            });
        }

        const sessionResponse = await createPaymentSession({
            amount,
            currency,
            description: description || `JewelsKart Order ${orderId || ''}`,
            invoice_number: invoice_number || `INV-${Date.now()}`,
            reference_number: reference_number || (orderId ? orderId.toString() : `REF-${Date.now()}`),
            configurations: configurations || {}
        });

        const sessionId = sessionResponse.payments_session_id || sessionResponse.session_id || sessionResponse.id;

        // If an order ID was provided, save the payment session ID to the order
        if (orderId && sessionId) {
            const order = await Order.findById(orderId);
            if (order) {
                order.zohoSessionId = sessionId;
                await order.save();
            }
        }

        res.json({
            success: true,
            payments_session_id: sessionId,
            session: sessionResponse,
            account_id: process.env.ZOHO_ACCOUNT_ID,
            api_key: process.env.ZOHO_API_KEY
        });

    } catch (error) {
        console.error('Error creating Zoho payment session:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create Zoho payment session'
        });
    }
});

// ========== STEP 8: VERIFY PAYMENT ==========
router.post('/verify', protect, async (req, res) => {
    try {
        const { payment_id, payments_session_id, signature, orderId } = req.body;

        // Signature Verification using ZOHO_SIGNING_KEY
        const signingKey = process.env.ZOHO_SIGNING_KEY;
        let isSignatureValid = true;

        if (signingKey && signature) {
            const payloadString = payments_session_id ? `${payments_session_id}|${payment_id}` : payment_id;
            const expectedSignature = crypto
                .createHmac('sha256', signingKey)
                .update(payloadString)
                .digest('hex');

            if (expectedSignature !== signature) {
                isSignatureValid = verifyZohoSignature(req.body, signature);
            }
        }

        if (!isSignatureValid) {
            if (orderId) {
                const order = await Order.findById(orderId);
                if (order) {
                    try {
                        await notificationService.sendPaymentFailed(order);
                    } catch (notifErr) {
                        console.error('Notification error on failed payment:', notifErr);
                    }
                }
            }
            return res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

        // Only after successful verification
        let updatedOrder = null;
        if (orderId) {
            const order = await Order.findById(orderId);
            if (order) {
                order.paymentStatus = 'SUCCESS';
                order.paymentId = payment_id || order.paymentId;
                if (payments_session_id) order.zohoSessionId = payments_session_id;
                order.orderStatus = 'Confirmed';
                order.paymentDate = new Date();
                order.statusHistory.push({
                    status: 'Confirmed',
                    note: 'Payment verified successfully via Zoho Payments.',
                    updatedBy: req.user ? req.user.name : 'System',
                    date: new Date()
                });
                await order.save();
                updatedOrder = order;

                console.log(`✅ Payment verified for order #${order.orderNumber}`);
            }
        }

        res.json({
            success: true,
            message: 'Payment verified successfully',
            payment_id: payment_id,
            payments_session_id: payments_session_id,
            order: updatedOrder
        });

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== STEP 9: ZOHO PAYMENTS WEBHOOK ==========
router.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-zoho-signature'] || req.headers['zpay-signature'];
        const signingKey = process.env.ZOHO_SIGNING_KEY;

        // Verify webhook signature if header is present
        if (signingKey && signature) {
            const isValid = verifyZohoSignature(req.body, signature);
            if (!isValid) {
                console.error('❌ Webhook signature verification failed');
                return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
            }
        }

        const event = req.body;
        const eventId = event.event_id || event.id || `${event.event_type}_${Date.now()}`;

        // Idempotency check: prevent duplicate payments / event processing
        if (processedWebhookEvents.has(eventId)) {
            console.log(`⚠️ Duplicate webhook event ignored: ${eventId}`);
            return res.json({ success: true, message: 'Event already processed' });
        }
        processedWebhookEvents.add(eventId);

        // Limit memory size of processed events set
        if (processedWebhookEvents.size > 1000) {
            const firstItem = processedWebhookEvents.values().next().value;
            processedWebhookEvents.delete(firstItem);
        }

        const eventType = event.event_type || event.type;
        console.log(`📩 Zoho Webhook Received: ${eventType}`);

        if (eventType === 'payment.succeeded' || eventType === 'paymentsession.paid' || eventType === 'payment_success') {
            const paymentData = event.data || event;
            const referenceNumber = paymentData.reference_number || paymentData.order_id;
            const paymentId = paymentData.payment_id || paymentData.id;

            if (referenceNumber) {
                const order = await Order.findOne({
                    $or: [
                        { _id: referenceNumber.match(/^[0-9a-fA-F]{24}$/) ? referenceNumber : null },
                        { orderNumber: referenceNumber },
                        { zohoSessionId: paymentData.payments_session_id }
                    ]
                });

                if (order && order.paymentStatus !== 'SUCCESS') {
                    order.paymentStatus = 'SUCCESS';
                    order.paymentId = paymentId || order.paymentId;
                    order.orderStatus = 'Confirmed';
                    order.paymentDate = new Date();
                    order.statusHistory.push({
                        status: 'Confirmed',
                        note: `Payment confirmed via Zoho Webhook (Event: ${eventType})`,
                        updatedBy: 'Zoho Webhook',
                        date: new Date()
                    });
                    await order.save();
                    console.log(`✅ Webhook updated order #${order.orderNumber} to SUCCESS`);
                }
            }
        }

        res.json({ success: true, message: 'Webhook event processed' });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== GET PAYMENT STATUS ==========
router.get('/status/:orderId', protect, async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }

        res.json({
            success: true,
            paymentStatus: order.paymentStatus,
            paymentId: order.paymentId,
            zohoSessionId: order.zohoSessionId,
            orderStatus: order.orderStatus
        });

    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;