const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema({
  // Store Information
  storeName: { type: String, default: "JewelsKart" },
  storeLogo: { type: String, default: "https://res.cloudinary.com/dkawppfwu/image/upload/v1777292088/logo_1777288427544_z5hkug.png" },
  favicon: { type: String, default: "https://res.cloudinary.com/dkawppfwu/image/upload/v1777292088/logo_1777288427544_z5hkug.png" },
  businessEmail: { type: String, default: "info@jewelskartindia.com" },
  contactNumber: { type: String, default: "+91 75585 72001" },
  whatsAppNumber: { type: String, default: "+91 75585 72001" },
  storeAddress: { type: String, default: "Boulevard Towers - JEWELSKART, A-1008, 10th Floor, Near Sadhu Vaswani Chowk, Opp Vijay Sales, Camp, Pune - 411001" },

  // Payment Gateway
  zohoPaymentsEnabled: { type: Boolean, default: true },
  zohoAccountId: { type: String, default: "60080771057" },
  zohoApiKey: { type: String, default: "1003.6314fc4a7d42b81ac85f1ca3dbc545eb.7a647ed7a4a681800edd6c0e26878bbd" },
  codEnabled: { type: Boolean, default: true },

  // Company Details
  gstNumber: { type: String, default: "27AABCU9603R1ZM" },
  panNumber: { type: String, default: "AABCU9603R" },
  invoiceFooterText: { type: String, default: "Thank you for shopping with JewelsKart! All items are BIS hallmarked & 100% certified." },

  // Notifications
  emailNotifications: { type: Boolean, default: true },
  newOrderAlerts: { type: Boolean, default: true },
  lowStockAlerts: { type: Boolean, default: true },
  outOfStockAlerts: { type: Boolean, default: true },

  // System
  maintenanceMode: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Setting", settingSchema);
