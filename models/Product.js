const mongoose = require("mongoose");

// Gold Details Schema
const goldDetailsSchema = new mongoose.Schema({
  weight: { type: Number, default: 0 },
  purity: { type: String, enum: ['9K', '10K', '14K', '18K', '21K', '22K', '23K', '24K'], default: '22K' },
  makingCharge: { type: Number, default: 0 }
});

// Specifications Schema
const specificationsSchema = new mongoose.Schema({
  material: { type: String, default: "Gold" },
  finish: { type: String, default: "High Polish" },
  hallmark: { type: String, default: "BIS Hallmarked" },
  certification: { type: String, default: "IGI Certified" },
  ringSizes: [{ type: String }],
  gender: { type: String, default: "Women" },
  occasion: { type: String, default: "" },
  stoneType: { type: String, default: "none" },
  stoneWeight: { type: Number, default: 0 },
  diamond: { type: String, default: "" },
  diamondWeight: { type: String, default: "" },
  semiPreciousStone: { type: String, default: "" },
  semiPreciousWeight: { type: String, default: "" },
  womenDiamond: { type: String, default: "" },
  womenDiamondWeight: { type: String, default: "" },
  womenSemiPreciousStone: { type: String, default: "" },
  womenSemiPreciousWeight: { type: String, default: "" },
  menDiamond: { type: String, default: "" },
  menDiamondWeight: { type: String, default: "" },
  menSemiPreciousStone: { type: String, default: "" },
  menSemiPreciousWeight: { type: String, default: "" },
  warranty: { type: String, default: "" }
}, { strict: false });

// Care Instructions Schema
const careInstructionsSchema = new mongoose.Schema({
  instructions: [{ type: String }]
});

// Additional Info Schema
const additionalInfoSchema = new mongoose.Schema({
  delivery: { type: String, default: "3-5 Days" },
  returns: { type: String, default: "7 Days Return Policy" },
  payment: { type: String, default: "Secure Payment Options Available" }
});

// Reviews Schema - ENHANCED with distribution
const reviewsSchema = new mongoose.Schema({
  rating: { type: Number, default: 0 },
  count: { type: Number, default: 0 },
  distribution: { type: Object, default: {} }
});

// ========== CLOUDINARY IMAGE SCHEMAS ==========

// Single Cloudinary Image Schema (for mainImage and thumbnail)
const cloudinaryImageSchema = new mongoose.Schema({
  url: { type: String, default: "" },
  publicId: { type: String, default: "" },
  alt: { type: String, default: "" },
  width: { type: Number, default: 0 },
  height: { type: Number, default: 0 },
  format: { type: String, default: "" },
  bytes: { type: Number, default: 0 }
}, { _id: false });

// Single Cloudinary Video Schema
const cloudinaryVideoSchema = new mongoose.Schema({
  url: { type: String, default: "" },
  publicId: { type: String, default: "" },
  duration: { type: Number, default: 0 },
  format: { type: String, default: "" },
  thumbnail: { type: String, default: "" }
});

// Gallery Image Schema (for multiple images)
const galleryImageSchema = new mongoose.Schema({
  url: { type: String, default: "" },
  publicId: { type: String, default: "" },
  alt: { type: String, default: "" }
}, { _id: false });

// Couple Ring Details Schema
const coupleRingDetailsSchema = new mongoose.Schema({
  womenPrice: { type: Number, default: 0 },
  womenWeight: { type: Number, default: 0 },
  menPrice: { type: Number, default: 0 },
  menWeight: { type: Number, default: 0 },
  womenDiamond: { type: String, default: "" },
  womenDiamondWeight: { type: String, default: "" },
  womenSemiPreciousStone: { type: String, default: "" },
  womenSemiPreciousWeight: { type: String, default: "" },
  menDiamond: { type: String, default: "" },
  menDiamondWeight: { type: String, default: "" },
  menSemiPreciousStone: { type: String, default: "" },
  menSemiPreciousWeight: { type: String, default: "" },
}, { _id: false, strict: false });

// Main Product Schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  purchasePrice: { type: Number, default: 0 },
  category: { type: String, default: "", required: true },
  categoryName: { type: String, default: "" },
  brand: { type: String, default: 'JewelsKart Original' },
  stock: { type: Number, default: 0 },
  isAvailableForOrder: { type: Boolean, default: true },
  description: { type: String, default: '' },

  // ========== COUPLE RING DETAILS ==========
  coupleRing: { type: coupleRingDetailsSchema, default: null },

  // ========== EXISTING IMAGES FIELD (Keep for backward compatibility) ==========
  images: { type: [String], default: [] },

  // ========== NEW CLOUDINARY FIELDS ==========

  // Main product image (Cloudinary)
  mainImage: { type: cloudinaryImageSchema, default: () => ({}) },

  // Product video
  productVideo: { type: cloudinaryVideoSchema, default: null },

  // Gallery images (multiple Cloudinary images)
  galleryImages: { type: [galleryImageSchema], default: [] },

  // Thumbnail (auto-generated or custom)
  thumbnail: { type: cloudinaryImageSchema, default: () => ({}) },

  // For future use - image optimization settings
  imageOptimization: {
    quality: { type: String, default: "auto" },
    format: { type: String, default: "auto" },
    width: { type: Number, default: 800 },
    height: { type: Number, default: 800 }
  },

  sku: { type: String, required: true, unique: true },
  tags: { type: [String], default: [] },
  status: { type: String, enum: ['Published', 'Draft', 'Archived'], default: 'Draft' },
  featured: { type: Boolean, default: false },
  bestSeller: { type: Boolean, default: false },
  gst: { type: Number, default: 3 },
  ringSizes: [{ type: String }],
  sortOrder: { type: Number, default: 999999 },

  goldDetails: { type: goldDetailsSchema, default: () => ({}) },
  specifications: { type: specificationsSchema, default: () => ({}) },
  careInstructions: { type: careInstructionsSchema, default: () => ({}) },
  additionalInfo: { type: additionalInfoSchema, default: () => ({}) },
  reviews: { type: reviewsSchema, default: () => ({ rating: 0, count: 0, distribution: {} }) }

}, { timestamps: true });

// ========== VIRTUAL FIELDS (For Cloudinary optimized URLs) ==========

// Get optimized main image URL (with transformations)
productSchema.virtual('mainImageOptimized').get(function () {
  if (!this.mainImage || !this.mainImage.url) return null;
  return this.mainImage.url.replace('/upload/', '/upload/w_800,h_800,c_limit,q_auto,f_auto/');
});

// Get thumbnail optimized URL
productSchema.virtual('thumbnailOptimized').get(function () {
  if (!this.thumbnail || !this.thumbnail.url) {
    if (this.mainImage && this.mainImage.url) {
      return this.mainImage.url.replace('/upload/', '/upload/w_200,h_200,c_fill,q_auto,f_auto/');
    }
    return null;
  }
  return this.thumbnail.url.replace('/upload/', '/upload/w_200,h_200,c_fill,q_auto,f_auto/');
});

// Get all gallery images with optimization
productSchema.virtual('galleryOptimized').get(function () {
  if (!this.galleryImages || this.galleryImages.length === 0) return [];

  return this.galleryImages.map(img => ({
    original: img.url,
    thumbnail: img.url.replace('/upload/', '/upload/w_100,h_100,c_fill,q_auto,f_auto/'),
    medium: img.url.replace('/upload/', '/upload/w_500,h_500,c_limit,q_auto,f_auto/'),
    large: img.url.replace('/upload/', '/upload/w_1200,h_1200,c_limit,q_auto,f_auto/'),
    alt: img.alt
  }));
});

// ========== IMPORTANT: UPDATE REVIEW STATS METHOD ==========
// Add this method to your productSchema
productSchema.methods.updateReviewStats = async function () {
  const Review = mongoose.model('Review');
  const stats = await Review.aggregate([
    { $match: { productId: this._id, status: 'approved' } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }
    }
  ]);

  if (stats[0]) {
    this.reviews = {
      rating: Math.round(stats[0].averageRating * 10) / 10,
      count: stats[0].totalReviews
    };
  } else {
    this.reviews = { rating: 0, count: 0 };
  }
  await this.save();
};

// Helper method to get image for different sizes
productSchema.methods.getImageForSize = function (size = 'medium') {
  const sizes = {
    small: 'w_200,h_200,c_fill',
    medium: 'w_500,h_500,c_limit',
    large: 'w_1200,h_1200,c_limit',
    thumbnail: 'w_100,h_100,c_fill'
  };

  const transformation = sizes[size] || sizes.medium;

  if (this.mainImage && this.mainImage.url) {
    return this.mainImage.url.replace('/upload/', `/upload/${transformation},q_auto,f_auto/`);
  }
  return null;
};

// Indexes
productSchema.index({ name: 'text', sku: 'text', brand: 'text' });
productSchema.index({ category: 1, sortOrder: 1, createdAt: -1 });
productSchema.index({ sortOrder: 1 });
productSchema.index({ status: 1 });
productSchema.index({ 'mainImage.publicId': 1 });
productSchema.index({ 'reviews.rating': -1 });
productSchema.index({ 'reviews.count': -1 });

module.exports = mongoose.model("Product", productSchema);