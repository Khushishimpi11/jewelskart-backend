const jwt = require("jsonwebtoken");

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      console.error("Auth error:", error);
      res.status(401).json({ 
        success: false, 
        message: "Not authorized, token failed" 
      });
    }
  }
  
  if (!token) {
    res.status(401).json({ 
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