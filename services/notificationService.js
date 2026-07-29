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
  async getAdminUnreadCount(adminId) {
    return await Notification.countDocuments({ 
      adminId, 
      isRead: false, 
      forRole: "admin" 
    });
  }
  
  async getAdminNotifications(adminId, limit = 50, skip = 0, filter = {}) {
    let query = { adminId, forRole: "admin", ...filter };
    return await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
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