const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema({
  // Store Information
  storeName: { type: String, default: "JewelsKart" },
  storeLogo: { type: String, default: "https://res.cloudinary.com/dkawppfwu/image/upload/v1777292088/logo_1777288427544_z5hkug.png" },
  favicon: { type: String, default: "/favicon.ico" },
  businessEmail: { type: String, default: "info@jewelskart.com" },
  contactNumber: { type: String, default: "+91 98765 43210" },
  whatsAppNumber: { type: String, default: "+91 98765 43210" },
  storeAddress: { type: String, default: "123 Zaveri Bazaar, Mumbai, Maharashtra 400002" },

  // Payment Gateway
  razorpayEnabled: { type: Boolean, default: true },
  razorpayKeyId: { type: String, default: "rzp_test_key" },
  razorpayKeySecret: { type: String, default: "rzp_test_secret" },
  codEnabled: { type: Boolean, default: true },

  // Company Details
  gstNumber: { type: String, default: "27AABCU9603R1ZM" },
  panNumber: { type: String, default: "AABCU9603R" },
  invoiceFooterText: { type: String, default: "Thank you for shopping with JewelsKart! All items are BIS hallmarked." },

  // Notifications
  emailNotifications: { type: Boolean, default: true },
  newOrderAlerts: { type: Boolean, default: true },
  lowStockAlerts: { type: Boolean, default: true },
  outOfStockAlerts: { type: Boolean, default: true },

  // System
  maintenanceMode: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Setting", settingSchema);
