const mongoose = require('mongoose');

const reviewImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  publicId: { type: String, default: '' },
  alt: { type: String }
});

const reviewSchema = new mongoose.Schema({
  productId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Product',
    required: true 
  },
  productName: { type: String, required: true },
  productImage: { type: String },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String },
  comment: { type: String, required: true },
  images: [reviewImageSchema],
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  isFeatured: { type: Boolean, default: false },
  verifiedPurchase: { type: Boolean, default: false },
  helpful: { type: Number, default: 0 },
  adminResponse: {
    message: { type: String },
    respondedAt: { type: Date }
  },
  createdAt: { type: Date, default: Date.now },
  approvedAt: { type: Date }
});

// Index for faster queries
reviewSchema.index({ productId: 1, status: 1, createdAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });
reviewSchema.index({ customerEmail: 1 });

module.exports = mongoose.model('Review', reviewSchema);