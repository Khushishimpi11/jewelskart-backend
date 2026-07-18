const mongoose = require("mongoose");
const MONGODB_URI = "mongodb+srv://jewelskartindia16_db_user:Jewelskart%2316@cluster0.sx8d4xv.mongodb.net/?appName=Cluster0";

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB.");

    const db = mongoose.connection.db;
    const productsCollection = db.collection("products");

    const products = await productsCollection.find({}).toArray();
    console.log(`Total products: ${products.length}`);
    products.forEach(p => {
      console.log(`- ${p.name} | SKU: ${p.sku} | Category: ${p.category}`);
    });

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
