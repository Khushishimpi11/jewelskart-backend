const Notification = require("../models/Notification");
const User = require("../models/User");

class NotificationService {
  
  // ========== SEND TO ALL ADMINS ==========
  async sendToAdmins(notificationData) {
    try {
      const admins = await User.find({ role: "admin", isActive: true });
      if (admins.length === 0) return [];
      
      const notifications = admins.map(admin => ({
        adminId: admin._id,
        forRole: "admin",
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        priority: notificationData.priority || this.getPriorityByType(notificationData.type),
        actionRequired: notificationData.actionRequired || false,
        actionLink: notificationData.actionLink || null,
        relatedData: notificationData.relatedData || {}
      }));
      
      const saved = await Notification.insertMany(notifications);
      console.log(`📧 Sent ${notifications.length} admin notifications: ${notificationData.type}`);
      return saved;
    } catch (error) {
      console.error("Error sending admin notification:", error);
      return [];
    }
  }
  
  // ========== SEND TO SPECIFIC ADMIN ==========
  async sendToAdmin(adminId, notificationData) {
    try {
      const notification = new Notification({
        adminId: adminId,
        forRole: "admin",
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        priority: notificationData.priority || this.getPriorityByType(notificationData.type),
        actionRequired: notificationData.actionRequired || false,
        actionLink: notificationData.actionLink || null,
        relatedData: notificationData.relatedData || {}
      });
      await notification.save();
      return notification;
    } catch (error) {
      console.error("Error:", error);
      return null;
    }
  }
  
  // ========== SEND TO CUSTOMER ==========
  async sendToCustomer(userId, userEmail, notificationData) {
    try {
      const notification = new Notification({
        userId: userId,
        userEmail: userEmail,
        forRole: "customer",
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        relatedData: notificationData.relatedData || {}
      });
      await notification.save();
      return notification;
    } catch (error) {
      console.error("Error:", error);
      return null;
    }
  }
  
  // ========== GET PRIORITY BY TYPE ==========
  getPriorityByType(type) {
    const priorities = {
      // Urgent
      'out_of_stock': 'urgent',
      'payment_failed': 'urgent',
      'system_error': 'urgent',
      'customer_complaint': 'urgent',
      // High
      'low_stock': 'high',
      'new_order': 'high',
      'order_cancelled': 'high',
      'return_request': 'high',
      'exchange_request': 'high',
      'refund_completed': 'high',
      // Medium
      'payment_received': 'medium',
      'refund_processed': 'medium',
      'back_in_stock': 'medium',
      'return_exchange_approved': 'medium',
      'return_exchange_rejected': 'medium',
      'order_shipped': 'medium',
      'order_delivered': 'medium',
      'new_review': 'medium',
      'db_backup': 'medium',
      'cms_update': 'medium',
      // Low
      'new_customer': 'low',
      'system': 'low'
    };
    return priorities[type] || 'medium';
  }
  
  // ========== ADMIN HELPER METHODS ==========
  async getAdminUnreadCount(adminId, bellClearedAt = null) {
    let query = { adminId, isRead: false, forRole: "admin" };
    if (bellClearedAt) {
      query.createdAt = { $gt: bellClearedAt };
    }
    return await Notification.countDocuments(query);
  }
  
  async getAdminNotifications(adminId, limit = 50, skip = 0, filter = {}, bellClearedAt = null) {
    let query = { adminId, forRole: "admin", ...filter };
    if (bellClearedAt) {
      query.createdAt = { $gt: bellClearedAt };
    }
    return await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  // ========== CUSTOMER ORDER STATUS NOTIFICATION SENDER ==========
  async sendCustomerOrderStatusNotification(order, status) {
    if (!order) return;
    
    const customerId = order.userId || order.customerId;
    const customerEmail = order.customerEmail;
    if (!customerId && !customerEmail) return;

    const statusMap = {
      "Confirmed": {
        type: "order_confirmed",
        title: "Order Confirmed! 🎉",
        message: `Your order #${order.orderNumber} has been confirmed.`
      },
      "Processing": {
        type: "order_processing",
        title: "Order Processing ⚙️",
        message: `Your order #${order.orderNumber} is now being processed.`
      },
      "Packed": {
        type: "order_packed",
        title: "Order Packed 📦",
        message: `Your order #${order.orderNumber} has been packed and is ready for shipment.`
      },
      "Shipped": {
        type: "order_shipped",
        title: "Order Shipped 🚚",
        message: `Your order #${order.orderNumber} has been shipped and is on its way.`
      },
      "Out for Delivery": {
        type: "order_out_for_delivery",
        title: "Out for Delivery 🛵",
        message: `Your order #${order.orderNumber} is out for delivery today!`
      },
      "Delivered": {
        type: "order_delivered",
        title: "Order Delivered 🎁",
        message: `Your order #${order.orderNumber} has been delivered successfully. Thank you for shopping with JewelsKart!`
      },
      "Cancelled": {
        type: "order_cancelled",
        title: "Order Cancelled ❌",
        message: `Your order #${order.orderNumber} has been cancelled.`
      },
      "Return Requested": {
        type: "return_submitted",
        title: "Return Request Submitted 🔄",
        message: `Your return request for order #${order.orderNumber} was submitted.`
      },
      "Return Approved": {
        type: "return_approved",
        title: "Return Approved ✅",
        message: `Your return request for order #${order.orderNumber} has been approved.`
      },
      "Return Rejected": {
        type: "return_rejected",
        title: "Return Request Rejected ❌",
        message: `Your return request for order #${order.orderNumber} was rejected.`
      },
      "Exchange Requested": {
        type: "exchange_submitted",
        title: "Exchange Request Submitted 🔄",
        message: `Your exchange request for order #${order.orderNumber} was submitted.`
      },
      "Exchange Approved": {
        type: "exchange_approved",
        title: "Exchange Approved ✅",
        message: `Your exchange request for order #${order.orderNumber} has been approved.`
      },
      "Exchange Rejected": {
        type: "exchange_rejected",
        title: "Exchange Request Rejected ❌",
        message: `Your exchange request for order #${order.orderNumber} was rejected.`
      },
      "Return Refund Initiated": {
        type: "refund_initiated",
        title: "Refund Initiated 💰",
        message: `Refund for your order #${order.orderNumber} has been initiated.`
      },
      "Return Refund Completed": {
        type: "refund_completed",
        title: "Refund Completed ✅",
        message: `Refund for your order #${order.orderNumber} has been completed.`
      }
    };

    const notifInfo = statusMap[status] || {
      type: "order",
      title: `Order Update: ${status}`,
      message: `Your order #${order.orderNumber} status has been updated to ${status}.`
    };

    return await this.sendToCustomer(customerId, customerEmail, {
      type: notifInfo.type,
      title: notifInfo.title,
      message: notifInfo.message,
      actionLink: "/orders",
      relatedData: { orderId: order._id }
    });
  }
  
  async markAsRead(notificationId, adminId) {
    return await Notification.findOneAndUpdate(
      { _id: notificationId, adminId },
      { isRead: true, $push: { readBy: { userId: adminId, readAt: new Date() } } },
      { new: true }
    );
  }
  
  async markAllAsRead(adminId) {
    return await Notification.updateMany(
      { adminId, isRead: false, forRole: "admin" },
      { isRead: true, $push: { readBy: { userId: adminId, readAt: new Date() } } }
    );
  }
  
  // ========== SPECIFIC NOTIFICATION SENDERS ==========
  
  // Product Related
  async sendOutOfStock(product) {
    await this.sendToAdmins({
      type: "out_of_stock",
      title: "🚫 Product Out of Stock",
      message: `${product.name} is now out of stock. Please restock soon.`,
      priority: "urgent",
      actionRequired: true,
      actionLink: `/admin/products/${product._id}`,
      relatedData: { productId: product._id }
    });
  }
  
  async sendLowStock(product, quantity) {
    await this.sendToAdmins({
      type: "low_stock",
      title: "⚠️ Low Stock Alert",
      message: `${product.name} is running low. Only ${quantity} units left.`,
      priority: "high",
      actionRequired: true,
      actionLink: `/admin/products/${product._id}`,
      relatedData: { productId: product._id, quantity }
    });
  }
  
  async sendBackInStock(product, quantity) {
    await this.sendToAdmins({
      type: "back_in_stock",
      title: "✅ Product Back in Stock",
      message: `${product.name} is back in stock. Quantity: ${quantity}`,
      priority: "medium",
      actionRequired: false,
      actionLink: `/admin/products/${product._id}`,
      relatedData: { productId: product._id, quantity }
    });
  }
  
  // Order Related
  async sendNewOrder(order) {
    await this.sendToAdmins({
      type: "new_order",
      title: "🛍️ New Order Received!",
      message: `Order #${order.orderNumber} has been placed. Amount: ₹${order.totalAmount}`,
      priority: "high",
      actionRequired: true,
      actionLink: `/admin/orders/${order._id}`,
      relatedData: { orderId: order._id }
    });
  }
  
  async sendOrderCancelled(order) {
    await this.sendToAdmins({
      type: "order_cancelled",
      title: "❌ Order Cancelled",
      message: `Order #${order.orderNumber} has been cancelled. Amount: ₹${order.totalAmount}`,
      priority: "high",
      actionRequired: false,
      actionLink: `/admin/orders/${order._id}`,
      relatedData: { orderId: order._id }
    });
  }
  
  async sendPaymentReceived(order) {
    await this.sendToAdmins({
      type: "payment_received",
      title: "💰 Payment Received",
      message: `Payment received for Order #${order.orderNumber}. Amount: ₹${order.totalAmount}`,
      priority: "medium",
      actionRequired: false,
      actionLink: `/admin/orders/${order._id}`,
      relatedData: { orderId: order._id }
    });
  }
  
  async sendPaymentFailed(order) {
    await this.sendToAdmins({
      type: "payment_failed",
      title: "⚠️ Payment Failed",
      message: `Payment failed for Order #${order.orderNumber}. Please check.`,
      priority: "urgent",
      actionRequired: true,
      actionLink: `/admin/orders/${order._id}`,
      relatedData: { orderId: order._id }
    });
  }
  
  // Return/Exchange Related
  async sendReturnRequest(returnRequest, order) {
    await this.sendToAdmins({
      type: "return_request",
      title: "🔄 New Return Request",
      message: `Return request for Order #${order.orderNumber}. Reason: ${returnRequest.reason}`,
      priority: "high",
      actionRequired: true,
      actionLink: `/admin/returns/${returnRequest._id}`,
      relatedData: { returnId: returnRequest._id, orderId: order._id }
    });
  }
  
  async sendExchangeRequest(exchangeRequest, order) {
    await this.sendToAdmins({
      type: "exchange_request",
      title: "🔄 New Exchange Request",
      message: `Exchange request for Order #${order.orderNumber}.`,
      priority: "high",
      actionRequired: true,
      actionLink: `/admin/exchanges/${exchangeRequest._id}`,
      relatedData: { returnId: exchangeRequest._id, orderId: order._id }
    });
  }
  
  async sendReturnExchangeApproved(request, order, type) {
    await this.sendToAdmins({
      type: "return_exchange_approved",
      title: `✅ ${type} Approved`,
      message: `${type} request for Order #${order.orderNumber} has been approved.`,
      priority: "medium",
      actionRequired: false,
      actionLink: `/admin/${type.toLowerCase()}s/${request._id}`,
      relatedData: { returnId: request._id, orderId: order._id }
    });
  }
  
  async sendReturnExchangeRejected(request, order, type) {
    await this.sendToAdmins({
      type: "return_exchange_rejected",
      title: `❌ ${type} Rejected`,
      message: `${type} request for Order #${order.orderNumber} has been rejected.`,
      priority: "medium",
      actionRequired: false,
      actionLink: `/admin/${type.toLowerCase()}s/${request._id}`,
      relatedData: { returnId: request._id, orderId: order._id }
    });
  }
  
  // Customer Related
  async sendNewCustomer(customer) {
    await this.sendToAdmins({
      type: "new_customer",
      title: "👤 New Customer Registered",
      message: `${customer.name} (${customer.email}) has registered.`,
      priority: "low",
      actionRequired: false,
      actionLink: `/admin/customers/${customer._id}`,
      relatedData: { customerId: customer._id }
    });
  }
  
  async sendCustomerComplaint(complaint, customer) {
    await this.sendToAdmins({
      type: "customer_complaint",
      title: "📢 New Customer Complaint",
      message: `Complaint from ${customer.name}: ${complaint.subject}`,
      priority: "urgent",
      actionRequired: true,
      actionLink: `/admin/complaints/${complaint._id}`,
      relatedData: { customerId: customer._id, complaintId: complaint._id }
    });
  }

  // ========== ORDER LIFECYCLE ==========

  async sendOrderShipped(order) {
    await this.sendToAdmins({
      type: "order_shipped",
      title: "🚚 Order Shipped",
      message: `Order #${order.orderNumber} has been shipped and is on its way.`,
      priority: "medium",
      actionRequired: false,
      actionLink: `/orders`,
      relatedData: { orderId: order._id }
    });
  }

  async sendOrderDelivered(order) {
    await this.sendToAdmins({
      type: "order_delivered",
      title: "📦 Order Delivered",
      message: `Order #${order.orderNumber} has been successfully delivered.`,
      priority: "medium",
      actionRequired: false,
      actionLink: `/orders`,
      relatedData: { orderId: order._id }
    });
  }

  async sendRefundCompleted(order, amount) {
    await this.sendToAdmins({
      type: "refund_completed",
      title: "✅ Refund Completed",
      message: `Refund of ₹${amount} completed for Order #${order.orderNumber}.`,
      priority: "high",
      actionRequired: false,
      actionLink: `/orders`,
      relatedData: { orderId: order._id }
    });
  }

  async sendRefundProcessed(order, amount) {
    await this.sendToAdmins({
      type: "refund_processed",
      title: "💸 Refund Processed",
      message: `Refund of ₹${amount} has been processed for Order #${order.orderNumber}.`,
      priority: "medium",
      actionRequired: false,
      actionLink: `/orders`,
      relatedData: { orderId: order._id }
    });
  }

  // ========== REVIEW ==========

  async sendNewReview(product, review, customer) {
    await this.sendToAdmins({
      type: "new_review",
      title: "⭐ New Product Review Submitted",
      message: `${customer?.name || 'A customer'} left a ${review.rating}-star review on "${product.name}".`,
      priority: "medium",
      actionRequired: false,
      actionLink: `/reviews`,
      relatedData: { productId: product._id, reviewId: review._id }
    });
  }

  // ========== SYSTEM ==========

  async sendSystemError(message, details) {
    await this.sendToAdmins({
      type: "system_error",
      title: "🔴 Server/API Error",
      message: message || "An unexpected server error occurred. Please check the logs.",
      priority: "urgent",
      actionRequired: true,
      actionLink: `/notifications`,
      relatedData: {}
    });
  }

  async sendDatabaseBackupCompleted(details) {
    await this.sendToAdmins({
      type: "db_backup",
      title: "💾 Database Backup Completed",
      message: details || `Database backup was completed successfully at ${new Date().toLocaleString('en-IN')}.`,
      priority: "medium",
      actionRequired: false,
      actionLink: `/settings`,
      relatedData: {}
    });
  }

  async sendCmsUpdateAvailable(version, notes) {
    await this.sendToAdmins({
      type: "cms_update",
      title: "🆕 New CMS Version Available",
      message: `CMS version ${version} is available. ${notes || ''}`,
      priority: "medium",
      actionRequired: false,
      actionLink: `/settings`,
      relatedData: {}
    });
  }
}

module.exports = new NotificationService();