const mongoose = require("mongoose");

const trackingSchema = new mongoose.Schema({
  trackingId: { type: String, required: true, unique: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  orderNumber: { type: String, required: true },
  
  status: { 
    type: String, 
    enum: [
      "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED",
      "PENDING_PAYMENT",  // ✅ ADD THIS
      "RETURN_REQUESTED", "RETURN_APPROVED", "RETURN_PICKUP_SCHEDULED", "RETURN_PICKED_UP",
      "RETURN_QUALITY_CHECK", "RETURN_REFUND_INITIATED", "RETURN_REFUND_COMPLETED",
      "EXCHANGE_REQUESTED", "EXCHANGE_APPROVED", "EXCHANGE_PICKUP_SCHEDULED", "EXCHANGE_PICKED_UP",
      "EXCHANGE_QUALITY_CHECK", "EXCHANGE_REPLACEMENT_PROCESSING", "EXCHANGE_SHIPPED", "EXCHANGE_DELIVERED"
    ],
    default: "PENDING_PAYMENT"
  },
  
  currentLocation: { type: String, default: "" },
  
  timeline: [{
    status: String,
    location: String,
    description: String,
    date: { type: Date, default: Date.now }
  }],
  
  estimatedDelivery: { type: Date },
  deliveredAt: { type: Date },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Tracking", trackingSchema);