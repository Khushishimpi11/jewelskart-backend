const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Customer = require("../models/Customer");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { protect, adminOnly } = require("../middleware/auth");
const notificationService = require("../services/notificationService");
const { 
  sendAdminPasswordResetEmail, 
  sendCustomerPasswordResetEmail 
} = require("../services/emailService");

const generateToken = (id, email, role, name, customerId) => {
  return jwt.sign(
    { id, email, role, name, customerId },
    process.env.JWT_SECRET || "jewelskart_secret_key_2024",
    { expiresIn: "90d" }
  );
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
    await customer.save();
    
    if (isNewCustomer) {
      await notificationService.sendNewCustomer(customer);
    }
    
    const token = generateToken(
      customer._id, 
      customer.email, 
      "customer", 
      customer.name, 
      customer.customerId
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
    await admin.save();
    
    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: "admin", name: admin.name },
      process.env.JWT_SECRET || "jewelskart_secret_key_2024",
      { expiresIn: "90d" }
    );
    
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
      return res.status(400).json({ success: false, message: "Email is required" });
    }
    
    const admin = await User.findOne({ email, role: "admin" });
    
    if (!admin) {
      return res.status(200).json({ 
        success: true, 
        message: "If email exists, password reset link will be sent" 
      });
    }
    
    if (admin.isGoogleUser) {
      return res.status(400).json({ 
        success: false, 
        message: "This account uses Google Sign-In. Please login with Google." 
      });
    }
    
    const resetToken = crypto.randomBytes(32).toString("hex");
    
    admin.resetPasswordToken = resetToken;
    admin.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await admin.save();
    
    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:8080"}/reset-password?token=${resetToken}&email=${email}`;
    
    console.log("📧 Admin Password Reset URL:", resetUrl);
    
    await sendAdminPasswordResetEmail(email, resetUrl, admin.name);
    
    res.status(200).json({
      success: true,
      message: "Password reset link has been sent to your email",
      resetUrl: process.env.NODE_ENV === "development" ? resetUrl : undefined
    });
    
  } catch (error) {
    console.error("Admin forgot password error:", error);
    res.status(500).json({ success: false, message: error.message });
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
    
    const customer = await Customer.findOne({ email });
    
    if (!customer) {
      return res.status(200).json({ 
        success: true, 
        message: "If email exists, password reset link will be sent" 
      });
    }
    
    if (customer.isGoogleUser) {
      return res.status(400).json({ 
        success: false, 
        message: "This account uses Google Sign-In. Please login with Google." 
      });
    }
    
    const resetToken = crypto.randomBytes(32).toString("hex");
    
    customer.resetPasswordToken = resetToken;
    customer.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await customer.save();
    
    const resetUrl = `${process.env.WEBSITE_URL || "http://localhost:8081"}/reset-password?token=${resetToken}&email=${email}`;
    
    console.log("📧 Customer Password Reset URL:", resetUrl);
    
    // ✅ Send email to customer
    await sendCustomerPasswordResetEmail(email, resetUrl, customer.name);
    
    res.status(200).json({
      success: true,
      message: "Password reset link sent to your email",
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
    
    const token = generateToken(customer._id, customer.email, "customer", customer.name, customer.customerId);
    
    await notificationService.sendNewCustomer(customer);
    
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
    await customer.save();
    
    const token = generateToken(customer._id, customer.email, "customer", customer.name, customer.customerId);
    
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
    
    const fullName = `${firstName} ${lastName}`.trim();
    if (fullName) customer.name = fullName;
    if (phone) customer.phone = phone;
    
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
    
    await customer.deleteOne();
    
    res.status(200).json({
      success: true,
      message: "Customer deleted successfully"
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ ADMIN REGISTRATION ============
router.post("/admin/register", async (req, res) => {
  try {
    const { name, email, password, secretKey } = req.body;
    const ADMIN_SECRET = process.env.ADMIN_SECRET || "ADMIN_SECRET_2024";
    
    if (secretKey !== ADMIN_SECRET) {
      return res.status(403).json({ success: false, message: "Invalid secret key" });
    }
    
    const existingAdmin = await User.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: "Admin already exists" });
    }
    
    if (!isValidPassword(password)) {
      return res.status(400).json({ 
        success: false, 
        message: "Password must be at least 8 characters with at least 1 number and 1 special character (!@#$%^&*)" 
      });
    }
    
    const admin = await User.create({ 
      name, 
      email, 
      password, 
      role: "admin",
      isGoogleUser: false
    });
    
    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: "admin", name: admin.name },
      process.env.JWT_SECRET || "jewelskart_secret_key_2024",
      { expiresIn: "90d" }
    );
    
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
    await admin.save();
    
    const token = jwt.sign(
      { id: admin._id, email: admin.email, role: "admin", name: admin.name },
      process.env.JWT_SECRET || "jewelskart_secret_key_2024",
      { expiresIn: "90d" }
    );
    
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

module.exports = router;