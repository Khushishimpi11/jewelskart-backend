const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { getNextSequence } = require("./Counter");

const customerSchema = new mongoose.Schema({
  customerId: { type: String, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { 
    type: String, 
    required: function() {
      return !this.googleId && this.isNew;
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
  bankDetails: {
    accountHolderName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    bankName: { type: String, default: "" },
    ifscCode: { type: String, default: "" },
    upiId: { type: String, default: "" }
  },
  googleId: { type: String, unique: true, sparse: true },
  profilePicture: { type: String, default: "" },
  isGoogleUser: { type: Boolean, default: false },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  isActive: { type: Boolean, default: true },
  totalSpent: { type: Number, default: 0 },
  orderCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date }
});

// Auto-generate customerId using counter collection
customerSchema.pre("save", async function(next) {
  try {
    if (!this.customerId) {
      console.log("🔑 Generating customerId for:", this.email);
      const seq = await getNextSequence("customerId");
      this.customerId = `CUST-${seq.toString().padStart(4, '0')}`;
      console.log(`✅ Generated customerId: ${this.customerId}`);
    }
    next();
  } catch (error) {
    console.error("❌ Error generating customerId:", error);
    next(error);
  }
});

// Hash password before saving
customerSchema.pre("save", async function(next) {
  try {
    if (this.password && this.isModified("password")) {
      console.log("🔐 Hashing password for:", this.email);
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
      console.log("✅ Password hashed successfully");
    }
    next();
  } catch (error) {
    console.error("❌ Error hashing password:", error);
    next(error);
  }
});

// ✅ CASCADE DELETE: Jab customer delete ho, toh saare orders bhi delete ho
customerSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  console.log(`🗑️ Cascade delete: Deleting all orders for customer: ${this.email}`);
  
  try {
    const Order = mongoose.model('Order');
    const result = await Order.deleteMany({ customerId: this._id });
    console.log(`✅ Deleted ${result.deletedCount} orders for customer ${this.email}`);
    next();
  } catch (error) {
    console.error('❌ Error deleting orders:', error);
    next(error);
  }
});

// For findByIdAndDelete
customerSchema.pre('findOneAndDelete', async function(next) {
  const customerId = this.getQuery()._id;
  console.log(`🗑️ Cascade delete: Deleting all orders for customer ID: ${customerId}`);
  
  try {
    const Order = mongoose.model('Order');
    const result = await Order.deleteMany({ customerId: customerId });
    console.log(`✅ Deleted ${result.deletedCount} orders`);
    next();
  } catch (error) {
    console.error('❌ Error deleting orders:', error);
    next(error);
  }
});

// Compare password method
customerSchema.methods.comparePassword = async function(password) {
  try {
    if (!this.password) {
      console.log("❌ No password stored for user:", this.email);
      return false;
    }
    const isMatch = await bcrypt.compare(password, this.password);
    return isMatch;
  } catch (error) {
    console.error("❌ Error comparing password:", error);
    return false;
  }
};

module.exports = mongoose.model("Customer", customerSchema);