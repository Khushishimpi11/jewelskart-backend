const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Customer = require("../models/Customer");
const User = require("../models/User");
const Order = require("../models/Order");
const jwt = require("jsonwebtoken");
const { protect, adminOnly } = require("../middleware/auth");
const notificationService = require("../services/notificationService");
const {
  sendAdminPasswordResetEmail,
  sendCustomerPasswordResetEmail
} = require("../services/emailService");

const generateToken = (id, email, role, name, customerId, deviceId) => {
  return jwt.sign(
    { id, email, role, name, customerId, deviceId },
    process.env.JWT_SECRET || "jewelskart_secret_key_2024",
    { expiresIn: "90d" }
  );
};

const parseDevice = (req) => {
  const ua = req.headers["user-agent"] || "";
  let deviceType = "Desktop";
  if (/mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceType = /ipad|tablet/i.test(ua) ? "Tablet" : "Mobile";
  }

  let browser = "Browser";
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Safari/")) browser = "Safari";
  else if (ua.includes("OPR/") || ua.includes("Opera/")) browser = "Opera";

  let os = "Device";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS") || ua.includes("Macintosh")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  const deviceName = `${browser} on ${os}`;
  const ipAddress = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "127.0.0.1";

  return { deviceName, deviceType, ipAddress };
};

const registerActiveDevice = async (account, req) => {
  const deviceId = crypto.randomBytes(16).toString("hex");
  const { deviceName, deviceType, ipAddress } = parseDevice(req);

  if (!account.activeDevices) {
    account.activeDevices = [];
  }

  account.activeDevices.push({
    deviceId,
    deviceName,
    deviceType,
    ipAddress,
    lastActive: new Date(),
    loginTime: new Date()
  });

  if (account.activeDevices.length > 10) {
    account.activeDevices = account.activeDevices.slice(-10);
  }

  await account.save();
  return deviceId;
};


// Password validation function
const isValidPassword = (password) => {
  const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/;
  return passwordRegex.test(password);
};

// ============ GOOGLE AUTH FOR CUSTOMERS ============
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;

    console.log("🔍 Google auth request received");

    if (!credential) {
      return res.status(400).json({ success: false, message: "No token provided" });
    }

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${credential}`
      }
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to get user info from Google');
    }

    const userInfo = await userInfoResponse.json();
    const { email, name, picture, sub: googleId } = userInfo;

    console.log("✅ Google user verified:", email);

    let customer = await Customer.findOne({ email });
    let isNewCustomer = false;

    if (customer) {
      if (!customer.googleId) {
        customer.googleId = googleId;
        customer.profilePicture = picture || customer.profilePicture;
        customer.isGoogleUser = true;
        await customer.save();
        console.log("✅ Google account linked to existing customer");
      }
    } else {
      customer = await Customer.create({
        name: name,
        email: email,
        googleId: googleId,
        profilePicture: picture || "",
        isGoogleUser: true,
        isActive: true,
        phone: "",
        address: {
          street: "",
          city: "",
          state: "",
          pincode: "",
          country: "India"
        },
        bankDetails: {
          accountHolderName: "",
          accountNumber: "",
          bankName: "",
          ifscCode: "",
          upiId: ""
        }
      });
      isNewCustomer = true;
      console.log("✅ New customer created with Google");
    }

    customer.lastLogin = new Date();
    const deviceId = await registerActiveDevice(customer, req);

    if (isNewCustomer) {
      await notificationService.sendNewCustomer(customer);
    }

    const token = generateToken(
      customer._id,
      customer.email,
      "customer",
      customer.name,
      customer.customerId,
      deviceId
    );


    res.status(200).json({
      success: true,
      message: "Google login successful",
      token,
      user: {
        id: customer._id,
        customerId: customer.customerId,
        name: customer.name,
        email: customer.email,
        role: "customer",
        phone: customer.phone,
        address: customer.address,
        profilePicture: customer.profilePicture,
        isGoogleUser: customer.isGoogleUser,
        bankDetails: customer.bankDetails
      }
    });
  } catch (error) {
    console.error("❌ Google auth error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ADMIN GOOGLE LOGIN ============
router.post("/admin/google", async (req, res) => {
  try {
    const { accessToken, secretKey } = req.body;
    const ADMIN_SECRET = process.env.ADMIN_SECRET || "ADMIN_SECRET_2024";

    console.log("🔍 Admin Google login request received");

    if (secretKey !== ADMIN_SECRET) {
      return res.status(403).json({
        success: false,
        message: "Invalid admin secret key"
      });
    }

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to get user info from Google');
    }

    const userInfo = await userInfoResponse.json();
    const { email, name, picture, sub: googleId } = userInfo;

    console.log("✅ Google user verified:", email);

    let admin = await User.findOne({ email, role: "admin" });
    let isNewAdmin = false;

    if (admin) {
      if (!admin.googleId) {
        admin.googleId = googleId;
        admin.isGoogleUser = true;
        admin.profilePicture = picture || admin.profilePicture;
        await admin.save();
        console.log("✅ Google account linked to existing admin");
      }
    } else {
      admin = await User.create({
        name: name,
        email: email,
        googleId: googleId,
        isGoogleUser: true,
        profilePicture: picture || "",
        password: null,
        role: "admin",
        isActive: true
      });
      isNewAdmin = true;
      console.log("✅ New admin created with Google");
    }

    admin.lastLogin = new Date();
    const deviceId = await registerActiveDevice(admin, req);

    const token = generateToken(admin._id, admin.email, "admin", admin.name, null, deviceId);


    res.status(200).json({
      success: true,
      message: isNewAdmin ? "Admin registered successfully with Google" : "Admin login successful with Google",
      token,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: "admin",
        profilePicture: admin.profilePicture,
        isGoogleUser: admin.isGoogleUser
      }
    });
  } catch (error) {
    console.error("❌ Admin Google auth error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ADMIN FORGOT PASSWORD ============
router.post("/admin/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    console.log("🔍 Admin forgot password request for:", email);

    if (!email) {
      console.log("❌ Admin forgot password failed: Email is missing in request body");
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const admin = await User.findOne({ email: cleanEmail, role: "admin" });

    if (!admin) {
      console.log("⚠️ Admin user not found for email:", cleanEmail);
      return res.status(404).json({
        success: false,
        message: "No admin account found with this email address."
      });
    }

    if (admin.isGoogleUser && !admin.password) {
      console.log("❌ Admin forgot password failed: Account is Google-only login");
      return res.status(400).json({
        success: false,
        message: "This account uses Google Sign-In. Please login with Google."
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    admin.resetPasswordToken = resetToken;
    admin.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await admin.save();

    const requestOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
    const defaultAdminUrl = "https://admin.jewelskartindia.com";
    const adminFrontendUrl = (requestOrigin && !requestOrigin.includes("render.com")) 
      ? requestOrigin.replace(/\/$/, "") 
      : (process.env.ADMIN_URL || process.env.FRONTEND_URL || defaultAdminUrl);

    const resetUrl = `${adminFrontendUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(cleanEmail)}`;

    console.log("📧 Admin Password Reset URL:", resetUrl);

    // Send email and wait for result
    const emailSent = await sendAdminPasswordResetEmail(cleanEmail, resetUrl, admin.name);

    if (!emailSent) {
      console.error("❌ Failed to send admin password reset email to:", cleanEmail);
      return res.status(500).json({
        success: false,
        message: "Failed to send password reset email. Please check server email configuration or try again later."
      });
    }

    res.status(200).json({
      success: true,
      message: "Password reset link has been sent to your email address.",
      resetUrl: process.env.NODE_ENV === "development" ? resetUrl : undefined
    });

  } catch (error) {
    console.error("Admin forgot password error:", error);
    res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
});

// ============ ADMIN RESET PASSWORD ============
router.post("/admin/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    console.log("🔍 Admin reset password request for:", email);

    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters with at least 1 number and 1 special character (!@#$%^&*)"
      });
    }

    const admin = await User.findOne({
      email,
      role: "admin",
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!admin) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token"
      });
    }

    admin.password = newPassword;
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpires = undefined;
    await admin.save();

    res.status(200).json({
      success: true,
      message: "Password reset successfully. Please login with new password."
    });

  } catch (error) {
    console.error("Admin reset password error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ CUSTOMER FORGOT PASSWORD ============
router.post("/customer/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    console.log("🔍 Customer forgot password request for:", email);

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const customer = await Customer.findOne({ email: cleanEmail });

    if (!customer) {
      console.log("⚠️ Customer user not found for email:", cleanEmail);
      return res.status(404).json({
        success: false,
        message: "No customer account found with this email address."
      });
    }

    if (customer.isGoogleUser && !customer.password) {
      return res.status(400).json({
        success: false,
        message: "This account uses Google Sign-In. Password reset is not available."
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    customer.resetPasswordToken = resetToken;
    customer.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await customer.save();

    const requestOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
    const defaultWebsiteUrl = "https://www.jewelskartindia.com";
    const websiteUrl = (requestOrigin && !requestOrigin.includes("render.com")) 
      ? requestOrigin.replace(/\/$/, "") 
      : (process.env.WEBSITE_URL || defaultWebsiteUrl);

    const resetUrl = `${websiteUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(cleanEmail)}`;

    console.log("📧 Customer Password Reset URL:", resetUrl);

    // Send email and wait for result
    const emailSent = await sendCustomerPasswordResetEmail(cleanEmail, resetUrl, customer.name);

    if (!emailSent) {
      console.error("❌ Failed to send customer password reset email to:", cleanEmail);
      return res.status(500).json({
        success: false,
        message: "Failed to send password reset email. Please check server email configuration or try again later."
      });
    }

    res.status(200).json({
      success: true,
      message: "Password reset link has been sent to your email address.",
      resetUrl: process.env.NODE_ENV === "development" ? resetUrl : undefined
    });

  } catch (error) {
    console.error("Customer forgot password error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ CUSTOMER RESET PASSWORD ============
router.post("/customer/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    console.log("🔍 Customer reset password request for:", email);

    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const customer = await Customer.findOne({
      email,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token"
      });
    }

    customer.password = newPassword;
    customer.resetPasswordToken = undefined;
    customer.resetPasswordExpires = undefined;
    await customer.save();

    try {
      await notificationService.sendToCustomer(customer._id, customer.email, {
        type: "password_reset",
        title: "Password Reset Successfully 🔑",
        message: "Your account password has been reset successfully. If you did not make this change, please contact support immediately.",
        actionLink: "/login"
      });
    } catch (notifErr) {
      console.error("Password reset customer notification error:", notifErr);
    }

    console.log("✅ Customer password reset successful for:", email);

    res.status(200).json({
      success: true,
      message: "Password reset successfully. Please login with your new password."
    });

  } catch (error) {
    console.error("Customer reset password error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ VERIFY TOKEN ============
router.get("/verify", protect, async (req, res) => {
  try {
    if (req.user.role === "customer") {
      const customer = await Customer.findById(req.user.id).select("-password");
      if (!customer) {
        return res.status(404).json({ success: false, message: "Customer not found" });
      }
      res.json({
        success: true,
        user: {
          id: customer._id,
          customerId: customer.customerId,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          profilePicture: customer.profilePicture,
          isGoogleUser: customer.isGoogleUser,
          bankDetails: customer.bankDetails,
          role: "customer"
        }
      });
    } else {
      const admin = await User.findById(req.user.id).select("-password");
      if (!admin) {
        return res.status(404).json({ success: false, message: "Admin not found" });
      }
      res.json({ success: true, user: admin });
    }
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ CUSTOMER REGISTRATION ============
router.post("/customer/register", async (req, res) => {
  try {
    const { name, email, password, phone, address } = req.body;

    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    const customer = await Customer.create({
      name,
      email,
      password,
      phone: phone || "",
      address: address || {
        street: "",
        city: "",
        state: "",
        pincode: "",
        country: "India"
      },
      bankDetails: {
        accountHolderName: "",
        accountNumber: "",
        bankName: "",
        ifscCode: "",
        upiId: ""
      }
    });

    const deviceId = await registerActiveDevice(customer, req);
    const token = generateToken(customer._id, customer.email, "customer", customer.name, customer.customerId, deviceId);


    await notificationService.sendNewCustomer(customer);
    await notificationService.sendToCustomer(customer._id, customer.email, {
      type: "system",
      title: "🎉 Welcome to JewelsKart!",
      message: `Hello ${customer.name}, welcome to JewelsKart! Start exploring our exclusive jewellery collection.`
    });

    res.status(201).json({
      success: true,
      message: "Customer registered successfully",
      token,
      user: {
        id: customer._id,
        customerId: customer.customerId,
        name: customer.name,
        email: customer.email,
        role: "customer",
        phone: customer.phone,
        address: customer.address,
        bankDetails: customer.bankDetails,
        isGoogleUser: false
      }
    });
  } catch (error) {
    console.error("Customer registration error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ CUSTOMER LOGIN ============
router.post("/customer/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const customer = await Customer.findOne({ email });
    if (!customer) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (customer.isGoogleUser && !customer.password) {
      return res.status(401).json({
        success: false,
        message: "This account uses Google Sign-In. Please login with Google."
      });
    }

    const isMatch = await customer.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (!customer.isActive) {
      return res.status(401).json({ success: false, message: "Account is disabled" });
    }

    customer.lastLogin = new Date();
    const deviceId = await registerActiveDevice(customer, req);

    const token = generateToken(customer._id, customer.email, "customer", customer.name, customer.customerId, deviceId);


    res.status(200).json({
      success: true,
      message: "Customer login successful",
      token,
      user: {
        id: customer._id,
        customerId: customer.customerId,
        name: customer.name,
        email: customer.email,
        role: "customer",
        phone: customer.phone,
        address: customer.address,
        bankDetails: customer.bankDetails || {},
        profilePicture: customer.profilePicture,
        isGoogleUser: customer.isGoogleUser
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ UPDATE PROFILE ============
router.put("/update-profile", protect, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const customer = await Customer.findById(req.user.id);

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    let fullName = customer.name;
    if (firstName !== undefined || lastName !== undefined) {
      const fName = firstName || "";
      const lName = lastName || "";
      fullName = `${fName} ${lName}`.trim();
    }

    if (fullName) customer.name = fullName;
    if (phone !== undefined) customer.phone = phone;

    await customer.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: customer._id,
        customerId: customer.customerId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        bankDetails: customer.bankDetails,
        profilePicture: customer.profilePicture,
        isGoogleUser: customer.isGoogleUser
      }
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ CHANGE PASSWORD ============
router.post("/change-password", protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    console.log("🔐 Password change request received for user:", req.user.id);

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long"
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different from current password"
      });
    }

    // Check if user is customer or admin
    let user;
    let userType;

    if (req.user.role === "customer") {
      user = await Customer.findById(req.user.id);
      userType = "customer";
    } else {
      user = await User.findById(req.user.id);
      userType = "admin";
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // Check if user is a Google user
    if (user.isGoogleUser) {
      return res.status(400).json({
        success: false,
        message: "Google users cannot change password. Please use Google Sign-In."
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect"
      });
    }

    // Set new password
    user.password = newPassword;
    await user.save();

    console.log(`✅ Password changed successfully for ${userType}: ${user.email}`);

    // Send notification to customer
    if (userType === "customer") {
      try {
        await notificationService.sendToCustomer(user._id, user.email, {
          type: "password_changed",
          title: "Password Changed Successfully 🔐",
          message: "Your password has been changed successfully. If you did not make this change, please contact support immediately.",
          actionLink: "/account"
        });
      } catch (notifError) {
        console.log("⚠️ Notification failed but password change succeeded:", notifError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: "Password changed successfully"
    });

  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to change password"
    });
  }
});

// ============ UPDATE ADDRESS ============
router.put("/update-address", protect, async (req, res) => {
  try {
    const { street, city, state, pincode, country } = req.body;
    const customer = await Customer.findById(req.user.id);

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    customer.address = {
      street: street || "",
      city: city || "",
      state: state || "",
      pincode: pincode || "",
      country: country || "India"
    };

    await customer.save();

    res.json({
      success: true,
      message: "Address updated successfully",
      address: customer.address
    });
  } catch (error) {
    console.error("Update address error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ UPDATE BANK DETAILS ============
router.put("/update-bank-details", protect, async (req, res) => {
  try {
    const { accountHolderName, accountNumber, bankName, ifscCode, upiId } = req.body;
    const customer = await Customer.findById(req.user.id);

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    customer.bankDetails = {
      accountHolderName: accountHolderName || "",
      accountNumber: accountNumber || "",
      bankName: bankName || "",
      ifscCode: ifscCode || "",
      upiId: upiId || ""
    };

    await customer.save();

    res.json({
      success: true,
      message: "Bank details updated successfully",
      bankDetails: customer.bankDetails
    });
  } catch (error) {
    console.error("Update bank details error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ GET ALL CUSTOMERS (Admin only) ============
router.get("/customers", protect, adminOnly, async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: customers.length,
      customers: customers.map(c => ({
        _id: c._id,
        customerId: c.customerId,
        name: c.name,
        email: c.email,
        phone: c.phone,
        address: c.address,
        isActive: c.isActive,
        totalSpent: c.totalSpent,
        orderCount: c.orderCount,
        bankDetails: c.bankDetails,
        isGoogleUser: c.isGoogleUser,
        createdAt: c.createdAt
      }))
    });
  } catch (error) {
    console.error("Get customers error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ GET SINGLE CUSTOMER ============
router.get("/customers/:id", protect, adminOnly, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    res.status(200).json({
      success: true,
      customer: {
        _id: customer._id,
        customerId: customer.customerId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        isActive: customer.isActive,
        totalSpent: customer.totalSpent,
        orderCount: customer.orderCount,
        bankDetails: customer.bankDetails,
        isGoogleUser: customer.isGoogleUser,
        createdAt: customer.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ UPDATE CUSTOMER (Admin) ============
router.put("/customers/:id", protect, adminOnly, async (req, res) => {
  try {
    const { name, phone, address, isActive, bankDetails } = req.body;

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    if (name) customer.name = name;
    if (phone) customer.phone = phone;
    if (address) customer.address = address;
    if (isActive !== undefined) customer.isActive = isActive;
    if (bankDetails) customer.bankDetails = bankDetails;

    await customer.save();

    res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      customer: {
        _id: customer._id,
        customerId: customer.customerId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        isActive: customer.isActive,
        bankDetails: customer.bankDetails,
        isGoogleUser: customer.isGoogleUser
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ DELETE CUSTOMER ============
router.delete("/customers/:id", protect, adminOnly, async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    console.log(`🗑️ Deleting customer: ${customer.email} (${customer.customerId})`);

    const deletedOrders = await Order.deleteMany({ customerId: customer._id });
    console.log(`✅ Deleted ${deletedOrders.deletedCount} orders for customer`);

    await customer.deleteOne();

    res.status(200).json({
      success: true,
      message: "Customer and all associated orders deleted successfully",
      shouldLogout: true,
      deletedCustomerId: customer._id,
      deletedCustomerEmail: customer.email,
      deletedOrdersCount: deletedOrders.deletedCount
    });
  } catch (error) {
    console.error("Delete customer error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ CHECK IF USER EXISTS ============
router.post("/check-user-exists", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.json({ exists: false });
    }

    const customer = await Customer.findOne({ email: email.toLowerCase() });

    res.json({
      exists: !!customer,
      email: email
    });
  } catch (error) {
    console.error("Check user exists error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN REGISTRATION ============
router.post("/admin/register", async (req, res) => {
  try {
    const { name, email, password, secretKey } = req.body;
    const ADMIN_SECRET = process.env.ADMIN_SECRET || "ADMIN_SECRET_2024";

    if (!email || !password || !name) {
      console.log("❌ Admin registration failed: Missing required fields");
      return res.status(400).json({ success: false, message: "Name, email, and password are required" });
    }

    if (secretKey !== ADMIN_SECRET) {
      console.log("❌ Admin registration failed: Invalid secret key");
      return res.status(403).json({ success: false, message: "Invalid secret key" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingAdmin = await User.findOne({ email: cleanEmail });
    if (existingAdmin) {
      console.log("❌ Admin registration failed: Admin already exists for", cleanEmail);
      return res.status(400).json({ success: false, message: "Admin already exists with this email" });
    }

    if (!isValidPassword(password)) {
      console.log("❌ Admin registration failed: Password does not meet requirements");
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters with at least 1 number and 1 special character (!@#$%^&*)"
      });
    }

    const admin = await User.create({
      name,
      email: cleanEmail,
      password,
      role: "admin",
      isGoogleUser: false
    });


    const deviceId = await registerActiveDevice(admin, req);
    const token = generateToken(admin._id, admin.email, "admin", admin.name, null, deviceId);


    res.status(201).json({
      success: true,
      token,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: "admin",
        isGoogleUser: false
      }
    });
  } catch (error) {
    console.error("Admin registration error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ADMIN LOGIN ============
router.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, role: "admin" });

    if (!admin) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (admin.isGoogleUser && !admin.password) {
      return res.status(401).json({
        success: false,
        message: "This account uses Google Sign-In. Please login with Google."
      });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    admin.lastLogin = new Date();
    const deviceId = await registerActiveDevice(admin, req);

    const token = generateToken(admin._id, admin.email, "admin", admin.name, null, deviceId);


    res.status(200).json({
      success: true,
      token,
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: "admin",
        isGoogleUser: admin.isGoogleUser,
        profilePicture: admin.profilePicture
      }
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ADMIN UPDATE PROFILE ============
router.put("/admin/update-profile", protect, adminOnly, async (req, res) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const admin = await User.findById(req.user.id);

    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    if (name) admin.name = name;

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: "Current password is required to change password" });
      }
      const isMatch = await admin.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: "Current password is incorrect" });
      }
      if (!isValidPassword(newPassword)) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 8 characters with at least 1 number and 1 special character (!@#$%&*)"
        });
      }
      admin.password = newPassword;
    }

    await admin.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        isGoogleUser: admin.isGoogleUser,
        profilePicture: admin.profilePicture
      }
    });
  } catch (error) {
    console.error("Admin update profile error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ GET CURRENT USER ============
router.get("/me", protect, async (req, res) => {
  try {
    if (req.user.role === "customer") {
      const customer = await Customer.findById(req.user.id).select("-password");
      if (!customer) {
        return res.status(404).json({ success: false, message: "Customer not found" });
      }
      res.json({
        success: true,
        user: {
          id: customer._id,
          customerId: customer.customerId,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          bankDetails: customer.bankDetails,
          profilePicture: customer.profilePicture,
          isGoogleUser: customer.isGoogleUser,
          role: "customer"
        }
      });
    } else {
      const admin = await User.findById(req.user.id).select("-password");
      if (!admin) {
        return res.status(404).json({ success: false, message: "Admin not found" });
      }
      res.json({ success: true, user: admin });
    }
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ CUSTOMER FORGOT PASSWORD ============
router.post("/customer/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const customer = await Customer.findOne({ email: email.toLowerCase() });

    // Always return success to avoid email enumeration
    if (!customer) {
      return res.status(200).json({
        success: true,
        message: "If an account with that email exists, a reset link has been sent."
      });
    }

    if (customer.isGoogleUser && !customer.password) {
      return res.status(400).json({
        success: false,
        message: "This account uses Google Sign-In. Password reset is not available."
      });
    }

    // Generate a secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpires = Date.now() + 15 * 60 * 1000; // 15 minutes

    customer.resetPasswordToken = resetToken;
    customer.resetPasswordExpires = resetTokenExpires;
    await customer.save();

    const requestOrigin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
    const defaultWebsiteUrl = process.env.NODE_ENV === "development" ? "http://localhost:8080" : "https://www.jewelskartindia.com";
    const websiteUrl = (requestOrigin && !requestOrigin.includes("render.com"))
      ? requestOrigin.replace(/\/$/, "")
      : (process.env.WEBSITE_URL || defaultWebsiteUrl);

    const resetUrl = `${websiteUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(customer.email)}`;

    console.log("📧 Sending password reset email to:", customer.email);
    console.log("🔗 Reset URL:", resetUrl);

    const emailSent = await sendCustomerPasswordResetEmail(customer.email, resetUrl, customer.name);

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send reset email. Please try again later."
      });
    }

    res.status(200).json({
      success: true,
      message: "If an account with that email exists, a reset link has been sent."
    });

  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ============ CUSTOMER RESET PASSWORD ============
router.post("/customer/reset-password", async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, message: "Email, token, and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const customer = await Customer.findOne({
      email: email.toLowerCase(),
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset link. Please request a new one."
      });
    }

    // Update the password and clear the reset token
    customer.password = newPassword;
    customer.resetPasswordToken = undefined;
    customer.resetPasswordExpires = undefined;
    await customer.save();

    console.log("✅ Password reset successfully for:", customer.email);

    res.status(200).json({
      success: true,
      message: "Password has been reset successfully. You can now log in with your new password."
    });

  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// ============ GET ACTIVE DEVICES ============
router.get("/active-devices", protect, async (req, res) => {
  try {
    let account;
    if (req.user.role === "customer") {
      account = await Customer.findById(req.user.id);
    } else {
      account = await User.findById(req.user.id);
    }

    if (!account) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Ensure activeDevices exists
    if (!account.activeDevices || account.activeDevices.length === 0) {
      const currentDeviceId = req.user.deviceId || crypto.randomBytes(16).toString("hex");
      const { deviceName, deviceType, ipAddress } = parseDevice(req);
      account.activeDevices = [{
        deviceId: currentDeviceId,
        deviceName,
        deviceType,
        ipAddress,
        lastActive: new Date(),
        loginTime: new Date()
      }];
      await account.save();
    } else if (req.user.deviceId) {
      const currentDev = account.activeDevices.find(d => d.deviceId === req.user.deviceId);
      if (currentDev) {
        currentDev.lastActive = new Date();
        await account.save();
      }
    }

    const currentDeviceId = req.user.deviceId;

    const devices = (account.activeDevices || []).map(d => ({
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      deviceType: d.deviceType,
      ipAddress: d.ipAddress,
      lastActive: d.lastActive,
      loginTime: d.loginTime,
      isCurrentDevice: currentDeviceId ? d.deviceId === currentDeviceId : false
    }));

    res.json({ success: true, count: devices.length, devices });
  } catch (error) {
    console.error("Get active devices error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ REVOKE ALL OTHER DEVICES ============
router.delete("/active-devices-all-other", protect, async (req, res) => {
  try {
    const currentDeviceId = req.user.deviceId;
    let account;
    if (req.user.role === "customer") {
      account = await Customer.findById(req.user.id);
    } else {
      account = await User.findById(req.user.id);
    }

    if (!account) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (currentDeviceId) {
      account.activeDevices = (account.activeDevices || []).filter(d => d.deviceId === currentDeviceId);
    } else {
      account.activeDevices = [];
    }
    await account.save();

    res.json({ success: true, message: "All other device sessions logged out successfully" });
  } catch (error) {
    console.error("Revoke all other devices error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ REVOKE SINGLE DEVICE ============
router.delete("/active-devices/:deviceId", protect, async (req, res) => {
  try {
    const { deviceId } = req.params;
    let account;
    if (req.user.role === "customer") {
      account = await Customer.findById(req.user.id);
    } else {
      account = await User.findById(req.user.id);
    }

    if (!account) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    account.activeDevices = (account.activeDevices || []).filter(d => d.deviceId !== deviceId);
    await account.save();

    res.json({ success: true, message: "Device session revoked successfully" });
  } catch (error) {
    console.error("Revoke device error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

