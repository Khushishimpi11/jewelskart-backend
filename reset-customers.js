const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load env vars
dotenv.config();

const Customer = require("./models/Customer");
const Order = require("./models/Order");
const { Counter } = require("./models/Counter");

// Add any missing models here so they don't crash the cascade delete
require("./models/User");

const resetCustomers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb+srv://jewelskartindia16_db_user:Jewelskart%2316@cluster0.sx8d4xv.mongodb.net/?appName=Cluster0", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB Connected");

    // Delete all orders first (cascade delete is on Customer, but let's be safe)
    const result = await Customer.find({});
    for (const customer of result) {
        await Order.deleteMany({ customerId: customer._id });
        await customer.deleteOne();
    }
    console.log("All Customers and their Orders deleted.");

    // Reset the counter
    await Counter.findOneAndUpdate(
      { _id: "customerId" },
      { seq: 0 },
      { upsert: true, new: true }
    );
    console.log("Customer ID sequence reset to 0 (next will be 1).");

    process.exit();
  } catch (err) {
    console.error("Error resetting customers:", err);
    process.exit(1);
  }
};

resetCustomers();
