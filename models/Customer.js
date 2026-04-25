const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const customerSchema = new mongoose.Schema({
  customerId: { type: String, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { 
    type: String, 
    required: function() {
      // Password required only for non-Google users
      return !this.googleId;
    }
  },
  phone: { type: String, default: "" },
  address: {
    street: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
    country: { type: String, default: "India" }
  },
  // ✅ Bank Details for Refunds
  bankDetails: {
    accountHolderName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    bankName: { type: String, default: "" },
    ifscCode: { type: String, default: "" },
    upiId: { type: String, default: "" }
  },
  // ✅ Google Sign-In Fields
  googleId: { type: String, unique: true, sparse: true },
  profilePicture: { type: String, default: "" },
  isGoogleUser: { type: Boolean, default: false },
  
  isActive: { type: Boolean, default: true },
  totalSpent: { type: Number, default: 0 },
  orderCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date }
});

// Auto-generate customerId
customerSchema.pre("save", async function(next) {
  if (!this.customerId) {
    const Customer = mongoose.model("Customer");
    const count = await Customer.countDocuments();
    const nextNumber = (count + 1).toString().padStart(4, '0');
    this.customerId = `CUST-${nextNumber}`;
  }
  next();
});

// Hash password before saving (only if password exists and modified)
customerSchema.pre("save", async function(next) {
  if (!this.isModified("password") || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
customerSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("Customer", customerSchema);