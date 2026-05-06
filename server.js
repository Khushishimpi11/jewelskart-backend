const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const path = require("path");

require("dotenv").config();

// Import notification cron jobs
const stockChecker = require("./cron/stockChecker");

const app = express();

// ========== CLOUDINARY CONFIGURATION ==========
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
console.log("✅ Cloudinary configured successfully");

// CORS Configuration
app.use(cors({
  origin: ['http://localhost:8080', 'http://localhost:8081', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Increase payload limit
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============ IMPORT MODELS ============
const {
  HeroSlide,
  BannerCategory,
  OfferBanner,
  AboutSection,
  PartnerSection,
  PromoBanner,
  JewellerySection,
  TestimonialSection
} = require("./models/SectionImage");

// ============ REGULAR ROUTES ============
const productRoutes = require("./routes/productRoutes");
const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const returnRoutes = require("./routes/returnRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const contactRoutes = require("./routes/contactRoutes");

app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/returns", returnRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/contact", contactRoutes);

// ============ CMS ROUTES (DIRECT IN SERVER.JS) ============

// ============ GET ROUTES ============

// Hero Slides
app.get("/api/cms/hero-slides", async (req, res) => {
  try {
    const slides = await HeroSlide.find({ isActive: true }).sort("displayOrder");
    res.json(slides);
  } catch (error) {
    console.error("Error fetching hero slides:", error);
    res.json([]);
  }
});

// Banner Categories (Shop by Category)
app.get("/api/cms/banner-categories", async (req, res) => {
  try {
    const categories = await BannerCategory.find({ isActive: true }).sort("displayOrder");
    res.json(categories);
  } catch (error) {
    console.error("Error fetching banner categories:", error);
    res.json([]);
  }
});

// Offer Banners
app.get("/api/cms/offer-banners", async (req, res) => {
  try {
    const banners = await OfferBanner.find({ isActive: true }).sort("displayOrder");
    res.json(banners);
  } catch (error) {
    console.error("Error fetching offer banners:", error);
    res.json([]);
  }
});

// About Section
app.get("/api/cms/about-section", async (req, res) => {
  try {
    const about = await AboutSection.findOne({ isActive: true });
    res.json(about);
  } catch (error) {
    console.error("Error fetching about section:", error);
    res.json(null);
  }
});

// Partner Section
app.get("/api/cms/partner-section", async (req, res) => {
  try {
    const partner = await PartnerSection.findOne({ isActive: true });
    res.json(partner);
  } catch (error) {
    console.error("Error fetching partner section:", error);
    res.json(null);
  }
});

// Promo Banner
app.get("/api/cms/promo-banner", async (req, res) => {
  try {
    const promo = await PromoBanner.findOne({ isActive: true });
    res.json(promo);
  } catch (error) {
    console.error("Error fetching promo banner:", error);
    res.json(null);
  }
});

// Jewellery Section (Stylish Design)
app.get("/api/cms/jewellery-section", async (req, res) => {
  try {
    const jewellery = await JewellerySection.findOne({ isActive: true });
    res.json(jewellery);
  } catch (error) {
    console.error("Error fetching jewellery section:", error);
    res.json(null);
  }
});

// Testimonial Section
app.get("/api/cms/testimonial-section", async (req, res) => {
  try {
    const testimonial = await TestimonialSection.findOne({ isActive: true });
    res.json(testimonial);
  } catch (error) {
    console.error("Error fetching testimonial section:", error);
    res.json(null);
  }
});

// ============ ADMIN CMS ROUTES (POST, PUT, DELETE) ============

// Hero Slides Admin
app.post("/api/cms/admin/hero-slide", async (req, res) => {
  try {
    const newSlide = new HeroSlide(req.body);
    await newSlide.save();
    res.status(201).json(newSlide);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put("/api/cms/admin/hero-slide/:id", async (req, res) => {
  try {
    const updated = await HeroSlide.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/cms/admin/hero-slide/:id", async (req, res) => {
  try {
    await HeroSlide.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Banner Categories Admin
app.post("/api/cms/admin/banner-category", async (req, res) => {
  try {
    const newCategory = new BannerCategory(req.body);
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.put("/api/cms/admin/banner-category/:id", async (req, res) => {
  try {
    const updated = await BannerCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/cms/admin/banner-category/:id", async (req, res) => {
  try {
    await BannerCategory.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Offer Banners Admin
app.post("/api/cms/admin/offer-banner", async (req, res) => {
  try {
    const newBanner = new OfferBanner(req.body);
    await newBanner.save();
    res.status(201).json(newBanner);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.delete("/api/cms/admin/offer-banner/:id", async (req, res) => {
  try {
    await OfferBanner.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// About Section Admin
app.post("/api/cms/admin/about-section", async (req, res) => {
  try {
    let about = await AboutSection.findOne();
    if (about) {
      Object.assign(about, req.body);
      await about.save();
    } else {
      about = new AboutSection(req.body);
      await about.save();
    }
    res.json(about);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Partner Section Admin
app.post("/api/cms/admin/partner-section", async (req, res) => {
  try {
    let partner = await PartnerSection.findOne();
    if (partner) {
      Object.assign(partner, req.body);
      await partner.save();
    } else {
      partner = new PartnerSection(req.body);
      await partner.save();
    }
    res.json(partner);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Promo Banner Admin
app.post("/api/cms/admin/promo-banner", async (req, res) => {
  try {
    let promo = await PromoBanner.findOne();
    if (promo) {
      Object.assign(promo, req.body);
      await promo.save();
    } else {
      promo = new PromoBanner(req.body);
      await promo.save();
    }
    res.json(promo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Jewellery Section Admin
app.post("/api/cms/admin/jewellery-section", async (req, res) => {
  try {
    let jewellery = await JewellerySection.findOne();
    if (jewellery) {
      Object.assign(jewellery, req.body);
      await jewellery.save();
    } else {
      jewellery = new JewellerySection(req.body);
      await jewellery.save();
    }
    res.json(jewellery);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Testimonial Section Admin
app.post("/api/cms/admin/testimonial-section", async (req, res) => {
  try {
    let testimonial = await TestimonialSection.findOne();
    if (testimonial) {
      Object.assign(testimonial, req.body);
      await testimonial.save();
    } else {
      testimonial = new TestimonialSection(req.body);
      await testimonial.save();
    }
    res.json(testimonial);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ============ ✅ NEW: PATCH ROUTES FOR PARTIAL UPDATE ============

// Hero Slides PATCH (Partial Update)
app.patch("/api/cms/admin/hero-slide/:id", async (req, res) => {
  try {
    const updated = await HeroSlide.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: "Slide not found" });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Banner Categories PATCH (Partial Update)
app.patch("/api/cms/admin/banner-category/:id", async (req, res) => {
  try {
    const updated = await BannerCategory.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: "Category not found" });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// About Section PATCH (Partial Update)
app.patch("/api/cms/admin/about-section", async (req, res) => {
  try {
    let about = await AboutSection.findOne();
    if (!about) {
      about = new AboutSection(req.body);
    } else {
      Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined) {
          about[key] = req.body[key];
        }
      });
    }
    await about.save();
    res.json(about);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Partner Section PATCH (Partial Update)
app.patch("/api/cms/admin/partner-section", async (req, res) => {
  try {
    let partner = await PartnerSection.findOne();
    if (!partner) {
      partner = new PartnerSection(req.body);
    } else {
      Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined) {
          partner[key] = req.body[key];
        }
      });
    }
    await partner.save();
    res.json(partner);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Promo Banner PATCH (Partial Update)
app.patch("/api/cms/admin/promo-banner", async (req, res) => {
  try {
    let promo = await PromoBanner.findOne();
    if (!promo) {
      promo = new PromoBanner(req.body);
    } else {
      Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined) {
          promo[key] = req.body[key];
        }
      });
    }
    await promo.save();
    res.json(promo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Jewellery Section PATCH (Partial Update)
app.patch("/api/cms/admin/jewellery-section", async (req, res) => {
  try {
    let jewellery = await JewellerySection.findOne();
    if (!jewellery) {
      jewellery = new JewellerySection(req.body);
    } else {
      Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined) {
          jewellery[key] = req.body[key];
        }
      });
    }
    await jewellery.save();
    res.json(jewellery);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Testimonial Section PATCH (Partial Update)
app.patch("/api/cms/admin/testimonial-section", async (req, res) => {
  try {
    let testimonial = await TestimonialSection.findOne();
    if (!testimonial) {
      testimonial = new TestimonialSection(req.body);
    } else {
      Object.keys(req.body).forEach(key => {
        if (req.body[key] !== undefined) {
          testimonial[key] = req.body[key];
        }
      });
    }
    await testimonial.save();
    res.json(testimonial);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ============ INITIALIZE NOTIFICATION CRON JOBS ============
stockChecker.setupLowStockChecker();
stockChecker.setupOutOfStockChecker();

console.log("✅ Notification cron jobs initialized");

// ============ CLOUDINARY TEST ROUTE ==========
app.get("/api/cloudinary-test", (req, res) => {
  res.json({ 
    success: true, 
    message: "Cloudinary is ready!",
    cloudName: process.env.CLOUDINARY_CLOUD_NAME
  });
});

// ============ DEBUG & FIX ROUTES ============
app.get("/api/check-orders", async (req, res) => {
  try {
    const Order = require("./models/Order");
    const Customer = require("./models/Customer");
    
    const totalOrders = await Order.countDocuments();
    const ordersWithCustomerId = await Order.countDocuments({ customerId: { $exists: true } });
    const ordersWithoutCustomerId = await Order.countDocuments({ customerId: { $exists: false } });
    
    const missingOrders = await Order.find(
      { customerId: { $exists: false } }, 
      { orderNumber: 1, customerEmail: 1, customerName: 1 }
    );
    
    res.json({
      success: true,
      totalOrders,
      ordersWithCustomerId,
      ordersWithoutCustomerId,
      missingOrders
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/fix-all-orders", async (req, res) => {
  try {
    const Order = require("./models/Order");
    const Customer = require("./models/Customer");
    
    const ordersWithoutId = await Order.find({ customerId: { $exists: false } });
    
    let fixedCount = 0;
    let notFoundCount = 0;
    const fixedOrders = [];
    const notFoundOrders = [];
    
    for (const order of ordersWithoutId) {
      const customer = await Customer.findOne({ email: order.customerEmail });
      
      if (customer) {
        order.customerId = customer._id;
        await order.save();
        fixedCount++;
        fixedOrders.push({
          orderNumber: order.orderNumber,
          customerName: customer.name,
          customerEmail: customer.email
        });
        console.log(`✅ Fixed: ${order.orderNumber} -> ${customer.name}`);
      } else {
        notFoundCount++;
        notFoundOrders.push({
          orderNumber: order.orderNumber,
          customerEmail: order.customerEmail
        });
        console.log(`❌ No customer: ${order.orderNumber} (${order.customerEmail})`);
      }
    }
    
    res.json({
      success: true,
      message: `Fixed ${fixedCount} orders`,
      fixedCount,
      notFoundCount,
      fixedOrders,
      notFoundOrders
    });
  } catch (error) {
    console.error("Fix orders error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/fix-order/:orderNumber", async (req, res) => {
  try {
    const Order = require("./models/Order");
    const Customer = require("./models/Customer");
    const { orderNumber } = req.params;
    
    const order = await Order.findOne({ orderNumber });
    
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    const customer = await Customer.findOne({ email: order.customerEmail });
    
    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        message: `Customer not found for email: ${order.customerEmail}`,
        suggestion: "Please create customer first"
      });
    }
    
    order.customerId = customer._id;
    await order.save();
    
    res.json({
      success: true,
      message: `✅ Fixed order: ${orderNumber}`,
      orderNumber: order.orderNumber,
      customerName: customer.name,
      customerEmail: customer.email,
      customerId: customer._id
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/fix-all-orders-get", async (req, res) => {
  try {
    const Order = require("./models/Order");
    const Customer = require("./models/Customer");
    
    const ordersWithoutId = await Order.find({ customerId: { $exists: false } });
    
    let fixedCount = 0;
    let notFoundCount = 0;
    const fixedOrders = [];
    
    for (const order of ordersWithoutId) {
      const customer = await Customer.findOne({ email: order.customerEmail });
      
      if (customer) {
        order.customerId = customer._id;
        await order.save();
        fixedCount++;
        fixedOrders.push({
          orderNumber: order.orderNumber,
          customerName: customer.name
        });
      } else {
        notFoundCount++;
      }
    }
    
    res.json({
      success: true,
      message: `✅ Fixed ${fixedCount} orders`,
      fixedCount,
      notFoundCount,
      fixedOrders
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/test", (req, res) => {
  res.json({ message: "API is working! 🚀", success: true });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running", timestamp: new Date().toISOString() });
});

// ============ 404 HANDLER (MUST BE LAST) ============
app.use((req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    success: false, 
    message: `Route ${req.method} ${req.url} not found`
  });
});

// ============ ERROR HANDLER ============
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res.status(500).json({ 
    success: false, 
    message: "Internal server error", 
    error: err.message 
  });
});

// ============ DATABASE CONNECTION ============
const connectDB = async () => {
  try {
    await mongoose.connect("mongodb+srv://jewelskartindia16_db_user:Jewelskart%2316@cluster0.sx8d4xv.mongodb.net/?appName=Cluster0");
    console.log("✅ MongoDB Connected Successfully");
  } catch (err) {
    console.log("❌ MongoDB Connection Error:", err.message);
  }
};

connectDB();

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`\n📌 AVAILABLE APIs:`);
  console.log(`\n🔐 Auth API: http://localhost:${PORT}/api/auth`);
  console.log(`📦 Products API: http://localhost:${PORT}/api/products`);
  console.log(`📦 Orders API: http://localhost:${PORT}/api/orders`);
  console.log(`📁 Categories API: http://localhost:${PORT}/api/categories`);
  console.log(`🔄 Returns API: http://localhost:${PORT}/api/returns`);
  console.log(`🔔 Notifications API: http://localhost:${PORT}/api/notifications`);
  console.log(`💳 Payment API: http://localhost:${PORT}/api/payment`);
  console.log(`\n📸 CMS APIs:`);
  console.log(`   GET  /api/cms/hero-slides`);
  console.log(`   GET  /api/cms/banner-categories`);
  console.log(`   GET  /api/cms/offer-banners`);
  console.log(`   GET  /api/cms/about-section`);
  console.log(`   GET  /api/cms/partner-section`);
  console.log(`   GET  /api/cms/promo-banner`);
  console.log(`   GET  /api/cms/jewellery-section`);
  console.log(`   GET  /api/cms/testimonial-section`);
  console.log(`\n📝 CMS ADMIN APIs:`);
  console.log(`   POST /api/cms/admin/hero-slide`);
  console.log(`   PUT  /api/cms/admin/hero-slide/:id`);
  console.log(`   PATCH /api/cms/admin/hero-slide/:id ✅ NEW`);
  console.log(`   POST /api/cms/admin/banner-category`);
  console.log(`   PUT  /api/cms/admin/banner-category/:id`);
  console.log(`   PATCH /api/cms/admin/banner-category/:id ✅ NEW`);
  console.log(`   POST /api/cms/admin/about-section`);
  console.log(`   PATCH /api/cms/admin/about-section ✅ NEW`);
  console.log(`   POST /api/cms/admin/partner-section`);
  console.log(`   PATCH /api/cms/admin/partner-section ✅ NEW`);
  console.log(`   POST /api/cms/admin/promo-banner`);
  console.log(`   PATCH /api/cms/admin/promo-banner ✅ NEW`);
  console.log(`   POST /api/cms/admin/jewellery-section`);
  console.log(`   PATCH /api/cms/admin/jewellery-section ✅ NEW`);
  console.log(`   POST /api/cms/admin/testimonial-section`);
  console.log(`   PATCH /api/cms/admin/testimonial-section ✅ NEW`);
  console.log(`\n☁️ Cloudinary Test: http://localhost:${PORT}/api/cloudinary-test`);
  console.log(`\n${"=".repeat(60)}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});