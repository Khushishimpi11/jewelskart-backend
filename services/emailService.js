const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: process.env.EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || "jewelskartindia16@gmail.com",
    pass: process.env.EMAIL_PASS || "leud gwxk fxjz pedg",
  },
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
    @media only screen and (max-width: 600px) {
      .content { padding: 15px; }
      th, td { padding: 8px 5px; font-size: 12px; }
      td img { width: 40px; height: 40px; }
      .price-table td { padding: 8px 15px; }
      .total-label { font-size: 16px; }
      .total-value { font-size: 18px; }
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
        <a href="${trackingLink}" class="tracking-btn"> Track Your Order</a>
      </div>
      
      <div class="delivery-box">
        <p style="margin: 0; color: #2e7d32; font-size: 14px;">
          <strong>📦 Estimated Delivery:</strong> ${orderData.estimatedDelivery || '5-7 business days'}
        </p>
        <p style="margin: 5px 0 0; color: #555; font-size: 12px;">
          You will receive another email when your order is shipped.
        </p>
      </div>
    </div>
    
    <div class="footer">
      <p>&copy; 2024 JewelsKart. All rights reserved.</p>
      <p>Need help? Contact us at <a href="mailto:support@jewelskartindia.com" style="color: ${brandColor};">support@jewelskartindia.com</a></p>
      <p>Visit our website: <a href="${process.env.WEBSITE_URL || 'http://localhost:8081'}" style="color: ${brandColor};">www.jewelskartindia.com</a></p>
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

    // ✅ FIXED: Use orderNumber as trackingId (not undefined variable)
    const trackingId = orderNumber;  // 👈 THIS WAS MISSING!
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

// ============ ADMIN EMAIL TEMPLATES ============
const getAdminPasswordResetEmailHTML = (name, resetUrl) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Admin Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="550" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <tr>
            <td style="background-color: ${brandColor}; padding: 30px 20px; text-align: center;">
              <img src="${logoUrl}" alt="JewelsKart" style="height: 60px; max-width: 200px;">
              <p style="color: #e8b4b8; margin: 15px 0 0; font-size: 14px;">Administrator Panel</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 35px 30px;">
              <h2 style="color: #333;">Hello ${name || "Admin"}! 👋</h2>
              <p style="color: #555; line-height: 1.6;">We received a request to reset your password for your JewelsKart Admin account.</p>
              <p style="color: #555; line-height: 1.6;">Click the button below to create a new password:</p>
              <div style="text-align: center; margin: 35px 0;">
                <a href="${resetUrl}" style="background-color: ${brandColor}; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">🔐 Reset Password</a>
              </div>
              <p style="color: #555; line-height: 1.6; font-size: 14px;">Or copy this link: <br><a href="${resetUrl}" style="color: ${brandColor};">${resetUrl}</a></p>
              <p style="color: #e74c3c; font-size: 12px; margin-top: 20px;">⚠️ This link expires in <strong>15 minutes</strong>.</p>
              <hr style="margin: 25px 0 15px;">
              <p style="color: #888; font-size: 12px;">Need help? <a href="mailto:support@jewelskartindia.com" style="color: ${brandColor};">support@jewelskartindia.com</a></p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center;">
              <p style="color: #888;">&copy; 2024 JewelsKart. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// ============ CUSTOMER EMAIL TEMPLATES ============
const getCustomerPasswordResetEmailHTML = (name, resetUrl) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Customer Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="550" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <tr>
            <td style="background-color: ${brandColor}; padding: 30px 20px; text-align: center;">
              <img src="${logoUrl}" alt="JewelsKart" style="height: 60px; max-width: 200px;">
              <p style="color: #e8b4b8; margin: 15px 0 0; font-size: 14px;">Customer Support</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 35px 30px;">
              <h2 style="color: #333;">Hello ${name || "Customer"}! 👋</h2>
              <p style="color: #555; line-height: 1.6;">We received a request to reset your password for your JewelsKart account.</p>
              <p style="color: #555; line-height: 1.6;">Click the button below to create a new password:</p>
              <div style="text-align: center; margin: 35px 0;">
                <a href="${resetUrl}" style="background-color: ${brandColor}; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">🔐 Reset Password</a>
              </div>
              <p style="color: #555; line-height: 1.6; font-size: 14px;">Or copy this link: <br><a href="${resetUrl}" style="color: ${brandColor};">${resetUrl}</a></p>
              <p style="color: #e74c3c; font-size: 12px; margin-top: 20px;">⚠️ This link expires in <strong>15 minutes</strong>.</p>
              <hr style="margin: 25px 0 15px;">
              <p style="color: #888; font-size: 12px;">Need help? <a href="mailto:support@jewelskartindia.com" style="color: ${brandColor};">support@jewelskartindia.com</a></p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center;">
              <p style="color: #888;">&copy; 2024 JewelsKart. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

const getCustomerWelcomeEmailHTML = (name) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Welcome to JewelsKart</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="550" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background-color: ${brandColor}; padding: 30px 20px; text-align: center;">
              <img src="${logoUrl}" alt="JewelsKart" style="height: 60px;">
              <p style="color: #e8b4b8; margin: 15px 0 0;">Welcome to JewelsKart</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 35px 30px;">
              <h2 style="color: #333;">Welcome ${name || "Customer"}! 🎉</h2>
              <p style="color: #555; line-height: 1.6;">Thank you for creating an account with JewelsKart!</p>
              <p style="color: #555; line-height: 1.6;">You can now:</p>
              <ul style="color: #555;">
                <li>Shop our exclusive jewellery collection</li>
                <li>Track your orders</li>
                <li>Manage your wishlist</li>
                <li>Get exclusive offers</li>
              </ul>
              <div style="text-align: center; margin: 35px 0;">
                <a href="${process.env.WEBSITE_URL || "http://localhost:8081"}/shop" style="background-color: ${brandColor}; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Start Shopping →</a>
              </div>
              <hr>
              <p style="color: #888; font-size: 12px;">Need help? <a href="mailto:support@jewelskartindia.com" style="color: ${brandColor};">support@jewelskartindia.com</a></p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px; text-align: center;">
              <p style="color: #888;">&copy; 2024 JewelsKart. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

// ============ SEND EMAIL FUNCTIONS ============

// Admin Password Reset Email
const sendAdminPasswordResetEmail = async (email, resetUrl, name) => {
  try {
    const htmlContent = getAdminPasswordResetEmailHTML(name, resetUrl);
    const textContent = `Reset your password: ${resetUrl}`;

    await transporter.sendMail({
      from: `"JewelsKart Admin" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 Reset Your JewelsKart Admin Password",
      text: textContent,
      html: htmlContent,
    });
    console.log("✅ Admin password reset email sent to:", email);
    return true;
  } catch (error) {
    console.error("❌ Admin email error:", error.message);
    return false;
  }
};

// Customer Password Reset Email
const sendCustomerPasswordResetEmail = async (email, resetUrl, name) => {
  try {
    const htmlContent = getCustomerPasswordResetEmailHTML(name, resetUrl);
    const textContent = `Reset your password: ${resetUrl}`;

    await transporter.sendMail({
      from: `"JewelsKart" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 Reset Your JewelsKart Account Password",
      text: textContent,
      html: htmlContent,
    });
    console.log("✅ Customer password reset email sent to:", email);
    return true;
  } catch (error) {
    console.error("❌ Customer email error:", error.message);
    return false;
  }
};

// Customer Welcome Email
const sendCustomerWelcomeEmail = async (email, name) => {
  try {
    const htmlContent = getCustomerWelcomeEmailHTML(name);
    const textContent = `Welcome to JewelsKart! Start shopping: ${process.env.WEBSITE_URL || "http://localhost:8081"}/shop`;

    await transporter.sendMail({
      from: `"JewelsKart" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🎉 Welcome to JewelsKart!",
      text: textContent,
      html: htmlContent,
    });
    console.log("✅ Customer welcome email sent to:", email);
    return true;
  } catch (error) {
    console.error("❌ Customer welcome email error:", error.message);
    return false;
  }
};

// Admin Welcome Email
const sendAdminWelcomeEmail = async (email, name) => {
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Welcome Admin</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="550" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background-color: ${brandColor}; padding: 30px 20px; text-align: center;">
              <img src="${logoUrl}" alt="JewelsKart" style="height: 60px;">
              <p style="color: #e8b4b8;">Admin Panel</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 35px 30px;">
              <h2>Welcome ${name || "Admin"}! 🎉</h2>
              <p>Your admin account has been created successfully.</p>
              <div style="text-align: center; margin: 35px 0;">
                <a href="${process.env.FRONTEND_URL || "http://localhost:8080"}/login" style="background-color: ${brandColor}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px;">Go to Admin Panel →</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: `"JewelsKart Admin" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🎉 Welcome to JewelsKart Admin Panel",
      text: `Welcome! Login here: ${process.env.FRONTEND_URL || "http://localhost:8080"}/login`,
      html: htmlContent,
    });
    console.log("✅ Admin welcome email sent to:", email);
    return true;
  } catch (error) {
    console.error("❌ Admin welcome email error:", error.message);
    return false;
  }
};

module.exports = {
  // Order email
  sendOrderConfirmationEmail,
  // Admin emails
  sendAdminPasswordResetEmail,
  sendAdminWelcomeEmail,
  // Customer emails
  sendCustomerPasswordResetEmail,
  sendCustomerWelcomeEmail,
  // Legacy (for backward compatibility)
  sendPasswordResetEmail: sendAdminPasswordResetEmail,
  sendWelcomeEmail: sendAdminWelcomeEmail,
};