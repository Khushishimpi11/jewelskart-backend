const express = require("express");
const router = express.Router();
const Notification = require("../models/Notification");
const notificationService = require("../services/notificationService");
const { protect, adminOnly, customerOnly } = require("../middleware/auth");

// ==================== CUSTOMER NOTIFICATIONS ====================

router.get("/my-notifications", protect, customerOnly, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id, isDismissed: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(50);
    
    const unreadCount = await Notification.countDocuments({ 
      userId: req.user.id, 
      isRead: false,
      isDismissed: { $ne: true }
    });
    
    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/:id/read", protect, customerOnly, async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id }, 
      { isRead: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/read-all", protect, customerOnly, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/my-notifications/clear-all", protect, customerOnly, async (req, res) => {
  try {
    // Soft-clear: mark as dismissed instead of deleting from DB
    await Notification.updateMany(
      { userId: req.user.id, isDismissed: { $ne: true } },
      { isDismissed: true }
    );
    res.json({ success: true, message: "All notifications cleared successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete("/:id", protect, customerOnly, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const User = require("../models/User");

// ==================== ADMIN NOTIFICATIONS ====================

// Get admin notifications for Bell Dropdown (respects bellClearedAt)
router.get("/admin/notifications", protect, adminOnly, async (req, res) => {
  try {
    const { limit = 50, skip = 0, priority, type } = req.query;
    const adminUser = await User.findById(req.user.id).select("bellClearedAt");
    const bellClearedAt = adminUser?.bellClearedAt || null;
    
    let filter = {};
    if (priority) filter.priority = priority;
    if (type) filter.type = type;
    
    const notifications = await notificationService.getAdminNotifications(
      req.user.id, 
      parseInt(limit), 
      parseInt(skip),
      filter,
      bellClearedAt
    );
    
    const unreadCount = await notificationService.getAdminUnreadCount(req.user.id, bellClearedAt);
    const queryFilter = { adminId: req.user.id, forRole: "admin", ...filter };
    if (bellClearedAt) {
      queryFilter.createdAt = { $gt: bellClearedAt };
    }
    const totalCount = await Notification.countDocuments(queryFilter);
    
    res.json({ success: true, notifications, unreadCount, totalCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get ALL admin notifications for Notifications Page (historical record - ignores bellClearedAt)
router.get("/admin/notifications/all", protect, adminOnly, async (req, res) => {
  try {
    const { limit = 100, skip = 0, priority, type } = req.query;
    
    let filter = {};
    if (priority) filter.priority = priority;
    if (type) filter.type = type;
    
    const notifications = await notificationService.getAdminNotifications(
      req.user.id, 
      parseInt(limit), 
      parseInt(skip),
      filter,
      null // null = fetch ALL history
    );
    
    const unreadCount = await notificationService.getAdminUnreadCount(req.user.id, null);
    const totalCount = await Notification.countDocuments({ 
      adminId: req.user.id, 
      forRole: "admin",
      ...filter
    });
    
    res.json({ success: true, notifications, unreadCount, totalCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ STATIC ROUTES FIRST (before /:id wildcards to avoid conflicts)

// Clear bell dropdown notifications — ONLY updates bellClearedAt timestamp for the admin!
router.delete("/admin/notifications/clear-all", protect, adminOnly, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { bellClearedAt: new Date() });
    res.json({ success: true, message: "Bell dropdown cleared successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark all as read — must be before /:id/read
router.put("/admin/notifications/read-all", protect, adminOnly, async (req, res) => {
  try {
    await notificationService.markAllAsRead(req.user.id);
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get notification stats — must be before /:id
router.get("/admin/notifications/stats", protect, adminOnly, async (req, res) => {
  try {
    const baseFilter = { adminId: req.user.id, forRole: "admin", isDismissed: { $ne: true } };
    const stats = {
      total: await Notification.countDocuments(baseFilter),
      unread: await notificationService.getAdminUnreadCount(req.user.id),
      urgent: await Notification.countDocuments({ ...baseFilter, priority: "urgent", isRead: false }),
      high: await Notification.countDocuments({ ...baseFilter, priority: "high", isRead: false }),
      medium: await Notification.countDocuments({ ...baseFilter, priority: "medium", isRead: false }),
      low: await Notification.countDocuments({ ...baseFilter, priority: "low", isRead: false })
    };
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    stats.last7Days = await Notification.countDocuments({
      ...baseFilter,
      createdAt: { $gte: sevenDaysAgo }
    });
    
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get notifications by type — must be before /:id
router.get("/admin/notifications/type/:type", protect, adminOnly, async (req, res) => {
  try {
    const { type } = req.params;
    const notifications = await Notification.find({
      adminId: req.user.id,
      forRole: "admin",
      type: type
    })
    .sort({ createdAt: -1 })
    .limit(50);
    
    res.json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ WILDCARD ROUTES LAST

// Mark single notification as read
router.put("/admin/notifications/:id/read", protect, adminOnly, async (req, res) => {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    res.json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete notification
router.delete("/admin/notifications/:id", protect, adminOnly, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, adminId: req.user.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ==================== SEND NOTIFICATION FROM FRONTEND (CMS) ====================
// ✅ ADD THIS ROUTE - Ye route frontend se notification send karne ke liye hai

router.post("/admin/send", protect, adminOnly, async (req, res) => {
  try {
    const { type, title, message, priority, actionRequired, actionLink, relatedData } = req.body;
    
    const notification = new Notification({
      adminId: req.user.id,
      forRole: "admin",
      type: type,
      title: title,
      message: message,
      priority: priority || "medium",
      actionRequired: actionRequired || false,
      actionLink: actionLink || null,
      relatedData: relatedData || {}
    });
    
    await notification.save();
    
    console.log(`📧 Notification sent to admin: ${title}`);
    
    res.json({ 
      success: true, 
      notification,
      message: "Notification sent successfully"
    });
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;