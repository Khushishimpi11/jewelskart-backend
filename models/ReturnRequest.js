const mongoose = require("mongoose");

const returnRequestSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  orderNumber: { type: String, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String, default: "" },
  
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
  productName: { type: String, required: true },
  productImage: { type: String, default: "" },
  quantity: { type: Number, default: 1 },
  price: { type: Number, default: 0 },
  
  reason: { type: String, required: true },
  description: { type: String, default: "" },
  requestType: { 
    type: String, 
    enum: ["cancel", "return", "exchange"], 
    required: true 
  },
  
  // Customer uploaded proof
  images: [{ type: String }],
  video: { type: String, default: null },
  unboxingVideoName: { type: String, default: "" },
  
  // Refund details (for return & cancel)
  refundDetails: {
    method: { type: String, enum: ["original", "upi", "bank", "wallet"], default: "original" },
    upiId: { type: String, default: "" },
    bankDetails: {
      accountHolderName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      bankName: { type: String, default: "" },
      ifscCode: { type: String, default: "" }
    }
  },
  
  // Exchange Details
  exchangeDetails: {
    exchangeProductId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    exchangeProductName: { type: String, default: "" },
    exchangeProductImage: { type: String, default: "" },
    exchangeProductPrice: { type: Number, default: 0 },
    originalProductPrice: { type: Number, default: 0 },
    priceDifference: { type: Number, default: 0 },
    differencePaymentMethod: { type: String, default: "" },
    differencePaymentDetails: { type: Object, default: {} },
    differencePaymentStatus: { 
      type: String, 
      enum: ["pending", "processing", "completed", "failed"], 
      default: "pending" 
    },
    returnShippingTracking: { type: String, default: "" },
    exchangeShippingTracking: { type: String, default: "" },
    returnReceived: { type: Boolean, default: false },
    exchangeShipped: { type: Boolean, default: false },
    returnReceivedDate: { type: Date },
    exchangeShippedDate: { type: Date }
  },
  
  status: { 
    type: String, 
    enum: ["pending", "approved", "rejected", "completed", "return_received", "exchange_shipped"], 
    default: "pending" 
  },
  
  adminNote: { type: String, default: "" },
  refundAmount: { type: Number, default: 0 },
  refundStatus: { 
    type: String, 
    enum: ["pending", "processing", "completed"], 
    default: "pending" 
  },
  
  // ✅ TRACKING FIELDS
  returnTrackingNumber: { type: String, default: "" },
  exchangeTrackingNumber: { type: String, default: "" },
  returnPickupScheduled: { type: Date },
  exchangeShippedDate: { type: Date },
  orderStatusUpdated: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes to enable fast indexed sorting and prevent MongoDB 32MB in-memory sort errors
returnRequestSchema.index({ createdAt: -1 });
returnRequestSchema.index({ customerId: 1, createdAt: -1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });
returnRequestSchema.index({ orderId: 1 });

module.exports = mongoose.model("ReturnRequest", returnRequestSchema);