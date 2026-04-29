const express = require("express");
const router = express.Router();
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

// Logo URL
const logoUrl = "https://res.cloudinary.com/dkawppfwu/image/upload/v1777292088/logo_1777288427544_z5hkug.png";

// Brand Color
const brandColor = "#612030";

// Website URL
const websiteUrl = process.env.WEBSITE_URL || "http://localhost:8081";

// Professional Email Template for Contact
const getProfessionalEmailTemplate = (type, data) => {
  if (type === 'contact') {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact Form Submission</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: ${brandColor}; padding: 25px 20px; text-align: center; }
    .logo { max-height: 50px; margin-bottom: 10px; }
    .header-title { color: #ffffff; font-size: 24px; margin: 0; font-weight: 600; }
    .content { padding: 30px; }
    .section { margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
    .section-title { font-size: 16px; font-weight: 600; color: ${brandColor}; margin-bottom: 10px; letter-spacing: 1px; }
    .field { margin-bottom: 12px; }
    .field-label { font-size: 12px; color: #888; text-transform: uppercase; margin-bottom: 4px; }
    .field-value { font-size: 15px; color: #333; font-weight: 500; }
    .message-box { background: #f9f9f9; padding: 15px; border-radius: 8px; border-left: 3px solid ${brandColor}; margin-top: 10px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888; }
    .badge { display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .website-link { color: ${brandColor}; text-decoration: none; font-weight: 500; }
  </style>
</head>
<body style="margin: 0; padding: 20px;">
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="JewelsKart" class="logo" style="max-height: 45px;">
      <h1 class="header-title">New Customer Inquiry</h1>
    </div>
    <div class="content">
      <div style="text-align: right; margin-bottom: 20px;">
        <span class="badge">🕐 ${new Date().toLocaleString()}</span>
      </div>
      
      <div class="section">
        <div class="section-title">📋 CUSTOMER DETAILS</div>
        <div class="field">
          <div class="field-label">Full Name</div>
          <div class="field-value">${data.name}</div>
        </div>
        <div class="field">
          <div class="field-label">Email Address</div>
          <div class="field-value">${data.email}</div>
        </div>
        ${data.phone ? `
        <div class="field">
          <div class="field-label">Phone Number</div>
          <div class="field-value">${data.phone}</div>
        </div>
        ` : ''}
      </div>
      
      <div class="section">
        <div class="section-title">📝 INQUIRY DETAILS</div>
        <div class="field">
          <div class="field-label">Subject</div>
          <div class="field-value">${data.subject || "General Inquiry"}</div>
        </div>
        <div class="field">
          <div class="field-label">Message</div>
          <div class="message-box">
            <div class="field-value">${data.message}</div>
          </div>
        </div>
      </div>
      
      <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; margin-top: 20px;">
        <div style="font-size: 13px; color: #666;">
          <strong>📌 Quick Actions:</strong><br>
          • Reply directly to this email<br>
          • Call customer: ${data.phone || "N/A"}<br>
          • Visit website: <a href="${websiteUrl}" class="website-link">www.jewelskart.com</a>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} JewelsKart. All rights reserved.</p>
      <p style="font-size: 11px;">This is an automated notification from <a href="${websiteUrl}" style="color: ${brandColor};">www.jewelskart.com</a></p>
    </div>
  </div>
</body>
</html>
    `;
  }
  
  // Partner Form Template
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Partnership Request</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: ${brandColor}; padding: 25px 20px; text-align: center; }
    .logo { max-height: 50px; margin-bottom: 10px; }
    .header-title { color: #ffffff; font-size: 24px; margin: 0; font-weight: 600; }
    .content { padding: 30px; }
    .section { margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
    .section-title { font-size: 16px; font-weight: 600; color: ${brandColor}; margin-bottom: 10px; letter-spacing: 1px; }
    .field { margin-bottom: 12px; }
    .field-label { font-size: 12px; color: #888; text-transform: uppercase; margin-bottom: 4px; }
    .field-value { font-size: 15px; color: #333; font-weight: 500; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888; }
    .badge { display: inline-block; background: #e3f2fd; color: #1565c0; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .website-link { color: ${brandColor}; text-decoration: none; font-weight: 500; }
  </style>
</head>
<body style="margin: 0; padding: 20px;">
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="JewelsKart" class="logo" style="max-height: 45px;">
      <h1 class="header-title">🤝 New Partnership Request</h1>
    </div>
    <div class="content">
      <div style="text-align: right; margin-bottom: 20px;">
        <span class="badge">⭐ Pending Review</span>
      </div>
      
      <div class="section">
        <div class="section-title">🏢 BUSINESS DETAILS</div>
        <div class="field">
          <div class="field-label">Business Name</div>
          <div class="field-value">${data.businessName}</div>
        </div>
        <div class="field">
          <div class="field-label">Owner Name</div>
          <div class="field-value">${data.ownerName}</div>
        </div>
        <div class="field">
          <div class="field-label">Business Type</div>
          <div class="field-value">${data.businessType || "Not specified"}</div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">📞 CONTACT INFORMATION</div>
        <div class="field">
          <div class="field-label">Email</div>
          <div class="field-value">${data.email}</div>
        </div>
        <div class="field">
          <div class="field-label">Phone</div>
          <div class="field-value">${data.phone}</div>
        </div>
        <div class="field">
          <div class="field-label">City</div>
          <div class="field-value">${data.city || "Not specified"}</div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-title">💎 PRODUCT DETAILS</div>
        <div class="field">
          <div class="field-label">Products/Category</div>
          <div class="field-value">${data.products || "Not specified"}</div>
        </div>
        ${data.message ? `
        <div class="field">
          <div class="field-label">Additional Message</div>
          <div class="field-value" style="background: #f9f9f9; padding: 12px; border-radius: 6px;">${data.message}</div>
        </div>
        ` : ''}
      </div>
      
      <div style="background: #f0f7ff; padding: 15px; border-radius: 8px; margin-top: 20px;">
        <div style="font-size: 13px; color: #666;">
          <strong>📌 Quick Actions:</strong><br>
          • Reply directly to this email<br>
          • Visit website: <a href="${websiteUrl}" class="website-link">www.jewelskart.com</a>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} JewelsKart. All rights reserved.</p>
      <p style="font-size: 11px;">This is an automated notification from <a href="${websiteUrl}" style="color: ${brandColor};">www.jewelskart.com</a></p>
    </div>
  </div>
</body>
</html>
  `;
};

// Customer Auto-reply Template
const getCustomerReplyTemplate = (name) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You - JewelsKart</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4; }
    .container { max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: ${brandColor}; padding: 30px 20px; text-align: center; }
    .logo { max-height: 45px; margin-bottom: 10px; }
    .header-title { color: #ffffff; font-size: 22px; margin: 10px 0 0; }
    .content { padding: 30px; }
    .thankyou-text { font-size: 24px; color: ${brandColor}; margin-bottom: 15px; }
    .message-box { background: #f9f9f9; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center; }
    .button { display: inline-block; background: ${brandColor}; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888; }
    .website-link { color: ${brandColor}; text-decoration: none; }
  </style>
</head>
<body style="margin: 0; padding: 20px;">
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="JewelsKart" class="logo">
      <h1 class="header-title">Thank You for Reaching Out! ✨</h1>
    </div>
    <div class="content">
      <div class="thankyou-text">Hello ${name},</div>
      <p style="color: #555; line-height: 1.6;">We've received your message and our support team will get back to you within <strong>24 hours</strong>.</p>
      <div class="message-box">
        <p style="margin: 0; color: #666;">📧 Ticket #JKS-${Date.now().toString().slice(-6)}</p>
        <p style="margin: 5px 0 0; font-size: 12px; color: #888;">Our team is reviewing your query</p>
      </div>
      <div style="text-align: center;">
        <a href="${websiteUrl}/shop" class="button">Continue Shopping →</a>
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} JewelsKart. All rights reserved.</p>
      <p style="font-size: 11px;">Visit us at <a href="${websiteUrl}" class="website-link">www.jewelskart.com</a></p>
    </div>
  </div>
</body>
</html>
`;

// Partner Auto-reply Template
const getPartnerReplyTemplate = (ownerName, businessName) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Partnership Request - JewelsKart</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f4; }
    .container { max-width: 550px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; }
    .header { background: ${brandColor}; padding: 30px 20px; text-align: center; }
    .logo { max-height: 45px; margin-bottom: 10px; }
    .header-title { color: #ffffff; font-size: 22px; margin: 10px 0 0; }
    .content { padding: 30px; }
    .thankyou-text { font-size: 24px; color: ${brandColor}; margin-bottom: 15px; }
    .message-box { background: #f9f9f9; padding: 20px; border-radius: 10px; margin: 20px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #888; }
    .website-link { color: ${brandColor}; text-decoration: none; }
  </style>
</head>
<body style="margin: 0; padding: 20px;">
  <div class="container">
    <div class="header">
      <img src="${logoUrl}" alt="JewelsKart" class="logo">
      <h1 class="header-title">🤝 Thank You for Your Partnership Interest!</h1>
    </div>
    <div class="content">
      <div class="thankyou-text">Dear ${ownerName},</div>
      <p style="color: #555; line-height: 1.6;">Thank you for showing interest in partnering with <strong>JewelsKart</strong>.</p>
      <div class="message-box">
        <p style="margin: 0; color: #666;"><strong>Application Summary:</strong></p>
        <p style="margin: 10px 0 0;">Business: ${businessName}</p>
        <p style="margin: 5px 0 0;">Status: <span style="color: #2e7d32;">Pending Review</span></p>
      </div>
      <p style="color: #555;">Our partnership team will review your application and get back to you within <strong>3-5 business days</strong>.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} JewelsKart. All rights reserved.</p>
      <p style="font-size: 11px;">Visit us at <a href="${websiteUrl}" class="website-link">www.jewelskart.com</a></p>
    </div>
  </div>
</body>
</html>
`;

// ✅ CONTACT FORM ROUTE - with correct sender name
router.post("/contact", async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: "Please fill all required fields" });
    }

    // ✅ Sender name changed to "JewelsKart Website"
    await transporter.sendMail({
      from: `"JewelsKart Website" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `📧 New Contact: ${subject || "Customer Inquiry"} - JewelsKart`,
      html: getProfessionalEmailTemplate('contact', { name, email, phone, subject, message }),
    });

    await transporter.sendMail({
      from: `"JewelsKart" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "✨ We've received your message - JewelsKart",
      html: getCustomerReplyTemplate(name),
    });

    console.log(`✅ Contact form submitted by: ${email}`);
    res.status(200).json({ success: true, message: "Your message has been sent! Our team will respond within 24 hours." });

  } catch (error) {
    console.error("Contact form error:", error);
    res.status(500).json({ success: false, message: "Failed to send message. Please try again." });
  }
});

// ✅ PARTNER FORM ROUTE - with correct sender name
router.post("/partner", async (req, res) => {
  try {
    const { businessName, ownerName, email, phone, businessType, city, products, message } = req.body;

    if (!businessName || !ownerName || !email || !phone) {
      return res.status(400).json({ success: false, message: "Please fill all required fields" });
    }

    // ✅ Sender name changed to "JewelsKart Website"
    await transporter.sendMail({
      from: `"JewelsKart Website" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: `🤝 New Partnership Request: ${businessName} - JewelsKart`,
      html: getProfessionalEmailTemplate('partner', { businessName, ownerName, email, phone, businessType, city, products, message }),
    });

    await transporter.sendMail({
      from: `"JewelsKart" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🤝 Thank you for your partnership interest - JewelsKart",
      html: getPartnerReplyTemplate(ownerName, businessName),
    });

    console.log(`✅ Partnership request from: ${businessName} (${email})`);
    res.status(200).json({ success: true, message: "Partnership application submitted! Our team will contact you soon." });

  } catch (error) {
    console.error("Partner form error:", error);
    res.status(500).json({ success: false, message: "Failed to submit application. Please try again." });
  }
});

module.exports = router;