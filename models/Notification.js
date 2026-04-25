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
  
  // Notification Details - 13 Types
  type: { 
    type: String, 
    enum: [
      // Customer types
      "order", "return", "refund", "exchange", "complaint",
      // Admin types - Product Related
      "out_of_stock", "low_stock", "back_in_stock",
      // Admin types - Order Related
      "new_order", "order_cancelled", "payment_received", "payment_failed",
      // Admin types - Return/Exchange Related
      "return_request", "exchange_request", "return_exchange_approved", "return_exchange_rejected",
      // Admin types - Customer Related
      "new_customer", "customer_complaint",
      // System
      "system"
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
    complaintId: { type: mongoose.Schema.Types.ObjectId },
    oldQuantity: { type: Number },
    newQuantity: { type: Number },
    oldPrice: { type: Number },
    newPrice: { type: Number }
  },
  
  actionRequired: { type: Boolean, default: false },
  actionLink: { type: String },
  
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