const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Setting = require("../models/Setting");
const Product = require("../models/Product");
const Category = require("../models/Category");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const { protect, adminOnly } = require("../middleware/auth");

// GET /api/settings - Get settings (public/admin)
router.get("/", async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = await Setting.create({});
    }
    res.json({ success: true, settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/settings - Update settings (admin only)
router.put("/", protect, adminOnly, async (req, res) => {
  try {
    let settings = await Setting.findOne();
    if (!settings) {
      settings = new Setting(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    await settings.save();
    res.json({ success: true, message: "Settings updated successfully", settings });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/settings/status - Get system status and info (admin only)
router.get("/status", protect, adminOnly, async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const states = {
      0: "Disconnected",
      1: "Connected",
      2: "Connecting",
      3: "Disconnecting"
    };

    const productCount = await Product.countDocuments();
    const categoryCount = await Category.countDocuments();
    const orderCount = await Order.countDocuments();
    const customerCount = await Customer.countDocuments();

    res.json({
      success: true,
      cmsVersion: "v1.0.0",
      databaseStatus: states[dbState] || "Unknown",
      stats: {
        products: productCount,
        categories: categoryCount,
        orders: orderCount,
        customers: customerCount
      }
    });
  } catch (error) {
    console.error("Error getting system status:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/settings/clear-cache - Clear simulated cache (admin only)
router.post("/clear-cache", protect, adminOnly, (req, res) => {
  try {
    res.json({ success: true, message: "CMS system cache cleared successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/settings/backup - Trigger and download database backup (admin only)
router.get("/backup", protect, adminOnly, async (req, res) => {
  try {
    const products = await Product.find();
    const categories = await Category.find();
    const orders = await Order.find();
    const customers = await Customer.find();

    const backupData = {
      backupDate: new Date().toISOString(),
      cmsVersion: "v1.0.0",
      data: {
        products,
        categories,
        orders,
        customers
      }
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename=jewelskart_backup_${Date.now()}.json`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (error) {
    console.error("Error creating database backup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
