const cron = require("node-cron");
const Product = require("../models/Product");
const notificationService = require("../services/notificationService");

class StockChecker {
  
  setupLowStockChecker() {
    // Runs at 10:00 AM and 6:00 PM daily
    cron.schedule("0 10,18 * * *", async () => {
      console.log("🔍 Running low stock check...");
      await this.checkLowStockProducts();
    });
    console.log("✅ Low stock checker scheduled for 10:00 AM and 6:00 PM");
  }
  
  setupOutOfStockChecker() {
    // Runs at 10:00 AM and 6:00 PM daily (2x per day)
    cron.schedule("0 10,18 * * *", async () => {
      console.log("🔍 Running out of stock check...");
      await this.checkOutOfStockProducts();
    });
    console.log("✅ Out of stock checker scheduled for 10:00 AM and 6:00 PM (2x daily)");
  }
  
  async checkLowStockProducts() {
    try {
      const lowStockProducts = await Product.find({
        quantity: { $gt: 0, $lt: 10 },
        isActive: true
      });
      
      if (lowStockProducts.length === 0) return;
      
      for (const product of lowStockProducts) {
        await notificationService.sendLowStock(product, product.quantity);
      }
      
      console.log(`📢 Sent ${lowStockProducts.length} low stock notifications`);
    } catch (error) {
      console.error("Error checking low stock:", error);
    }
  }
  
  async checkOutOfStockProducts() {
    try {
      const outOfStockProducts = await Product.find({ 
        quantity: 0, 
        isActive: true 
      });
      
      if (outOfStockProducts.length === 0) return;
      
      for (const product of outOfStockProducts) {
        await notificationService.sendOutOfStock(product);
      }
      
      console.log(`📢 Sent ${outOfStockProducts.length} out of stock notifications`);
    } catch (error) {
      console.error("Error checking out of stock:", error);
    }
  }
  
  // Call this when product stock is updated manually
  async checkProductStockChange(product, oldQuantity, newQuantity) {
    // Out of stock
    if (oldQuantity > 0 && newQuantity === 0) {
      await notificationService.sendOutOfStock(product);
    }
    // Back in stock
    else if (oldQuantity === 0 && newQuantity > 0) {
      await notificationService.sendBackInStock(product, newQuantity);
    }
    // Low stock
    else if (oldQuantity > 10 && newQuantity <= 10 && newQuantity > 0) {
      await notificationService.sendLowStock(product, newQuantity);
    }
  }
}

module.exports = new StockChecker();