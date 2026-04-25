const mongoose = require('mongoose');

// Hero Slide Schema
const heroSlideSchema = new mongoose.Schema({
  bgImage: { type: String, required: true },
  leftModelImage: { type: String, required: true },
  rightModelImage: { type: String, required: true },
  brandText: { type: String, required: true },
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  buttonLink: { type: String, default: '/shop' },
  displayOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Banner Category Schema
const bannerCategorySchema = new mongoose.Schema({
  category: { 
    type: String, 
    required: true,
    enum: ['pendants', 'rings', 'bracelets', 'earrings']
  },
  imageUrl: { type: String, required: true },
  title: { type: String, required: true },
  buttonText: { type: String, required: true },
  buttonLink: { type: String, required: true },
  displayOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Offer Banner Schema
const offerBannerSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  brandText: { type: String, default: 'JEWELSKART' },
  title: { type: String, required: true },
  subtitle: { type: String, default: 'EXCLUSIVE OFFER' },
  buttonText: { type: String, required: true },
  footerText: { type: String, default: 'WWW.JEWELSKART.COM' },
  buttonLink: { type: String, default: '/shop' },
  displayOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// About Section Schema
const aboutSectionSchema = new mongoose.Schema({
  badgeText: { type: String, default: 'Jewels As Unique As You' },
  title: { type: String, default: 'Commitment, Forever, In Every Sparkling Jewel' },
  description: { type: String, default: '' },
  stats: {
    branches: { type: Number, default: 20 },
    designs: { type: Number, default: 200 },
    clients: { type: Number, default: 3 }
  },
  statsLabels: {
    branches: { type: String, default: 'Branches' },
    designs: { type: String, default: 'Designs' },
    clients: { type: String, default: 'Clients' }
  },
  buttonText: { type: String, default: 'Know More' },
  buttonLink: { type: String, default: '/about' },
  bigImageUrl: { type: String, required: true },
  smallImageUrl: { type: String, required: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Partner Section Schema
const partnerSectionSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  badgeText: { type: String, default: 'Become a Partner' },
  title: { type: String, default: 'Partner With Jewelskart' },
  description: { type: String, default: '' },
  benefits: { type: [String], default: ['Reach a wider audience', 'Increase brand visibility', 'Trusted platform'] },
  buttonText: { type: String, default: 'Apply Now' },
  buttonLink: { type: String, default: '/contact?partner=true' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Promo Banner Schema
const promoSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  headingLine1: { type: String, default: 'Our Signature Brand' },
  headingLine2: { type: String, default: 'JEWELSKART' },
  description: { type: String, default: '' },
  buttonText: { type: String, default: 'Shop JEWELSKART' },
  buttonLink: { type: String, default: '/shop?brand=jewelskart' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Jewellery Section Schema (Stylish Design)
const jewellerySectionSchema = new mongoose.Schema({
  leftImageUrl: { type: String, required: true },
  badgeText: { type: String, default: 'Handcrafted Perfection' },
  title: { type: String, default: 'Stylish Design Collections' },
  description: { type: String, default: '' },
  buttonText: { type: String, default: 'SHOP NOW' },
  buttonLink: { type: String, default: '/shop' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Testimonial Section Schema
const testimonialSectionSchema = new mongoose.Schema({
  rightImageUrl: { type: String, required: true },
  badgeText: { type: String, default: 'CUSTOMER VOICES' },
  title: { type: String, default: 'Our Customers Speak For Us' },
  testimonials: [{
    name: String,
    location: String,
    text: String,
    avatar: String
  }],
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Export all models
module.exports = {
  HeroSlide: mongoose.model('HeroSlide', heroSlideSchema),
  BannerCategory: mongoose.model('BannerCategory', bannerCategorySchema),
  OfferBanner: mongoose.model('OfferBanner', offerBannerSchema),
  AboutSection: mongoose.model('AboutSection', aboutSectionSchema),
  PartnerSection: mongoose.model('PartnerSection', partnerSectionSchema),
  PromoBanner: mongoose.model('PromoBanner', promoSchema),
  JewellerySection: mongoose.model('JewellerySection', jewellerySectionSchema),
  TestimonialSection: mongoose.model('TestimonialSection', testimonialSectionSchema)
};