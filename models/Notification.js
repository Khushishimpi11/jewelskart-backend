const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  // For Customer
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  userEmail: { type: String },
  
  // For Admin
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  forRole: { 
    type: String, 
    enum: ["customer", "admin", "both"],
    default: "customer"
  },
  
  // Notification Details - Full Type Set
  type: { 
    type: String, 
    enum: [
      // Customer types
      "order", "return", "refund", "exchange", "complaint",
      // Admin - Inventory
      "out_of_stock", "low_stock", "back_in_stock",
      // Admin - Orders
      "new_order", "order_cancelled", "order_shipped", "order_delivered",
      // Admin - Payments
      "payment_received", "payment_failed", "refund_processed",
      // Admin - Returns/Exchange
      "return_request", "exchange_request", "return_exchange_approved", "return_exchange_rejected",
      "refund_completed",
      // Admin - Customer
      "new_customer", "customer_complaint",
      // Admin - Reviews
      "new_review",
      // System
      "system", "system_error", "db_backup", "cms_update"
    ],
    required: true
  },
  
  title: { type: String, required: true },
  message: { type: String, required: true },
  
  // Priority for admin
  priority: { 
    type: String, 
    enum: ["low", "medium", "high", "urgent"],
    default: "medium"
  },
  
  // Status
  isRead: { type: Boolean, default: false },
  readBy: [{
    userId: { type: mongoose.Schema.Types.ObjectId },
    readAt: { type: Date, default: Date.now }
  }],
  
  // Related Data
  relatedData: {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    returnId: { type: mongoose.Schema.Types.ObjectId, ref: "ReturnRequest" },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    reviewId: { type: mongoose.Schema.Types.ObjectId },
    complaintId: { type: mongoose.Schema.Types.ObjectId },
    oldQuantity: { type: Number },
    newQuantity: { type: Number },
    oldPrice: { type: Number },
    newPrice: { type: Number }
  },
  
  actionRequired: { type: Boolean, default: false },
  actionLink: { type: String },
  
  // Soft-clear: hides from UI without deleting the record
  isDismissed: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }
});

// Indexes
notificationSchema.index({ adminId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Notification", notificationSchema);