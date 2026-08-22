const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');
const { createPaymentSession, fetchPaymentSessionDetails, verifyZohoSignature } = require('../services/zohoPaymentService');
const notificationService = require('../services/notificationService');
const { sendOrderConfirmationEmail } = require('../services/emailService');
const Tracking = require('../models/Tracking');
const Customer = require('../models/Customer');

// Track processed webhook event IDs to prevent duplicate processing
const processedWebhookEvents = new Set();

// ========== REUSABLE IDEMPOTENT VERIFICATION HELPER ==========
async function verifyAndConfirmZohoOrder({ orderId, sessionId, paymentId, signature, payloadBody, user }) {
    // 1. Locate the order
    let order = null;
    if (orderId && orderId.toString().match(/^[0-9a-fA-F]{24}$/)) {
        order = await Order.findById(orderId);
    }
    if (!order && sessionId) {
        order = await Order.findOne({ zohoSessionId: sessionId });
    }
    if (!order && orderId) {
        order = await Order.findOne({ orderNumber: orderId });
    }

    if (!order) {
        return { success: false, statusCode: 404, message: 'Order not found' };
    }

    // 2. IDEMPOTENCY CHECK: If already confirmed and SUCCESS, return without re-emailing or re-notifying
    if (order.paymentStatus === 'SUCCESS' && order.orderStatus === 'Confirmed') {
        console.log(`ℹ️ Order #${order.orderNumber} is already verified and confirmed. Idempotent return.`);
        return {
            success: true,
            alreadyVerified: true,
            message: 'Order payment is already verified and confirmed',
            payment_id: order.paymentId,
            payments_session_id: order.zohoSessionId,
            order
        };
    }

    const activeSessionId = sessionId || order.zohoSessionId;
    let finalPaymentId = paymentId || order.paymentId;
    let isZohoConfirmed = false;

    // 3. DIRECT SERVER-TO-SERVER ZOHO API VERIFICATION
    if (activeSessionId) {
        try {
            const zohoSessionData = await fetchPaymentSessionDetails(activeSessionId);
            console.log(`📡 [Server Verification] Zoho session status for ${activeSessionId}:`, {
                status: zohoSessionData?.status,
                amount: zohoSessionData?.amount,
                invoice_number: zohoSessionData?.invoice_number,
                paymentsCount: zohoSessionData?.payments?.length
            });

            if (zohoSessionData && (zohoSessionData.status === 'succeeded' || zohoSessionData.status === 'SUCCESS' || zohoSessionData.status === 'PAID')) {
                isZohoConfirmed = true;
                if (zohoSessionData.payments && zohoSessionData.payments.length > 0) {
                    const successfulPayment = zohoSessionData.payments.find(p => p.status === 'succeeded' || p.status === 'SUCCESS') || zohoSessionData.payments[0];
                    if (successfulPayment?.payment_id) {
                        finalPaymentId = successfulPayment.payment_id;
                    }
                }
            }
        } catch (zFetchErr) {
            console.warn('⚠️ Server-to-server Zoho session fetch warning:', zFetchErr.message);
        }
    }

    // 4. Fallback to signature check if direct API check had a connection issue
    if (!isZohoConfirmed && signature) {
        const signingKey = process.env.ZOHO_SIGNING_KEY;
        if (signingKey) {
            const payloadString = activeSessionId ? `${activeSessionId}|${finalPaymentId}` : finalPaymentId;
            const expectedSignature = crypto
                .createHmac('sha256', signingKey)
                .update(payloadString)
                .digest('hex');

            if (expectedSignature === signature || verifyZohoSignature(payloadBody || {}, signature)) {
                isZohoConfirmed = true;
            }
        }
    }

    if (!isZohoConfirmed) {
        return {
            success: false,
            statusCode: 400,
            message: 'Payment verification failed: Zoho Payments has not confirmed payment success for this session'
        };
    }

    // 5. ATOMIC STATE TRANSITION
    order.paymentStatus = 'SUCCESS';
    order.orderStatus = 'Confirmed';
    order.paymentId = finalPaymentId || order.paymentId || `ZPAY_${Date.now()}`;
    order.zohoPaymentId = finalPaymentId || order.zohoPaymentId;
    if (activeSessionId) order.zohoSessionId = activeSessionId;
    order.paymentDate = new Date();

    order.statusHistory.push({
        status: 'Confirmed',
        note: `Payment verified successfully via Zoho Payments. Payment ID: ${order.paymentId}`,
        updatedBy: user?.name || order.customerName || 'System',
        date: new Date()
    });

    await order.save();

    // 6. Update or Create Tracking
    try {
        let tracking = await Tracking.findOne({ orderId: order._id });
        if (tracking) {
            tracking.status = 'CONFIRMED';
            tracking.currentLocation = 'Order Confirmed';
            tracking.timeline.push({
                status: 'CONFIRMED',
                location: 'Order Confirmed',
                description: 'Payment received. Order confirmed.',
                date: new Date()
            });
            await tracking.save();
        } else {
            const trackingId = `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`;
            tracking = await Tracking.create({
                trackingId: trackingId,
                orderId: order._id,
                orderNumber: order.orderNumber,
                status: 'CONFIRMED',
                currentLocation: 'Order Confirmed',
                timeline: [{
                    status: 'CONFIRMED',
                    location: 'Order Confirmed',
                    description: 'Payment received. Order confirmed.',
                    date: new Date()
                }]
            });
            order.trackingNumber = tracking.trackingId;
            await order.save();
        }
    } catch (trkErr) {
        console.error('Tracking update error:', trkErr.message);
    }

    // 7. Send Order Confirmation Email (Once)
    try {
        const customer = await Customer.findById(order.customerId);
        const emailItems = order.items.map(item => ({
            productName: item.productName || item.name,
            quantity: item.quantity,
            price: item.price,
            size: item.size || '',
            material: item.material || '',
            productImage: item.productImage || '',
            productSku: item.productSku
        }));

        await sendOrderConfirmationEmail({
            orderNumber: order.orderNumber,
            customerEmail: order.customerEmail,
            customerName: order.customerName,
            customerPhone: order.customerPhone || customer?.phone || '',
            items: emailItems,
            subtotal: order.subtotal,
            shippingCharge: order.shippingCharge,
            tax: order.tax,
            totalAmount: order.totalAmount,
            shippingAddress: order.shippingAddress,
            paymentMethod: order.paymentMethod,
            createdAt: order.createdAt,
            trackingId: order.trackingNumber || ''
        });
        console.log(`📧 Order confirmation email sent for order ${order.orderNumber}`);
    } catch (emailError) {
        console.error('❌ Email sending failed:', emailError.message);
    }

    // 8. Notifications (Once)
    try {
        await notificationService.sendNewOrder(order);
        await notificationService.sendPaymentReceived(order);
        await notificationService.sendToCustomer(order.userId || order.customerId, order.customerEmail, {
            type: 'payment_successful',
            title: 'Payment Successful 💳',
            message: `Payment of ₹${order.totalAmount.toLocaleString('en-IN')} for order #${order.orderNumber} was successful.`,
            actionLink: '/orders',
            relatedData: { orderId: order._id }
        });
        await notificationService.sendCustomerOrderStatusNotification(order, 'Confirmed');
    } catch (notifErr) {
        console.error('Notification error on verified payment:', notifErr.message);
    }

    console.log(`✅ Order #${order.orderNumber} successfully confirmed with Payment ID: ${order.paymentId}`);

    return {
        success: true,
        message: 'Payment verified and order confirmed successfully',
        payment_id: order.paymentId,
        payments_session_id: activeSessionId,
        order
    };
}

// ========== ZOHO OAUTH CALLBACK ENDPOINT ==========
router.get('/zoho/callback', async (req, res) => {
    const { code, error, error_description } = req.query;
    const clientId = (process.env.ZOHO_CLIENT_ID || "").trim();
    const clientSecret = (process.env.ZOHO_CLIENT_SECRET || "").trim();
    const redirectUri = (process.env.ZOHO_REDIRECT_URI || "https://jewelskart-backend-gt7z.onrender.com/auth/zoho/callback").trim();

    console.log("\n" + "=".repeat(60));
    console.log("🔔 [paymentRoutes] ZOHO OAUTH CALLBACK HIT");
    console.log("=".repeat(60));
    console.log("📥 Query params:", req.query);

    if (error) {
        console.error("❌ Zoho returned error:", error, error_description);
        return res.status(400).send(`<h2>❌ Zoho OAuth Error</h2><p>${error}: ${error_description || ''}</p>`);
    }

    if (!code) {
        const authUrl = `https://accounts.zoho.in/oauth/v2/auth?response_type=code&client_id=${clientId}&scope=ZohoPayments.fullaccess.ALL&redirect_uri=${encodeURIComponent(redirectUri)}&access_type=offline&prompt=consent`;
        return res.status(400).send(`<h2>🔑 Zoho OAuth Callback</h2><p><a href="${authUrl}">Authorize with Zoho</a></p>`);
    }

    try {
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            code: code.trim()
        });

        const response = await fetch('https://accounts.zoho.in/oauth/v2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });

        const rawText = await response.text();
        console.log("📥 Zoho Token Response (Status " + response.status + "):", rawText);

        let data;
        try {
            data = JSON.parse(rawText);
        } catch {
            data = { error: "non_json_response", rawText };
        }

        if (data.access_token) {
            process.env.ZOHO_ACCESS_TOKEN = data.access_token;
            if (data.refresh_token) process.env.ZOHO_REFRESH_TOKEN = data.refresh_token;
            console.log("✅ OAuth tokens stored in process.env");
        }

        res.json({
            success: !data.error,
            message: data.error ? data.error_description || data.error : 'Zoho OAuth callback processed successfully',
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_in: data.expires_in,
            token_type: data.token_type,
            api_domain: data.api_domain,
            ...data
        });
    } catch (err) {
        console.error("❌ Exception during Zoho token exchange:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ========== CREATE ZOHO PAYMENT SESSION ==========
router.post('/create-session', protect, async (req, res) => {
    try {
        console.log('\n' + '='.repeat(60));
        console.log('💳 [create-session] ENDPOINT HIT');
        console.log('='.repeat(60));
        console.log('📥 Request body:', JSON.stringify(req.body, null, 2));

        const { amount, currency = 'INR', description, invoice_number, reference_number, orderId } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid amount is required'
            });
        }

        const sessionResponse = await createPaymentSession({
            amount,
            currency: 'INR',
            description: description || `JewelsKart Order ${orderId || ''}`,
            invoice_number: invoice_number || `INV-${Date.now()}`,
            reference_number: reference_number || (orderId ? orderId.toString() : `REF-${Date.now()}`)
        });

        const sessionId = sessionResponse.payments_session_id;

        if (orderId && sessionId) {
            const order = await Order.findById(orderId);
            if (order) {
                order.zohoSessionId = sessionId;
                await order.save();
                console.log(`✅ Session ${sessionId} saved to order ${orderId}`);
            }
        }

        res.json({
            success: true,
            payments_session_id: sessionId,
            account_id: sessionResponse.account_id,
            amount: sessionResponse.amount,
            currency: sessionResponse.currency
        });

    } catch (error) {
        console.error('❌ Error creating Zoho payment session:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create Zoho payment session'
        });
    }
});

// ========== VERIFY PAYMENT (DIRECT SERVER-TO-SERVER ZOHO CHECK) ==========
router.post('/verify', protect, async (req, res) => {
    try {
        const { payment_id, payments_session_id, zohoSessionId, signature, orderId } = req.body;
        const sessionId = payments_session_id || zohoSessionId;

        const result = await verifyAndConfirmZohoOrder({
            orderId,
            sessionId,
            paymentId: payment_id,
            signature,
            payloadBody: req.body,
            user: req.user
        });

        if (!result.success) {
            return res.status(result.statusCode || 400).json(result);
        }

        return res.json(result);
    } catch (error) {
        console.error('Verification endpoint error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ========== CHECK ORDER PAYMENT STATUS (SERVER-VERIFIED) ==========
router.get('/check-status/:orderId', protect, async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // If still pending, check Zoho server in real-time
        if (order.paymentStatus !== 'SUCCESS' && order.zohoSessionId) {
            const verifyResult = await verifyAndConfirmZohoOrder({
                orderId: order._id,
                sessionId: order.zohoSessionId,
                user: req.user
            });

            if (verifyResult.success && verifyResult.order) {
                return res.json({
                    success: true,
                    paymentStatus: verifyResult.order.paymentStatus,
                    orderStatus: verifyResult.order.orderStatus,
                    paymentId: verifyResult.order.paymentId,
                    order: verifyResult.order
                });
            }
        }

        res.json({
            success: true,
            paymentStatus: order.paymentStatus,
            paymentId: order.paymentId,
            zohoSessionId: order.zohoSessionId,
            orderStatus: order.orderStatus,
            order
        });
    } catch (error) {
        console.error('Check status error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== ZOHO PAYMENTS WEBHOOK ==========
router.post('/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-zoho-signature'] || req.headers['zpay-signature'];
        const signingKey = process.env.ZOHO_SIGNING_KEY;

        if (signingKey && signature) {
            const isValid = verifyZohoSignature(req.body, signature);
            if (!isValid) {
                console.error('❌ Webhook signature verification failed');
                return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
            }
        }

        const event = req.body;
        const eventId = event.event_id || event.id || `${event.event_type}_${Date.now()}`;

        if (processedWebhookEvents.has(eventId)) {
            console.log(`⚠️ Duplicate webhook event ignored: ${eventId}`);
            return res.json({ success: true, message: 'Event already processed' });
        }
        processedWebhookEvents.add(eventId);

        if (processedWebhookEvents.size > 1000) {
            const firstItem = processedWebhookEvents.values().next().value;
            processedWebhookEvents.delete(firstItem);
        }

        const eventType = event.event_type || event.type;
        console.log(`📩 Zoho Webhook Received: ${eventType}`);

        if (eventType === 'payment.succeeded' || eventType === 'paymentsession.paid' || eventType === 'payment_success') {
            const paymentData = event.data || event;
            const referenceNumber = paymentData.reference_number || paymentData.order_id;
            const sessionId = paymentData.payments_session_id || paymentData.session_id;
            const paymentId = paymentData.payment_id || paymentData.id;

            await verifyAndConfirmZohoOrder({
                orderId: referenceNumber,
                sessionId: sessionId,
                paymentId: paymentId,
                payloadBody: event
            });
        }

        res.json({ success: true, message: 'Webhook event processed' });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ========== GET PAYMENT STATUS (BY ID) ==========
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

// ========== GET ZOHO PAYMENT DETAILS BY PAYMENT ID ==========
router.get('/details/:paymentId', protect, async (req, res) => {
    try {
        const { paymentId } = req.params;

        if (!paymentId) {
            return res.status(400).json({ success: false, message: 'Payment ID is required' });
        }

        // First look up the order in our DB by paymentId or zohoPaymentId
        const order = await Order.findOne({
            $or: [
                { paymentId: paymentId },
                { zohoPaymentId: paymentId }
            ]
        });

        // Try to fetch payment details from Zoho Payments API
        const { getZohoAccessToken } = require('../services/zohoPaymentService');
        const accountId = (process.env.ZOHO_ACCOUNT_ID || '').trim();
        const apiDomain = (process.env.ZOHO_API_DOMAIN || 'https://payments.zoho.in').trim();

        let zohoPaymentData = null;
        try {
            const accessToken = await getZohoAccessToken();
            const zohoUrl = `${apiDomain}/api/v1/payments/${paymentId}?account_id=${encodeURIComponent(accountId)}`;
            const zohoRes = await fetch(zohoUrl, {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${accessToken}`,
                    'X-com-zoho-payments-accountid': accountId
                }
            });
            const zohoRaw = await zohoRes.text();
            try {
                const zohoJson = JSON.parse(zohoRaw);
                if (zohoJson.payment || zohoJson.data) {
                    zohoPaymentData = zohoJson.payment || zohoJson.data;
                } else if (zohoJson.code === 0) {
                    zohoPaymentData = zohoJson;
                }
            } catch {
                console.warn('Non-JSON Zoho payment response:', zohoRaw);
            }
        } catch (zohoErr) {
            console.warn('Could not fetch Zoho payment details:', zohoErr.message);
        }

        // Build the comprehensive response from our DB data + Zoho data
        const paymentInfo = {
            id: paymentId,
            payment_id: paymentId,
            status: order?.paymentStatus || zohoPaymentData?.status || 'SUCCESS',
            amount: order?.totalAmount || Number(zohoPaymentData?.amount) || 0,
            currency: zohoPaymentData?.currency || 'INR',
            orderId: order?.orderNumber || (order?._id ? order._id.toString() : null),
            order_id: order?._id || null,
            orderNumber: order?.orderNumber || null,
            order_number: order?.orderNumber || null,
            method: order?.paymentMethod || zohoPaymentData?.payment_method || 'Online',
            paymentMethod: order?.paymentMethod || 'Online',
            payment_method: order?.paymentMethod || 'Online',
            email: order?.customerEmail || zohoPaymentData?.email || null,
            contact: order?.customerPhone || zohoPaymentData?.phone || null,
            customer_name: order?.customerName || null,
            customer_email: order?.customerEmail || null,
            customer_phone: order?.customerPhone || null,
            zoho_session_id: order?.zohoSessionId || null,
            created_at: order?.paymentDate || order?.createdAt || null,
            refundId: order?.refundId || null,
            refundAmount: order?.refundAmount || 0,
            ...(zohoPaymentData || {})
        };

        res.json({
            success: true,
            payment: paymentInfo
        });

    } catch (error) {
        console.error('Payment details fetch error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
module.exports.verifyAndConfirmZohoOrder = verifyAndConfirmZohoOrder;