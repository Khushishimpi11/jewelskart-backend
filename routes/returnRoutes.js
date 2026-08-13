const express = require("express");
const router = express.Router();
const ReturnRequest = require("../models/ReturnRequest");
const Notification = require("../models/Notification");
const notificationService = require("../services/notificationService");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const { protect, adminOnly, customerOnly } = require("../middleware/auth");

// ============ CREATE RETURN/EXCHANGE/CANCEL REQUEST ============
router.post("/request", protect, customerOnly, async (req, res) => {
  try {
    const {
      orderId, productId, productName, quantity, price,
      reason, description, requestType, images, video,
      refundDetails, exchangeDetails
    } = req.body;

    const customer = await Customer.findOne({ email: req.user.email });
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    let productImage = '';
    if (productId) {
      const product = await Product.findById(productId);
      if (product && product.images && product.images.length > 0) {
        productImage = product.images[0];
      }
    }

    // Process refund details
    let finalRefundDetails = { method: 'original' };
    if (refundDetails && requestType === 'return') {
      if (refundDetails.method === 'upi' && refundDetails.upiId) {
        finalRefundDetails = { method: 'upi', upiId: refundDetails.upiId };
      } else if (refundDetails.method === 'bank' && refundDetails.bankDetails) {
        finalRefundDetails = {
          method: 'bank',
          bankDetails: {
            accountHolderName: refundDetails.bankDetails.accountHolderName || '',
            accountNumber: refundDetails.bankDetails.accountNumber || '',
            bankName: refundDetails.bankDetails.bankName || '',
            ifscCode: refundDetails.bankDetails.ifscCode || ''
          }
        };
      }
    }

    // Process exchange details
    let finalExchangeDetails = {};
    if (exchangeDetails && requestType === 'exchange') {
      console.log("📦 Processing exchange details:", exchangeDetails);

      const exchangeProduct = await Product.findById(exchangeDetails.exchangeProductId);
      if (exchangeProduct) {
        const originalPrice = price || 0;
        const exchangePrice = exchangeProduct.price || 0;
        const priceDifference = exchangePrice - originalPrice;

        finalExchangeDetails = {
          exchangeProductId: exchangeProduct._id,
          exchangeProductName: exchangeProduct.name,
          exchangeProductImage: exchangeProduct.images?.[0] || '',
          exchangeProductPrice: exchangePrice,
          originalProductPrice: originalPrice,
          priceDifference: priceDifference,
          differencePaymentMethod: exchangeDetails.differencePaymentMethod || '',
          differencePaymentDetails: exchangeDetails.differencePaymentDetails || {},
          differencePaymentStatus: priceDifference > 0 ? 'pending' : (priceDifference < 0 ? 'processing' : 'completed'),
          returnShippingTracking: '',
          exchangeShippingTracking: '',
          returnReceived: false,
          exchangeShipped: false
        };

        console.log("✅ Exchange details saved:", finalExchangeDetails);
      } else {
        console.log("❌ Exchange product not found:", exchangeDetails.exchangeProductId);
      }
    }

    const returnRequest = await ReturnRequest.create({
      orderId,
      orderNumber: order.orderNumber,
      customerId: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone || '',
      productId,
      productName,
      productImage,
      quantity,
      price: price || 0,
      reason,
      description,
      requestType,
      images: images || [],
      video: video || null,
      refundDetails: finalRefundDetails,
      exchangeDetails: finalExchangeDetails,
      status: "pending",
      refundAmount: (price || 0) * quantity,
      createdAt: new Date()
    });

    // ✅ AUTO-UPDATE ORDER STATUS BASED ON REQUEST TYPE
    if (requestType === "cancel") {
      order.orderStatus = "Cancelled";
      order.cancellationReason = reason;
      order.cancelledAt = new Date();
      await order.save();
    } else if (requestType === "return") {
      order.orderStatus = "Return Requested";
      order.returnRequestId = returnRequest._id;
      await order.save();
    } else if (requestType === "exchange") {
      order.orderStatus = "Exchange Requested";
      order.exchangeRequestId = returnRequest._id;
      await order.save();
    }

    // Notify Admins
    try {
      if (requestType === "cancel") {
        await notificationService.sendOrderCancelled(order);
      } else if (requestType === "return") {
        await notificationService.sendReturnRequest(returnRequest, order);
      } else if (requestType === "exchange") {
        await notificationService.sendExchangeRequest(returnRequest, order);
      }
    } catch (adminNotifErr) {
      console.error("Admin notification error:", adminNotifErr);
    }

    await Notification.create({
      userId: customer._id,
      userEmail: customer.email,
      type: requestType === 'exchange' ? 'exchange_submitted' : requestType === 'cancel' ? 'order_cancelled' : 'return_submitted',
      title: `${requestType === "cancel" ? "Cancellation" : requestType === "return" ? "Return" : "Exchange"} Request Submitted 🔄`,
      message: `Your ${requestType} request for ${productName} has been submitted. We'll review it within 2-3 days.`,
      actionLink: "/orders",
      isRead: false
    });

    res.status(201).json({
      success: true,
      message: `${requestType} request submitted successfully`,
      request: returnRequest,
      orderStatus: order.orderStatus
    });

  } catch (error) {
    console.error("Request error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ GET MY REQUESTS ============
router.get("/my-requests", protect, customerOnly, async (req, res) => {
  try {
    const customer = await Customer.findOne({ email: req.user.email });
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const requests = await ReturnRequest.find({ customerId: customer._id })
      .sort({ createdAt: -1 });

    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ADMIN: GET ALL REQUESTS ============
router.get("/admin/all", protect, adminOnly, async (req, res) => {
  try {
    const requests = await ReturnRequest.find().sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ADMIN: APPROVE REQUEST ============
router.put("/admin/:id/approve", protect, adminOnly, async (req, res) => {
  try {
    const { adminNote } = req.body;

    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    returnRequest.status = "approved";
    returnRequest.adminNote = adminNote || "Request approved";
    returnRequest.updatedAt = new Date();
    await returnRequest.save();

    const order = await Order.findById(returnRequest.orderId);

    if (returnRequest.requestType === "cancel") {
      order.orderStatus = "Cancelled";
      order.cancellationReason = returnRequest.reason;
      order.cancelledAt = new Date();
      await order.save();
    }
    else if (returnRequest.requestType === "return") {
      order.orderStatus = "Return Approved";
      order.returnRequestId = returnRequest._id;
      await order.save();
    }
    else if (returnRequest.requestType === "exchange") {
      order.orderStatus = "Exchange Approved";
      order.exchangeRequestId = returnRequest._id;
      await order.save();
    }

    await Notification.create({
      userId: returnRequest.customerId,
      userEmail: returnRequest.customerEmail,
      type: returnRequest.requestType === 'exchange' ? 'exchange_approved' : returnRequest.requestType === 'cancel' ? 'order_cancelled' : 'return_approved',
      title: `${returnRequest.requestType === "cancel" ? "Cancellation" : returnRequest.requestType === "return" ? "Return" : "Exchange"} Request Approved ✅`,
      message: `Your ${returnRequest.requestType} request for ${returnRequest.productName} has been approved.`,
      actionLink: "/orders",
      isRead: false
    });

    res.json({ success: true, message: "Request approved", request: returnRequest, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ADMIN: UNDER REVIEW ============
router.put("/admin/:id/under-review", protect, adminOnly, async (req, res) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    const order = await Order.findById(returnRequest.orderId);

    if (returnRequest.requestType === "return") {
      order.orderStatus = "Return Under Review";
    } else if (returnRequest.requestType === "exchange") {
      order.orderStatus = "Exchange Under Review";
    }
    await order.save();

    res.json({ success: true, message: "Request under review" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ADMIN: PICKUP SCHEDULED ============
router.put("/admin/:id/pickup-scheduled", protect, adminOnly, async (req, res) => {
  try {
    const { pickupDate, trackingNumber } = req.body;
    const returnRequest = await ReturnRequest.findById(req.params.id);

    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    returnRequest.returnTrackingNumber = trackingNumber;
    returnRequest.returnPickupScheduled = new Date(pickupDate);
    await returnRequest.save();

    const order = await Order.findById(returnRequest.orderId);
    order.returnTrackingNumber = trackingNumber;

    if (returnRequest.requestType === "return") {
      order.orderStatus = "Return Pickup Scheduled";
    } else if (returnRequest.requestType === "exchange") {
      order.orderStatus = "Exchange Pickup Scheduled";
    }
    await order.save();

    await Notification.create({
      userId: returnRequest.customerId,
      userEmail: returnRequest.customerEmail,
      type: returnRequest.requestType === 'exchange' ? 'exchange' : 'return',
      title: "Pickup Scheduled",
      message: `Pickup for your ${returnRequest.requestType} request has been scheduled on ${new Date(pickupDate).toLocaleDateString()}. Tracking: ${trackingNumber}`,
      isRead: false
    });

    res.json({ success: true, message: "Pickup scheduled" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ADMIN: PICKED UP ============
router.put("/admin/:id/picked-up", protect, adminOnly, async (req, res) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    const order = await Order.findById(returnRequest.orderId);

    if (returnRequest.requestType === "return") {
      order.orderStatus = "Return Picked Up";
    } else if (returnRequest.requestType === "exchange") {
      order.orderStatus = "Exchange Picked Up";
    }
    await order.save();

    await Notification.create({
      userId: returnRequest.customerId,
      userEmail: returnRequest.customerEmail,
      type: returnRequest.requestType === 'exchange' ? 'exchange' : 'return',
      title: "Product Picked Up",
      message: `Your product for ${returnRequest.requestType} has been picked up successfully.`,
      isRead: false
    });

    res.json({ success: true, message: "Pickup confirmed" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ADMIN: QUALITY CHECK PASSED ============
router.put("/admin/:id/quality-check", protect, adminOnly, async (req, res) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    const order = await Order.findById(returnRequest.orderId);

    if (returnRequest.requestType === "return") {
      order.orderStatus = "Return Quality Check";
    } else if (returnRequest.requestType === "exchange") {
      order.orderStatus = "Exchange Quality Check";
    }
    await order.save();

    res.json({ success: true, message: "Quality check passed" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ADMIN: REFUND INITIATED ============
router.put("/admin/:id/refund-initiated", protect, adminOnly, async (req, res) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    const order = await Order.findById(returnRequest.orderId);
    order.orderStatus = "Return Refund Initiated";
    await order.save();

    await Notification.create({
      userId: returnRequest.customerId,
      userEmail: returnRequest.customerEmail,
      type: "refund_initiated",
      title: "Refund Initiated 💰",
      message: `Refund of ₹${returnRequest.refundAmount} for ${returnRequest.productName} has been initiated.`,
      actionLink: "/orders",
      isRead: false
    });

    res.json({ success: true, message: "Refund initiated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ADMIN: REFUND COMPLETED ============
router.put("/admin/:id/refund-completed", protect, adminOnly, async (req, res) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    returnRequest.refundStatus = "completed";
    returnRequest.status = "completed";
    await returnRequest.save();

    const order = await Order.findById(returnRequest.orderId);
    order.paymentStatus = "Refunded";
    order.orderStatus = "Return Refund Completed";
    await order.save();

    // Notify Admins
    try {
      await notificationService.sendRefundCompleted(order, returnRequest.refundAmount);
    } catch (adminNotifErr) {
      console.error("Admin notification error:", adminNotifErr);
    }

    await Notification.create({
      userId: returnRequest.customerId,
      userEmail: returnRequest.customerEmail,
      type: "refund_completed",
      title: "Refund Completed ✅",
      message: `Refund of ₹${returnRequest.refundAmount} for ${returnRequest.productName} has been completed.`,
      actionLink: "/orders",
      isRead: false
    });

    res.json({ success: true, message: "Refund completed" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ADMIN: REPLACEMENT PROCESSING (Exchange) ============
router.put("/admin/:id/replacement-processing", protect, adminOnly, async (req, res) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    const order = await Order.findById(returnRequest.orderId);
    order.orderStatus = "Exchange Replacement Processing";
    await order.save();

    res.json({ success: true, message: "Replacement processing started" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ADMIN: SHIP EXCHANGE PRODUCT ============
router.put("/admin/:id/ship-exchange", protect, adminOnly, async (req, res) => {
  try {
    const { exchangeShippingTracking } = req.body;

    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    if (returnRequest.requestType !== 'exchange') {
      return res.status(400).json({ success: false, message: "Not an exchange request" });
    }

    returnRequest.status = "exchange_shipped";
    returnRequest.exchangeTrackingNumber = exchangeShippingTracking;
    returnRequest.exchangeDetails.exchangeShippingTracking = exchangeShippingTracking;
    returnRequest.exchangeDetails.exchangeShipped = true;
    returnRequest.exchangeDetails.exchangeShippedDate = new Date();
    await returnRequest.save();

    const order = await Order.findById(returnRequest.orderId);
    order.exchangeTrackingNumber = exchangeShippingTracking;
    order.orderStatus = "Exchange Shipped";
    await order.save();

    await Notification.create({
      userId: returnRequest.customerId,
      userEmail: returnRequest.customerEmail,
      type: "exchange",
      title: "Exchange Product Shipped",
      message: `Your exchange product has been shipped. Tracking: ${exchangeShippingTracking}`,
      isRead: false
    });

    res.json({ success: true, message: "Exchange product shipped" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ADMIN: EXCHANGE DELIVERED ============
router.put("/admin/:id/exchange-delivered", protect, adminOnly, async (req, res) => {
  try {
    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    const order = await Order.findById(returnRequest.orderId);
    order.orderStatus = "Exchange Delivered";
    await order.save();

    res.json({ success: true, message: "Exchange product delivered" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ADMIN: REJECT REQUEST ============
router.put("/admin/:id/reject", protect, adminOnly, async (req, res) => {
  try {
    const { adminNote } = req.body;

    const returnRequest = await ReturnRequest.findById(req.params.id);
    if (!returnRequest) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    returnRequest.status = "rejected";
    returnRequest.adminNote = adminNote || "Request rejected";
    await returnRequest.save();

    await Notification.create({
      userId: returnRequest.customerId,
      userEmail: returnRequest.customerEmail,
      type: returnRequest.requestType === 'exchange' ? 'exchange_rejected' : 'return_rejected',
      title: `${returnRequest.requestType === "cancel" ? "Cancellation" : returnRequest.requestType === "return" ? "Return" : "Exchange"} Request Rejected ❌`,
      message: `Your ${returnRequest.requestType} request for ${returnRequest.productName} has been rejected. Reason: ${adminNote || "Product condition not eligible"}`,
      actionLink: "/orders",
      isRead: false
    });

    res.json({ success: true, message: "Request rejected", request: returnRequest });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ GET AVAILABLE PRODUCTS FOR EXCHANGE ============
router.get("/available-products", protect, customerOnly, async (req, res) => {
  try {
    const { category, maxPrice, search, excludeProductId } = req.query;

    let query = {
      isActive: true,
      status: "active",
      stock: { $gt: 0 }
    };

    if (category) query.category = category;
    if (maxPrice) query.price = { $lte: parseInt(maxPrice) };
    if (excludeProductId) query._id = { $ne: excludeProductId };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const products = await Product.find(query).limit(50);

    res.json({
      success: true,
      products: products.map(function (p) {
        return {
          _id: p._id,
          id: p._id,
          name: p.name,
          price: p.price,
          image: p.images && p.images[0] ? p.images[0] : '',
          category: p.category,
          stock: p.stock,
          description: p.description
        };
      })
    });
  } catch (error) {
    console.error("Get available products error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;