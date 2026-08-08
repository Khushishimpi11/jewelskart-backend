const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const Product = require("../models/Product");
const Tracking = require("../models/Tracking");
const Customer = require("../models/Customer");
const { protect, adminOnly, customerOnly } = require("../middleware/auth");
const { createPaymentSession, verifyZohoSignature } = require("../services/zohoPaymentService");
const { sendOrderConfirmationEmail } = require("../services/emailService");
const notificationService = require("../services/notificationService");

// Helper: Map order status to tracking status
function mapOrderStatusToTracking(orderStatus) {
  const mapping = {
    "Confirmed": "CONFIRMED",
    "Processing": "PROCESSING",
    "Shipped": "SHIPPED",
    "Out for Delivery": "OUT_FOR_DELIVERY",
    "Delivered": "DELIVERED",
    "Cancelled": "CANCELLED",
    "Return Requested": "RETURN_REQUESTED",
    "Return Approved": "RETURN_APPROVED",
    "Exchange Requested": "EXCHANGE_REQUESTED",
    "Exchange Approved": "EXCHANGE_APPROVED"
  };
  return mapping[orderStatus] || "CONFIRMED";
}

// ============ CREATE ORDER WITH SIZE SUPPORT ============
router.post("/create", protect, customerOnly, async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, notes, customerPhone } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "No items in order" });
    }

    let subtotal = 0;
    let totalGstAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);

      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found` });
      }

      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}`
        });
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      const gstPercent = product.gst !== undefined ? product.gst : 3;
      const priceExclGst = Number((product.price / (1 + gstPercent / 100)).toFixed(2));
      const itemGstAmount = Number((itemTotal - (priceExclGst * item.quantity)).toFixed(2));
      totalGstAmount += itemGstAmount;

      const productImageUrl = product.mainImage?.url || product.images?.[0] || "";

      orderItems.push({
        productId: product._id,
        productName: product.name,
        productSku: product.sku,
        productImage: productImageUrl,
        quantity: item.quantity,
        price: product.price,
        total: itemTotal,
        size: item.size || item.selectedSize || "",
        priceExclGst,
        gstPercent,
        gstAmount: itemGstAmount
      });

      console.log(`📦 Order item: ${product.name}, Size: ${item.size || item.selectedSize || 'Not specified'}, GST: ${gstPercent}%`);

      product.stock -= item.quantity;
      await product.save();
    }

    // ✅ Shipping rule: free above ₹5000, else ₹250 (matches frontend)
    const shippingCharge = subtotal >= 5000 ? 0 : 250;
    const tax = Number(totalGstAmount.toFixed(2));
    const totalAmount = subtotal + shippingCharge;
    const totalExclGst = Number((subtotal - tax).toFixed(2));

    const user = req.user;

    let customer = await Customer.findOne({ email: user.email });

    if (!customer) {
      customer = await Customer.create({
        name: user.name,
        email: user.email,
        password: user.password || "temp123",
        phone: customerPhone || "",
        address: {
          street: shippingAddress?.street || "",
          city: shippingAddress?.city || "",
          state: shippingAddress?.state || "",
          pincode: shippingAddress?.pincode || "",
          country: shippingAddress?.country || "India"
        },
        isActive: true,
        totalSpent: 0,
        orderCount: 0
      });
      console.log(`✅ New customer created: ${customer.name} (${customer._id})`);
    }

    // ✅ Always sync customer name from JWT user (fixes name mismatch between User & Customer collections)
    if (customer.name !== user.name && user.name) {
      customer.name = user.name;
      await customer.save();
      console.log(`✅ Customer name synced from JWT: ${user.name}`);
    }

    // Create order with pending payment status
    const order = await Order.create({
      userId: user.id,
      customerId: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customerPhone || "",
      shippingAddress,
      items: orderItems,
      subtotal,
      shippingCharge,
      tax,
      gstAmount: tax,
      totalExclGst,
      totalAmount,
      paymentMethod: paymentMethod || "ONLINE",
      paymentStatus: "PENDING",
      notes: notes || "",
      orderStatus: paymentMethod === "COD" ? "Confirmed" : "Pending Payment",
      statusHistory: [{
        status: paymentMethod === "COD" ? "Confirmed" : "Pending Payment",
        note: paymentMethod === "COD" ? "Order confirmed successfully" : "Awaiting payment confirmation",
        updatedBy: customer.name,
        date: new Date()
      }]
    });

    console.log(`✅ Order created: ${order.orderNumber} with customerId: ${order.customerId}`);
    console.log(`📦 Order items with sizes:`, order.items.map(i => ({ name: i.productName, size: i.size })));

    const trackingId = `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const tracking = await Tracking.create({
      trackingId: trackingId,
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: paymentMethod === "COD" ? "CONFIRMED" : "PENDING_PAYMENT",
      currentLocation: paymentMethod === "COD" ? "Order Confirmed" : "Awaiting Payment",
      timeline: [{
        status: paymentMethod === "COD" ? "CONFIRMED" : "PENDING_PAYMENT",
        location: paymentMethod === "COD" ? "Order Confirmed" : "Awaiting Payment",
        description: paymentMethod === "COD" ? "Your order has been confirmed" : "Please complete payment to confirm order",
        date: new Date()
      }]
    });

    order.trackingNumber = tracking.trackingId;
    await order.save();

    const allOrders = await Order.find({ customerEmail: customer.email });
    const totalSpent = allOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    await Customer.findByIdAndUpdate(customer._id, {
      $set: {
        orderCount: allOrders.length,
        totalSpent: totalSpent,
        phone: customerPhone || customer.phone,
        "address.street": shippingAddress?.street || customer.address?.street,
        "address.city": shippingAddress?.city || customer.address?.city,
        "address.state": shippingAddress?.state || customer.address?.state,
        "address.pincode": shippingAddress?.pincode || customer.address?.pincode
      }
    });

    // ============ SEND ORDER CONFIRMATION EMAIL ============
    if (paymentMethod === "COD") {
      try {
        const emailItems = orderItems.map(item => ({
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          size: item.size || "",
          productImage: item.productImage || "",
          productSku: item.productSku
        }));

        await sendOrderConfirmationEmail({
          orderNumber: order.orderNumber,
          customerEmail: customer.email,
          customerName: customer.name,
          customerPhone: customerPhone || customer.phone || "",
          items: emailItems,
          subtotal: subtotal,
          shippingCharge: shippingCharge,
          tax: tax,
          totalAmount: totalAmount,
          shippingAddress: shippingAddress,
          paymentMethod: paymentMethod,
          createdAt: order.createdAt,
          trackingId: tracking.trackingId
        });
        console.log(`📧 Order confirmation email sent for order ${order.orderNumber}`);
      } catch (emailError) {
        console.error("❌ Email sending failed:", emailError.message);
      }

      // Notify Admins and Customer of new order
      try {
        await notificationService.sendNewOrder(order);
        await notificationService.sendToCustomer(user.id, customer.email, {
          type: "order",
          title: "🛍️ Order Placed Successfully!",
          message: `Your order #${order.orderNumber} for ₹${totalAmount.toLocaleString('en-IN')} has been placed successfully.`,
          relatedData: { orderId: order._id }
        });
      } catch (notifErr) {
        console.error("Order creation notify error:", notifErr);
      }
    }

    // If payment method is online, create Zoho Payment session
    let zohoSession = null;
    if (paymentMethod !== "COD") {
      try {
        zohoSession = await createPaymentSession({
          amount: totalAmount,
          currency: 'INR',
          description: `JewelsKart Order #${order.orderNumber}`,
          reference_number: order._id.toString(),
          invoice_number: `INV-${order.orderNumber}`
        });

        const sessionId = zohoSession.payments_session_id || zohoSession.session_id || zohoSession.id;
        if (sessionId) {
          order.zohoSessionId = sessionId;
          await order.save();
          console.log(`✅ Zoho Payment Session created: ${sessionId} for order ${order.orderNumber}`);
        }
      } catch (zErr) {
        console.error("Zoho payment session error:", zErr.message);
      }
    }

    res.status(201).json({
      success: true,
      message: paymentMethod === "COD" ? "Order confirmed successfully" : "Order created. Please complete payment.",
      order,
      tracking,
      zohoSession: zohoSession ? {
        payments_session_id: zohoSession.payments_session_id || zohoSession.session_id || zohoSession.id,
        amount: totalAmount,
        currency: 'INR',
        account_id: process.env.ZOHO_ACCOUNT_ID
      } : null
    });

  } catch (error) {
    console.error("Order creation error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ UPDATE PAYMENT STATUS AFTER SUCCESS ============
router.post("/update-payment-status", protect, async (req, res) => {
  try {
    const { orderId, paymentId, payments_session_id, zohoSessionId, signature } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const signingKey = process.env.ZOHO_SIGNING_KEY;
    let isValidSignature = true;
    const activeSessionId = payments_session_id || zohoSessionId || order.zohoSessionId;

    if (signingKey && signature) {
      const crypto = require('crypto');
      const body = activeSessionId ? activeSessionId + "|" + paymentId : paymentId;
      const expectedSignature = crypto
        .createHmac('sha256', signingKey)
        .update(body.toString())
        .digest('hex');

      if (expectedSignature !== signature) {
        isValidSignature = verifyZohoSignature(req.body, signature);
      }
    }

    if (!isValidSignature) {
      try {
        await notificationService.sendPaymentFailed(order);
      } catch (notifErr) {
        console.error("Payment failed notify error:", notifErr);
      }
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    order.paymentStatus = "SUCCESS";
    order.paymentId = paymentId || order.paymentId;
    if (activeSessionId) order.zohoSessionId = activeSessionId;
    order.orderStatus = "Confirmed";
    order.paymentDate = new Date();
    order.statusHistory.push({
      status: "Confirmed",
      note: "Payment received successfully. Order confirmed.",
      updatedBy: order.customerName,
      date: new Date()
    });

    await order.save();

    const tracking = await Tracking.findOne({ orderId: order._id });
    if (tracking) {
      tracking.status = "CONFIRMED";
      tracking.currentLocation = "Order Confirmed";
      tracking.timeline.push({
        status: "CONFIRMED",
        location: "Order Confirmed",
        description: "Payment received. Order confirmed.",
        date: new Date()
      });
      await tracking.save();
    }

    // Send order confirmation email for online payment
    try {
      const customer = await Customer.findById(order.customerId);

      const emailItems = order.items.map(item => ({
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        size: item.size || "",
        productImage: item.productImage || "",
        productSku: item.productSku
      }));

      await sendOrderConfirmationEmail({
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        customerPhone: order.customerPhone || customer?.phone || "",
        items: emailItems,
        subtotal: order.subtotal,
        shippingCharge: order.shippingCharge,
        tax: order.tax,
        totalAmount: order.totalAmount,
        shippingAddress: order.shippingAddress,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt
      });
      console.log(`📧 Order confirmation email sent for order ${order.orderNumber}`);
    } catch (emailError) {
      console.error("❌ Email sending failed:", emailError.message);
    }

    // Notify Admins and Customer of payment success & new order
    try {
      await notificationService.sendNewOrder(order);
      await notificationService.sendPaymentReceived(order);
      await notificationService.sendToCustomer(order.userId || order.customerId, order.customerEmail, {
        type: "payment_successful",
        title: "Payment Successful 💳",
        message: `Payment of ₹${order.totalAmount.toLocaleString('en-IN')} for order #${order.orderNumber} was successful.`,
        actionLink: "/orders",
        relatedData: { orderId: order._id }
      });
      await notificationService.sendCustomerOrderStatusNotification(order, "Confirmed");
    } catch (notifErr) {
      console.error("Order payment confirmation notify error:", notifErr);
    }

    console.log(`✅ Payment successful for order ${order.orderNumber}. Payment ID: ${paymentId}`);

    res.json({
      success: true,
      message: "Payment verified and order confirmed",
      order: order
    });

  } catch (error) {
    console.error("Payment update error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ UPDATE ORDER STATUS ============
router.put("/admin/:id/status", protect, adminOnly, async (req, res) => {
  try {
    const { status, note } = req.body;

    const validStatuses = [
      "Confirmed", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled",
      "Return Requested", "Return Under Review", "Return Approved",
      "Return Pickup Scheduled", "Return Picked Up", "Return Quality Check",
      "Return Refund Initiated", "Return Refund Completed",
      "Exchange Requested", "Exchange Under Review", "Exchange Approved",
      "Exchange Pickup Scheduled", "Exchange Picked Up", "Exchange Quality Check",
      "Exchange Replacement Processing", "Exchange Shipped", "Exchange Delivered"
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.orderStatus = status;
    order.statusHistory.push({
      status,
      note: note || `Order status changed to ${status}`,
      updatedBy: req.user.name,
      date: new Date()
    });

    await order.save();

    let tracking = await Tracking.findOne({ orderId: order._id });

    if (!tracking) {
      const trackingId = `TRK${Date.now()}${Math.floor(Math.random() * 1000)}`;
      tracking = await Tracking.create({
        trackingId: trackingId,
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: mapOrderStatusToTracking(status),
        currentLocation: status,
        timeline: [{
          status: mapOrderStatusToTracking(status),
          location: status,
          description: `Order ${status}`,
          date: new Date()
        }]
      });
      order.trackingNumber = tracking.trackingId;
      await order.save();
    } else {
      tracking.status = mapOrderStatusToTracking(status);
      tracking.currentLocation = status;
      tracking.timeline.push({
        status: mapOrderStatusToTracking(status),
        location: status,
        description: `Order ${status}`,
        date: new Date()
      });
      await tracking.save();
    }

    // Notify admins and customer of status updates
    try {
      await notificationService.sendCustomerOrderStatusNotification(order, status);

      if (status === "Shipped") {
        await notificationService.sendOrderShipped(order);
      } else if (status === "Delivered") {
        await notificationService.sendOrderDelivered(order);
      } else if (status === "Cancelled") {
        await notificationService.sendOrderCancelled(order);
      }
    } catch (notifError) {
      console.error("Error triggering order update notification:", notifError);
    }

    console.log(`✅ Order ${order.orderNumber} status updated to ${status}`);

    res.status(200).json({
      success: true,
      message: `Order status updated to ${status}`,
      order,
      tracking
    });

  } catch (error) {
    console.error("Status update error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ GET ALL ORDERS (Admin) ============
router.get("/admin/all", protect, adminOnly, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("customerId", "name email customerId phone")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error("Get all orders error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ GET MY ORDERS (With size field) ============
router.get("/my-orders", protect, customerOnly, async (req, res) => {
  try {
    const customer = await Customer.findOne({ email: req.user.email });

    if (!customer) {
      return res.status(200).json({ success: true, orders: [] });
    }

    const orders = await Order.find({ customerId: customer._id })
      .sort({ createdAt: -1 });

    console.log(`📦 Found ${orders.length} orders for customer ${customer.email}`);
    orders.forEach(order => {
      order.items.forEach(item => {
        console.log(`  - ${item.productName}: Size = ${item.size || 'Not specified'}`);
      });
    });

    res.status(200).json({ success: true, orders });
  } catch (error) {
    console.error("Error fetching my orders:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ GET SINGLE ORDER ============
router.get("/:id", protect, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("customerId", "name email customerId");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ GET TRACKING ============
router.get("/tracking/:trackingId", protect, async (req, res) => {
  try {
    const tracking = await Tracking.findOne({ trackingId: req.params.trackingId });
    if (!tracking) {
      return res.status(404).json({ success: false, message: "Tracking not found" });
    }
    res.status(200).json({ success: true, tracking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ DELETE ORDER (UPDATED with Cascade) ============
router.delete("/admin/:id", protect, adminOnly, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    console.log(`🗑️ Deleting order: ${order.orderNumber} for customer: ${order.customerEmail}`);

    // Delete tracking record
    await Tracking.findOneAndDelete({ orderId: order._id });

    // Delete the order
    await order.deleteOne();

    // Update customer stats
    const customer = await Customer.findOne({ email: order.customerEmail });
    if (customer) {
      const allOrders = await Order.find({ customerEmail: customer.email });
      customer.orderCount = allOrders.length;
      customer.totalSpent = allOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      await customer.save();
      console.log(`✅ Updated customer stats: ${customer.name} - ${customer.orderCount} orders, ₹${customer.totalSpent}`);
    }

    res.status(200).json({
      success: true,
      message: "Order deleted successfully",
      deletedOrderId: order._id,
      deletedOrderNumber: order.orderNumber
    });
  } catch (error) {
    console.error("Delete order error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ DELETE ALL ORDERS (Admin) ============
router.delete("/admin/delete-all", protect, adminOnly, async (req, res) => {
  try {
    console.log("🗑️ Deleting all orders...");

    const result = await Order.deleteMany({});
    await Tracking.deleteMany({});

    // Update all customers stats to 0
    await Customer.updateMany({}, { $set: { orderCount: 0, totalSpent: 0 } });

    console.log(`✅ Deleted ${result.deletedCount} orders`);

    res.status(200).json({
      success: true,
      message: `All ${result.deletedCount} orders deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error("Delete all orders error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ SYNC CUSTOMERS (Admin) ============
router.post("/admin/sync-customers", protect, adminOnly, async (req, res) => {
  try {
    const customers = await Customer.find();
    let updatedCount = 0;

    for (const customer of customers) {
      const orders = await Order.find({ customerEmail: customer.email });
      const totalSpent = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const orderCount = orders.length;

      if (customer.orderCount !== orderCount || customer.totalSpent !== totalSpent) {
        customer.orderCount = orderCount;
        customer.totalSpent = totalSpent;
        await customer.save();
        updatedCount++;
        console.log(`✅ Synced ${customer.name}: ${orderCount} orders, ₹${totalSpent}`);
      }
    }

    res.json({
      success: true,
      message: `Synced ${updatedCount} customers`,
      updatedCount
    });
  } catch (error) {
    console.error("Sync customers error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;