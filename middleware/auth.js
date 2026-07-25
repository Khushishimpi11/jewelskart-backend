const jwt = require("jsonwebtoken");
const Customer = require("../models/Customer");
const User = require("../models/User");

// Protect routes - verify JWT token & active device session
const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "jewelskart_secret_key_2024");
      req.user = decoded;

      // Check if session has been revoked from active devices
      if (decoded.deviceId) {
        let account;
        if (decoded.role === "customer") {
          account = await Customer.findById(decoded.id).select("activeDevices");
        } else {
          account = await User.findById(decoded.id).select("activeDevices");
        }

        if (account && account.activeDevices && account.activeDevices.length > 0) {
          const sessionExists = account.activeDevices.some(d => d.deviceId === decoded.deviceId);
          if (!sessionExists) {
            console.log(`🔒 Revoked session blocked for ${decoded.email} (Device ID: ${decoded.deviceId})`);
            return res.status(401).json({
              success: false,
              message: "Session has been logged out from active devices. Please login again.",
              sessionRevoked: true
            });
          }
        }
      }

      return next();
    } catch (error) {
      console.error("Auth error:", error);
      return res.status(401).json({ 
        success: false, 
        message: "Not authorized, token failed" 
      });
    }
  }
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: "Not authorized, no token" 
    });
  }
};


// Admin only middleware
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ 
      success: false, 
      message: "Access denied. Admin only." 
    });
  }
};

// Customer only middleware
const customerOnly = (req, res, next) => {
  if (req.user && req.user.role === "customer") {
    next();
  } else {
    res.status(403).json({ 
      success: false, 
      message: "Access denied. Customer only." 
    });
  }
};

module.exports = { protect, adminOnly, customerOnly };