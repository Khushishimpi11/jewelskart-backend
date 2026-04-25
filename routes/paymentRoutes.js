const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');

// Razorpay instance with test keys
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ========== CREATE RAZORPAY ORDER ==========
router.post('/create-order', protect, async (req, res) => {
    try {
        const { amount, currency = 'INR', orderId } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid amount is required'
            });
        }

        const options = {
            amount: amount * 100,  // Convert to paise (₹500 = 50000 paise)
            currency: currency,
            receipt: `receipt_${Date.now()}`,
            payment_capture: 1,
            notes: {
                userId: req.user.id,
                orderId: orderId || 'pending'
            }
        };

        const order = await razorpay.orders.create(options);

        res.json({
            success: true,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            key_id: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== VERIFY PAYMENT ==========
router.post('/verify-payment', protect, async (req, res) => {
    try {
        const { order_id, payment_id, signature, orderId } = req.body;

        // Create signature for verification
        const body = order_id + "|" + payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === signature) {
            // Update order payment status if orderId provided
            if (orderId) {
                const order = await Order.findById(orderId);
                if (order) {
                    order.paymentStatus = "SUCCESS";
                    order.paymentId = payment_id;
                    order.razorpayOrderId = order_id;
                    order.orderStatus = "Confirmed";
                    order.paymentDate = new Date();
                    order.statusHistory.push({
                        status: "Confirmed",
                        note: "Payment received successfully. Order confirmed.",
                        updatedBy: req.user.name,
                        date: new Date()
                    });
                    await order.save();
                    
                    console.log(`✅ Payment verified for order ${order.orderNumber}`);
                }
            }
            
            res.json({
                success: true,
                message: 'Payment verified successfully',
                payment_id: payment_id,
                order_id: order_id
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Invalid payment signature'
            });
        }

    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
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