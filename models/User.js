const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String },
  role: { type: String, enum: ["admin"], default: "admin" },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
  
  // Google Sign-In fields
  googleId: { type: String, sparse: true },
  isGoogleUser: { type: Boolean, default: false },
  profilePicture: { type: String },
  
  // Forgot Password fields
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  activeDevices: [{
    deviceId: { type: String },
    deviceName: { type: String },
    deviceType: { type: String, default: "Desktop" },
    ipAddress: { type: String, default: "" },
    lastActive: { type: Date, default: Date.now },
    loginTime: { type: Date, default: Date.now }
  }]
});

// Hash password before saving (only if password is modified and exists)
userSchema.pre("save", async function(next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(password) {
  if (!this.password) return false;
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);