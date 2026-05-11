const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Product = require('../models/Product');

// ========== PUBLIC ROUTES ==========

// Submit new review
router.post('/', async (req, res) => {
  try {
    const { productId, name, email, rating, comment, images, title } = req.body;
    
    console.log('📝 Received review submission:', { productId, name, email, rating });
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Check for duplicate review
    const existingReview = await Review.findOne({
      productId,
      customerEmail: email,
      status: { $in: ['pending', 'approved'] }
    });
    
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a review for this product'
      });
    }
    
    // Create review
    const review = new Review({
      productId,
      productName: product.name,
      productImage: product.mainImage?.url || product.images?.[0],
      customerName: name,
      customerEmail: email,
      rating,
      comment,
      title: title || '',
      images: images || [],
      status: 'pending'
    });
    
    await review.save();
    
    console.log('✅ Review saved successfully:', review._id);
    
    res.status(201).json({ 
      success: true, 
      message: 'Review submitted successfully! Awaiting admin approval.',
      review 
    });
  } catch (error) {
    console.error('❌ Error submitting review:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get approved reviews for a product
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { limit = 10 } = req.query;
    
    const reviews = await Review.find({ 
      productId, 
      status: 'approved' 
    })
    .sort({ isFeatured: -1, helpful: -1, createdAt: -1 })
    .limit(parseInt(limit));
    
    // Get product review stats
    const product = await Product.findById(productId);
    const stats = product?.reviews || { rating: 0, count: 0 };
    
    res.json({
      success: true,
      reviews,
      stats
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get top reviews for homepage
router.get('/top', async (req, res) => {
  try {
    const { limit = 3 } = req.query;
    
    const reviews = await Review.find({ status: 'approved' })
      .sort({ isFeatured: -1, helpful: -1, createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json({ success: true, reviews });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all testimonials
router.get('/testimonials', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const reviews = await Review.find({ status: 'approved' })
      .sort({ isFeatured: -1, createdAt: -1 })
      .limit(parseInt(limit));
    
    const stats = await Review.aggregate([
      { $match: { status: 'approved' } },
      { $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 }
      }}
    ]);
    
    res.json({
      success: true,
      reviews,
      stats: stats[0] || { averageRating: 0, totalReviews: 0 }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark review as helpful
router.put('/:id/helpful', async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { $inc: { helpful: 1 } },
      { new: true }
    );
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    res.json({ success: true, helpful: review.helpful });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== ADMIN ROUTES ==========

// Get all reviews (admin)
router.get('/admin/all', async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    
    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
        { productName: { $regex: search, $options: 'i' } },
        { comment: { $regex: search, $options: 'i' } }
      ];
    }
    
    const reviews = await Review.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
    
    const total = await Review.countDocuments(query);
    
    // Get status counts
    const statusCounts = await Review.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    res.json({
      success: true,
      reviews,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
      statusCounts: Object.fromEntries(statusCounts.map(s => [s._id, s.count]))
    });
  } catch (error) {
    console.error('Error fetching admin reviews:', error);
    res.status(500).json({ error: error.message });
  }
});

// Approve review
router.put('/admin/:id/approve', async (req, res) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'approved',
        approvedAt: new Date()
      },
      { new: true }
    );
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    // Update product review stats
    const product = await Product.findById(review.productId);
    if (product) {
      // Update product reviews stats
      const approvedReviews = await Review.find({ 
        productId: review.productId, 
        status: 'approved' 
      });
      
      const totalRating = approvedReviews.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = approvedReviews.length > 0 ? totalRating / approvedReviews.length : 0;
      
      product.reviews = {
        rating: Math.round(avgRating * 10) / 10,
        count: approvedReviews.length
      };
      await product.save();
    }
    
    res.json({ success: true, review });
  } catch (error) {
    console.error('Error approving review:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reject review
router.put('/admin/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { 
        status: 'rejected',
        adminResponse: {
          message: reason || 'Review rejected by admin',
          respondedAt: new Date()
        }
      },
      { new: true }
    );
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    res.json({ success: true, review });
  } catch (error) {
    console.error('Error rejecting review:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle featured review
router.put('/admin/:id/feature', async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    review.isFeatured = !review.isFeatured;
    await review.save();
    
    res.json({ success: true, review });
  } catch (error) {
    console.error('Error toggling featured:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete review
router.delete('/admin/:id', async (req, res) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }
    
    // Update product review stats
    const product = await Product.findById(review.productId);
    if (product) {
      const approvedReviews = await Review.find({ 
        productId: review.productId, 
        status: 'approved' 
      });
      
      const totalRating = approvedReviews.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = approvedReviews.length > 0 ? totalRating / approvedReviews.length : 0;
      
      product.reviews = {
        rating: Math.round(avgRating * 10) / 10,
        count: approvedReviews.length
      };
      await product.save();
    }
    
    res.json({ success: true, message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get review statistics
router.get('/admin/stats', async (req, res) => {
  try {
    const stats = await Review.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          averageRating: { $avg: '$rating' },
          totalWithImages: { $sum: { $cond: [{ $gt: [{ $size: '$images' }, 0] }, 1, 0] } }
        }
      }
    ]);
    
    res.json({
      success: true,
      stats: stats[0] || { 
        total: 0, 
        pending: 0, 
        approved: 0, 
        rejected: 0, 
        averageRating: 0,
        totalWithImages: 0
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;