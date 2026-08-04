const nodemailer = require("nodemailer");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const path = require("path");

require("dotenv").config();

// Import notification cron jobs
const stockChecker = require("./cron/stockChecker");

const app = express();

// ========== EMAIL CONFIGURATION ==========
const emailUser = (process.env.EMAIL_USER || "jewelskartindia16@gmail.com").trim();
const emailPass = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: emailUser,
    pass: emailPass,
  },
  connectionTimeout: 10000,  // 10 seconds to connect
  greetingTimeout: 10000,    // 10 seconds for greeting
  socketTimeout: 15000,     // 15 seconds per socket operation
});

// Verify email configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email configuration error:", error);
  } else {
    console.log("✅ Email server is ready to send messages");
  }
});

// Cloudinary Logo URL
const logoUrl = "https://res.cloudinary.com/dkawppfwu/image/upload/v1777292088/logo_1777288427544_z5hkug.png";

// Brand Color
const brandColor = "#612030";

// ============ ORDER CONFIRMATION EMAIL TEMPLATE ============
const getOrderConfirmationEmailHTML = (orderData) => {
  const { orderNumber, customerName, items, totalAmount, shippingAddress, paymentMethod, orderDate, trackingLink } = orderData;

  const itemsHTML = items.map(item => `
    <tr style="border-bottom: 1px solid #e0e0e0;">
      <td style="padding: 15px 10px; width: 80px;">
        <img src="${item.image}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;" />
      </td>
      <td style="padding: 15px 10px;">
        <strong style="color: #333;">${item.name}</strong><br/>
        <span style="color: #666; font-size: 12px;">Quantity: ${item.quantity}</span>
        ${item.size ? `<br/><span style="color: #666; font-size: 12px;">Size: ${item.size}</span>` : ''}
        <br/><span style="color: #888; font-size: 11px;">SKU: ${item.sku || 'N/A'}</span>
      </td>
      <td style="padding: 15px 10px; text-align: right; font-weight: bold; color: ${brandColor};">
        ₹${(item.price * item.quantity).toLocaleString('en-IN')}
      </td>
    </tr>
  `).join('');

  const formatDate = new Date(orderDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const shippingAddressHTML = shippingAddress ? `
    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 20px;">
      <h4 style="margin: 0 0 10px 0; color: ${brandColor};">📦 Shipping Address</h4>
      <p style="margin: 0; color: #555; line-height: 1.6;">
        ${shippingAddress.name || customerName}<br/>
        ${shippingAddress.street || ''}<br/>
        ${shippingAddress.city || ''} ${shippingAddress.state || ''} - ${shippingAddress.pincode || ''}<br/>
        ${shippingAddress.country || 'India'}
      </p>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation - JewelsKart</title>
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background-color: #f8f9fa;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 650px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .header {
      background-color: ${brandColor};
      padding: 30px 20px;
      text-align: center;
    }
    .header img {
      height: 60px;
      max-width: 200px;
    }
    .header h1 {
      color: #ffffff;
      margin: 10px 0 0;
      font-size: 24px;
    }
    .content {
      padding: 30px;
    }
    .order-info {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 25px;
    }
    .order-info p {
      margin: 5px 0;
      color: #555;
    }
    .order-info strong {
      color: ${brandColor};
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      text-align: left;
      padding: 12px 10px;
      background-color: ${brandColor};
      color: white;
    }
    .price-table {
      width: 100%;
      background: #f8f9fa;
      border-radius: 12px;
      margin: 25px 0;
      border: 1px solid #e0e0e0;
    }
    .price-table td {
      padding: 12px 20px;
    }
    .price-label {
      text-align: left;
      color: #555;
      font-size: 14px;
    }
    .price-value {
      text-align: right;
      font-weight: 600;
      color: #333;
      font-size: 14px;
    }
    .total-row td {
      border-top: 2px solid #e0e0e0;
      padding-top: 15px;
      padding-bottom: 15px;
    }
    .total-label {
      text-align: left;
      font-size: 18px;
      font-weight: bold;
      color: ${brandColor};
    }
    .total-value {
      text-align: right;
      font-size: 22px;
      font-weight: bold;
      color: ${brandColor};
    }
    .tracking-btn {
      display: inline-block;
      background-color: ${brandColor};
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 8px;
      margin: 20px 0;
      font-weight: bold;
    }
    .delivery-box {
      background-color: #e8f5e9;
      padding: 15px;
      border-radius: 8px;
      margin-top: 20px;
      text-align: center;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="JewelsKart">
      <h1>Order Confirmed! 🎉</h1>
    </div>
    
    <div class="content">
      <h2 style="color: ${brandColor};">Hello ${customerName || 'Customer'}!</h2>
      <p style="color: #555; line-height: 1.6;">Thank you for shopping with JewelsKart! Your order has been confirmed and will be processed soon.</p>
      
      <div class="order-info">
        <p><strong>📋 Order Number:</strong> #${orderNumber}</p>
        <p><strong>📅 Order Date:</strong> ${formatDate}</p>
        <p><strong>💳 Payment Method:</strong> ${paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online Payment'}</p>
        <p><strong>📧 Email:</strong> ${orderData.customerEmail || 'N/A'}</p>
        <p><strong>📞 Phone:</strong> ${orderData.customerPhone || 'N/A'}</p>
      </div>
      
      ${shippingAddressHTML}
      
      <h3 style="color: ${brandColor}; margin: 20px 0 10px;">🛍️ Order Items</h3>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Details</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHTML}
        </tbody>
      </table>
      
      <table class="price-table" cellpadding="0" cellspacing="0">
        <tr>
          <td class="price-label">Product Price (Excl. GST):</td>
          <td class="price-value">₹${(orderData.totalExclGst || ((orderData.subtotal || 0) - (orderData.tax || 0)))?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0'}</td>
        </tr>
        <tr>
          <td class="price-label">GST:</td>
          <td class="price-value">₹${(orderData.tax || orderData.gstAmount || 0)?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0'}</td>
        </tr>
        <tr>
          <td class="price-label">Shipping:</td>
          <td class="price-value">${orderData.shippingCharge === 0 ? 'Free' : `₹${orderData.shippingCharge?.toLocaleString('en-IN') || '0'}`}</td>
        </tr>
        <tr class="total-row">
          <td class="total-label">Grand Total:</td>
          <td class="total-value">₹${totalAmount.toLocaleString('en-IN')}</td>
        </tr>
      </table>
      
      <div style="text-align: center;">
        <a href="${trackingLink}" class="tracking-btn">🔍 Track Your Order</a>
      </div>
      
      <div class="delivery-box">
        <p style="margin: 0; color: #2e7d32; font-size: 14px;">
          <strong>📦 Estimated Delivery:</strong> ${orderData.estimatedDelivery || '5-7 business days'}
        </p>
      </div>
    </div>
    
    <div class="footer">
      <p>&copy; 2024 JewelsKart. All rights reserved.</p>
      <p>Need help? Contact us at <a href="mailto:support@jewelskartindia.com" style="color: ${brandColor};">support@jewelskartindia.com</a></p>
    </div>
  </div>
</body>
</html>
  `;
};

// ============ SEND ORDER CONFIRMATION EMAIL (FIXED) ============
const sendOrderConfirmationEmail = async (orderData) => {
  console.log("📧 ===== SENDING ORDER CONFIRMATION EMAIL =====");
  console.log("📧 Order Number:", orderData.orderNumber);
  console.log("📧 Customer Email:", orderData.customerEmail);

  try {
    const { orderNumber, customerEmail, customerName, items, totalAmount, shippingAddress, paymentMethod, createdAt } = orderData;

    // ✅ FIXED: trackingId defined
    const trackingId = orderNumber;
    const trackingLink = `${process.env.WEBSITE_URL || 'http://localhost:8081'}/track-order?id=${trackingId}`;
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 7);

    const emailData = {
      orderNumber,
      customerName: customerName || 'Customer',
      customerEmail,
      customerPhone: orderData.customerPhone,
      items: items.map(item => ({
        name: item.productName,
        quantity: item.quantity,
        price: item.price,
        size: item.size,
        image: item.productImage,
        sku: item.productSku
      })),
      subtotal: orderData.subtotal,
      shippingCharge: orderData.shippingCharge,
      tax: orderData.tax,
      totalAmount,
      shippingAddress,
      paymentMethod,
      orderDate: createdAt,
      trackingLink,
      estimatedDelivery: estimatedDelivery.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    };

    const htmlContent = getOrderConfirmationEmailHTML(emailData);
    const textContent = `Order Confirmation - JewelsKart\n\nOrder #${orderNumber}\nTotal: ₹${totalAmount.toLocaleString('en-IN')}\nTrack your order: ${trackingLink}`;

    const info = await transporter.sendMail({
      from: `"JewelsKart" <${process.env.EMAIL_USER || "jewelskartindia16@gmail.com"}>`,
      to: customerEmail,
      subject: `✨ Order Confirmed! #${orderNumber} - JewelsKart`,
      text: textContent,
      html: htmlContent,
    });

    console.log(`✅ Email SENT Successfully!`);
    console.log(`✅ Message ID: ${info.messageId}`);
    console.log(`✅ To: ${customerEmail}`);
    return true;

  } catch (error) {
    console.error("❌ EMAIL SEND FAILED:");
    console.error("❌ Error:", error.message);
    console.error("❌ Code:", error.code);
    return false;
  }
};

// ============ CLOUDINARY CONFIGURATION ==========
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
console.log("✅ Cloudinary configured successfully");

// CORS Configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like native mobile apps, curl, postman)
    if (!origin) return callback(null, true);

    // In development mode, allow any localhost or 127.0.0.1 origin (with any port)
    if (process.env.NODE_ENV === "development" || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    const allowedOrigins = ['http://localhost:8080', 'http://localhost:8081', 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'), false);
  },
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
const reviewRoutes = require('./routes/reviews');
const settingRoutes = require("./routes/settingRoutes");

app.use("/api/products", productRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/returns", returnRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/contact", contactRoutes);
app.use('/api/reviews', reviewRoutes);
app.use("/api/settings", settingRoutes);

// ============ STEP 3: ZOHO OAUTH CALLBACK ENDPOINT ============
const { exchangeAuthCode } = require("./services/zohoPaymentService");

app.get(["/auth/zoho/callback", "/api/auth/zoho/callback"], async (req, res) => {
  const { code, error, error_description } = req.query;

  console.log("\n" + "=".repeat(60));
  console.log("🔔 ZOHO OAUTH CALLBACK HIT");
  console.log("=".repeat(60));
  console.log("📥 Query params:", req.query);
  console.log("🕐 Timestamp:", new Date().toISOString());

  // ── Handle Zoho-returned error ────────────────────────────
  if (error) {
    console.error("❌ Zoho returned an error:", error, error_description);
    return res.status(400).send(`
      <html><body style="font-family:monospace;padding:30px;background:#1a0a0a;color:#ff6b6b">
        <h2>❌ Zoho OAuth Error</h2>
        <p><strong>Error:</strong> ${error}</p>
        <p><strong>Description:</strong> ${error_description || "No description"}</p>
        <p>Please re-generate the authorization URL and try again.</p>
      </body></html>
    `);
  }

  // ── Missing code ──────────────────────────────────────────
  if (!code) {
    console.error("❌ No authorization code in query params");
    return res.status(400).send(`
      <html><body style="font-family:monospace;padding:30px;background:#1a0a0a;color:#ff6b6b">
        <h2>❌ Missing Authorization Code</h2>
        <p>No <code>code</code> parameter was received. Please use the correct Zoho authorization URL.</p>
        <p>Authorization URL:<br>
        <a href="https://accounts.zoho.in/oauth/v2/auth?response_type=code&client_id=${process.env.ZOHO_CLIENT_ID}&scope=ZohoPayments.fullaccess.ALL&redirect_uri=${encodeURIComponent(process.env.ZOHO_REDIRECT_URI || 'https://jewelskart-backend-gt7z.onrender.com/auth/zoho/callback')}&access_type=offline&prompt=consent" style="color:#6baaff">
          Click here to authorize
        </a></p>
      </body></html>
    `);
  }

  try {
    console.log("🔄 Exchanging authorization code for tokens...");
    const tokenData = await exchangeAuthCode(code);

    console.log("✅ Token exchange response:", JSON.stringify(tokenData, null, 2));

    if (tokenData.error) {
      throw new Error(`Zoho token error: ${tokenData.error} — ${tokenData.error_description || ""}`);
    }

    const { access_token, refresh_token, expires_in, token_type, api_domain } = tokenData;

    if (refresh_token) {
      process.env.ZOHO_REFRESH_TOKEN = refresh_token;
      console.log("✅ ZOHO_REFRESH_TOKEN set in process.env (runtime only)");
      console.log("⚠️  ACTION REQUIRED: Copy the refresh_token below into your .env / Render env vars!");
    } else {
      console.warn("⚠️  No refresh_token in response — code may have been used before. Re-authorize with prompt=consent.");
    }

    if (access_token) {
      process.env.ZOHO_ACCESS_TOKEN = access_token;
      console.log("✅ ZOHO_ACCESS_TOKEN set in process.env (runtime only)");
    }

    // Return a styled HTML page for easy copy-paste
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>✅ Zoho OAuth Success - JewelsKart</title>
        <style>
          body { font-family: 'Courier New', monospace; background: #0d1117; color: #58d68d; padding: 30px; margin: 0; }
          h1 { color: #58d68d; border-bottom: 1px solid #2ecc71; padding-bottom: 10px; }
          h2 { color: #f0e68c; margin-top: 30px; }
          .box { background: #161b22; border: 1px solid #2ecc71; border-radius: 8px; padding: 20px; margin: 15px 0; }
          .token { background: #0d1117; border: 1px solid #30363d; padding: 12px; border-radius: 6px; word-break: break-all; color: #79c0ff; font-size: 13px; }
          .label { color: #8b949e; font-size: 12px; margin-bottom: 4px; }
          .action { background: #1f2937; border: 2px solid #f0e68c; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .action h3 { color: #f0e68c; margin: 0 0 10px 0; }
          .action p { color: #e5e7eb; margin: 5px 0; }
          code { background: #21262d; padding: 2px 6px; border-radius: 4px; color: #ff7b72; }
          .copy-btn { background: #2ea043; color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 12px; margin-left: 10px; }
          .error-box { background: #2d1010; border: 1px solid #ff6b6b; border-radius: 8px; padding: 20px; color: #ff6b6b; }
        </style>
      </head>
      <body>
        <h1>✅ Zoho OAuth Authorization Successful!</h1>
        <p style="color:#8b949e">JewelsKart backend received your Zoho tokens. The access_token is already active in this server session.</p>

        <div class="box">
          <div class="label">🔑 ACCESS TOKEN (valid for ~1 hour)</div>
          <div class="token">${access_token || "NOT RECEIVED"}</div>
        </div>

        <div class="box">
          <div class="label">🔄 REFRESH TOKEN (permanent — save this!)</div>
          <div class="token">${refresh_token || "⚠️ NOT RECEIVED — Please re-authorize with prompt=consent in the URL"}</div>
        </div>

        <div class="box">
          <div class="label">ℹ️ Other Info</div>
          <p style="color:#8b949e;margin:4px 0">Token Type: ${token_type || "Bearer"}</p>
          <p style="color:#8b949e;margin:4px 0">Expires In: ${expires_in || "3600"} seconds</p>
          <p style="color:#8b949e;margin:4px 0">API Domain: ${api_domain || "https://www.zohoapis.in"}</p>
        </div>

        <div class="action">
          <h3>⚠️ ACTION REQUIRED — Save the Refresh Token!</h3>
          ${refresh_token ? `
          <p>1. Copy the <strong>REFRESH TOKEN</strong> above</p>
          <p>2. Go to your <strong>Render Dashboard → Environment Variables</strong></p>
          <p>3. Set: <code>ZOHO_REFRESH_TOKEN=${refresh_token}</code></p>
          <p>4. Also set: <code>ZOHO_ACCESS_TOKEN=${access_token}</code></p>
          <p>5. Click <strong>Save Changes</strong> and redeploy the service</p>
          <p>6. Locally: Update your <code>.env</code> file with the same values</p>
          ` : `
          <p style="color:#ff6b6b">⚠️ No refresh_token was returned. This usually means this authorization code was already used once.</p>
          <p>Re-authorize using this URL (includes <code>prompt=consent</code> to force a new refresh token):</p>
          <p><a href="https://accounts.zoho.in/oauth/v2/auth?response_type=code&client_id=${process.env.ZOHO_CLIENT_ID}&scope=ZohoPayments.fullaccess.ALL&redirect_uri=${encodeURIComponent(process.env.ZOHO_REDIRECT_URI || 'https://jewelskart-backend-gt7z.onrender.com/auth/zoho/callback')}&access_type=offline&prompt=consent" style="color:#6baaff">🔗 Re-authorize here</a></p>
          `}
        </div>

        <p style="color:#3d4451;font-size:12px;margin-top:30px">
          JewelsKart Backend • ${new Date().toISOString()} • Zoho OAuth 2.0 Flow Complete
        </p>
      </body>
      </html>
    `);

    console.log("=".repeat(60));
    console.log("🎉 Zoho OAuth callback completed successfully");
    console.log("=".repeat(60) + "\n");

  } catch (err) {
    console.error("❌ Zoho OAuth Callback Exception:", err.message);
    console.error(err);
    res.status(500).send(`
      <html><body style="font-family:monospace;padding:30px;background:#1a0a0a;color:#ff6b6b">
        <h2>❌ Token Exchange Failed</h2>
        <p><strong>Error:</strong> ${err.message}</p>
        <p>The authorization code may be expired (codes expire in ~1 minute). Please <a href="https://accounts.zoho.in/oauth/v2/auth?response_type=code&client_id=${process.env.ZOHO_CLIENT_ID}&scope=ZohoPayments.fullaccess.ALL&redirect_uri=${encodeURIComponent(process.env.ZOHO_REDIRECT_URI || 'https://jewelskart-backend-gt7z.onrender.com/auth/zoho/callback')}&access_type=offline&prompt=consent" style="color:#6baaff">re-authorize here</a>.</p>
        <pre style="background:#111;padding:15px;border-radius:6px;overflow:auto;color:#aaa">${err.stack}</pre>
      </body></html>
    `);
  }
});


// ============ TEST EMAIL ENDPOINT ============
app.post("/api/test-email", async (req, res) => {
  console.log("🧪 Testing email endpoint...");

  try {
    await transporter.verify();
    console.log("✅ SMTP connection verified");

    const testResult = await transporter.sendMail({
      from: `"JewelsKart Test" <${process.env.EMAIL_USER || "jewelskartindia16@gmail.com"}>`,
      to: req.body.email || "test@example.com",
      subject: "Test Email from JewelsKart",
      text: "If you receive this, your email is working!",
      html: "<h2>✅ Email Working!</h2><p>Your nodemailer configuration is correct.</p>"
    });

    res.json({
      success: true,
      message: "Test email sent successfully",
      messageId: testResult.messageId
    });
  } catch (error) {
    console.error("❌ Test email failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
});

// ============ CMS ROUTES ============

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

// Banner Categories
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

// Jewellery Section
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

// ============ ADMIN CMS ROUTES ============

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

// PATCH routes
app.patch("/api/cms/admin/hero-slide/:id", async (req, res) => {
  try {
    const updated = await HeroSlide.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!updated) return res.status(404).json({ message: "Slide not found" });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch("/api/cms/admin/banner-category/:id", async (req, res) => {
  try {
    const updated = await BannerCategory.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    if (!updated) return res.status(404).json({ message: "Category not found" });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch("/api/cms/admin/about-section", async (req, res) => {
  try {
    let about = await AboutSection.findOne();
    if (!about) about = new AboutSection(req.body);
    else Object.keys(req.body).forEach(key => { if (req.body[key] !== undefined) about[key] = req.body[key]; });
    await about.save();
    res.json(about);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch("/api/cms/admin/partner-section", async (req, res) => {
  try {
    let partner = await PartnerSection.findOne();
    if (!partner) partner = new PartnerSection(req.body);
    else Object.keys(req.body).forEach(key => { if (req.body[key] !== undefined) partner[key] = req.body[key]; });
    await partner.save();
    res.json(partner);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch("/api/cms/admin/promo-banner", async (req, res) => {
  try {
    let promo = await PromoBanner.findOne();
    if (!promo) promo = new PromoBanner(req.body);
    else Object.keys(req.body).forEach(key => { if (req.body[key] !== undefined) promo[key] = req.body[key]; });
    await promo.save();
    res.json(promo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch("/api/cms/admin/jewellery-section", async (req, res) => {
  try {
    let jewellery = await JewellerySection.findOne();
    if (!jewellery) jewellery = new JewellerySection(req.body);
    else Object.keys(req.body).forEach(key => { if (req.body[key] !== undefined) jewellery[key] = req.body[key]; });
    await jewellery.save();
    res.json(jewellery);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.patch("/api/cms/admin/testimonial-section", async (req, res) => {
  try {
    let testimonial = await TestimonialSection.findOne();
    if (!testimonial) testimonial = new TestimonialSection(req.body);
    else Object.keys(req.body).forEach(key => { if (req.body[key] !== undefined) testimonial[key] = req.body[key]; });
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

// ============ TEST ROUTES ============
app.get("/api/cloudinary-test", (req, res) => {
  res.json({ success: true, message: "Cloudinary is ready!", cloudName: process.env.CLOUDINARY_CLOUD_NAME });
});

app.get("/api/test", (req, res) => {
  res.json({ message: "API is working! 🚀", success: true });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server is running", timestamp: new Date().toISOString() });
});

// ============ 404 HANDLER ============
app.use((req, res) => {
  console.log(`❌ Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.url} not found` });
});

// ============ ERROR HANDLER ============
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err.stack);
  res.status(500).json({ success: false, message: "Internal server error", error: err.message });
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
  console.log(`\n📧 Email endpoints:`);
  console.log(`   POST /api/test-email - Test email configuration`);
  console.log(`\n✅ Email is now FIXED! trackingId issue resolved.`);
  console.log(`${"=".repeat(60)}`);
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

// Export for use in order routes
module.exports = { sendOrderConfirmationEmail };