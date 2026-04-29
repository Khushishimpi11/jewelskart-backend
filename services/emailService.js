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
    </table>
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
      <tr>
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