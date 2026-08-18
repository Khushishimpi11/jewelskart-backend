const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },

  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    required: true,
    index: true
  },

  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },

  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true, index: true },
  customerPhone: { type: String, required: true },

  shippingAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: "India" }
  },

  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    productName: { type: String, required: true },
    productSku: { type: String, required: true },
    productImage: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true },
    total: { type: Number, required: true },
    size: { type: String, default: "" },
    material: { type: String, default: "" },
    ringOption: { type: String, default: "" },
    priceExclGst: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 3 },
    gstAmount: { type: Number, default: 0 }
  }],

  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  shippingCharge: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  gstAmount: { type: Number, default: 0 },
  totalExclGst: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },

  // ✅ Payment Method - COD and ONLINE both supported
  paymentMethod: {
    type: String,
    enum: ["COD", "Card", "UPI", "NetBanking", "ONLINE", "online"],
    default: "COD"
  },

  // ✅ Payment Status - Both "Pending" and "PENDING" supported
  paymentStatus: {
    type: String,
    enum: ["Pending", "PENDING", "Paid", "PAID", "Failed", "FAILED", "Refunded", "REFUNDED", "SUCCESS"],
    default: "Pending"
  },

  // ✅ Order Status - Complete list with "Pending Payment" & Rejections
  orderStatus: {
    type: String,
    enum: [
      // Normal order statuses
      "Confirmed", "Processing", "Shipped", "Out for Delivery", "Delivered", "Cancelled",
      "Pending Payment", "Pending", "Cancel Rejected",

      // Return statuses
      "Return Requested", "Return Under Review", "Return Approved", "Return Rejected",
      "Return Pickup Scheduled", "Return Picked Up", "Return Quality Check",
      "Return Refund Initiated", "Return Refund Completed",

      // Exchange statuses
      "Exchange Requested", "Exchange Under Review", "Exchange Approved", "Exchange Rejected",
      "Exchange Pickup Scheduled", "Exchange Picked Up", "Exchange Quality Check",
      "Exchange Replacement Processing", "Exchange Shipped", "Exchange Delivered"
    ],
    default: "Confirmed"
  },

  statusHistory: [{
    status: String,
    date: { type: Date, default: Date.now },
    note: String,
    updatedBy: { type: String, default: "system" }
  }],

  notes: { type: String, default: "" },
  trackingNumber: { type: String, default: "" },
  courierPartner: { type: String, default: "" },
  awbNumber: { type: String, default: "" },

  // Payment tracking fields for Zoho Payments
  paymentId: { type: String, default: "" },
  zohoSessionId: { type: String, default: "" },
  zohoPaymentId: { type: String, default: "" },
  paymentDate: { type: Date },
  refundId: { type: String, default: "" },
  refundAmount: { type: Number, default: 0 },

  // Request tracking fields
  cancellationReason: { type: String, default: "" },
  cancelledAt: { type: Date },
  returnRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "ReturnRequest" },
  exchangeRequestId: { type: mongoose.Schema.Types.ObjectId, ref: "ReturnRequest" },
  returnTrackingNumber: { type: String, default: "" },
  exchangeTrackingNumber: { type: String, default: "" },
  returnPickupScheduled: { type: Date },
  exchangeShippedDate: { type: Date },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-generate order number
orderSchema.pre("save", async function (next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.orderNumber = `ORD-${year}${month}${day}-${random}`;
  }
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("Order", orderSchema);