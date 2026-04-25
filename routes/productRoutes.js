const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const Product = require("../models/Product");
const Category = require("../models/Category");
const mongoose = require("mongoose");

// ============ MULTER CONFIGURATION (Support Images + Videos) ============
const upload = multer({ 
  dest: "uploads/",
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
    files: 15 // Max 15 files total (1 main + 10 gallery + 1 video + extra)
  }
});

// ============ HELPER FUNCTIONS ============

// Get SKU prefix
const getSkuPrefix = (category) => {
  const prefixMap = {
    "Rings": "R",
    "Earrings": "E",
    "Pendants": "P",
    "Necklaces": "N",
    "Bracelets": "B",
    "Sets": "S",
    "Chains": "C"
  };
  return prefixMap[category] || "PR";
};

// Update category product count
const updateCategoryProductCount = async (categoryName) => {
  if (!categoryName) return false;
  
  try {
    const cleanName = categoryName.trim();
    
    const category = await Category.findOne({ 
      name: { $regex: new RegExp(`^${cleanName}$`, 'i') } 
    });
    
    if (!category) {
      console.log(`❌ Category "${cleanName}" not found`);
      return false;
    }
    
    const productCount = await Product.countDocuments({
      category: { $regex: new RegExp(`^${category.name}$`, 'i') },
      status: "Published"
    });
    
    category.productCount = productCount;
    await category.save();
    console.log(`✅ Updated ${category.name}: ${productCount} products`);
    return true;
    
  } catch (error) {
    console.error(`Error updating category count:`, error);
    return false;
  }
};

// ============ CLOUDINARY UPLOAD FUNCTIONS ============

// Upload Image to Cloudinary
const uploadImageToCloudinary = async (filePath, folder, options = {}) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `jewelskart/${folder}`,
      transformation: [
        { quality: "auto", fetch_format: "auto" }
      ],
      ...options
    });
    return {
      url: result.secure_url,
      publicId: result.public_id
    };
  } catch (error) {
    console.error("Cloudinary image upload error:", error);
    return null;
  }
};

// Upload Video to Cloudinary
const uploadVideoToCloudinary = async (filePath, folder, options = {}) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `jewelskart/${folder}`,
      resource_type: "video",
      transformation: [
        { quality: "auto", fetch_format: "auto" }
      ],
      ...options
    });
    return {
      url: result.secure_url,
      publicId: result.public_id,
      duration: result.duration,
      format: result.format,
      thumbnail: result.secure_url.replace('/upload/', '/upload/w_400,h_400,c_fill/')
    };
  } catch (error) {
    console.error("Cloudinary video upload error:", error);
    return null;
  }
};

// ============ SKU GENERATION ============

router.get("/next-sku/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const prefix = getSkuPrefix(category);
    
    const lastProduct = await Product.findOne({
      sku: { $regex: `^${prefix}-`, $options: 'i' }
    }).sort({ sku: -1 });
    
    let nextNumber = 1;
    if (lastProduct) {
      const parts = lastProduct.sku.split('-');
      if (parts.length > 1) {
        const lastNumber = parseInt(parts[1]);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }
    }
    
    const nextSku = `${prefix}-${nextNumber.toString().padStart(3, '0')}`;
    
    res.json({ 
      success: true, 
      sku: nextSku,
      prefix: prefix,
      number: nextNumber
    });
  } catch (error) {
    console.error("Error generating SKU:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ CREATE PRODUCT WITH IMAGES + VIDEO ============
router.post("/add-with-images", upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 10 },
  { name: "productVideo", maxCount: 1 }
]), async (req, res) => {
  try {
    console.log("📝 Adding product with Cloudinary images and video:", req.body.name);
    
    const productData = JSON.parse(req.body.productData);
    
    const existingProduct = await Product.findOne({ sku: productData.sku });
    if (existingProduct) {
      return res.status(400).json({ 
        success: false, 
        message: `SKU ${productData.sku} already exists` 
      });
    }
    
    const categoryExists = await Category.findOne({ 
      name: { $regex: new RegExp(`^${productData.category}$`, 'i') } 
    });
    
    if (!categoryExists) {
      return res.status(400).json({ 
        success: false, 
        message: `Category "${productData.category}" does not exist.` 
      });
    }
    
    // Upload main image
    let mainImage = null;
    if (req.files && req.files.mainImage && req.files.mainImage[0]) {
      mainImage = await uploadImageToCloudinary(
        req.files.mainImage[0].path,
        "products/main"
      );
    }
    
    // Upload gallery images (max 10)
    let galleryImages = [];
    if (req.files && req.files.galleryImages) {
      for (const file of req.files.galleryImages) {
        const uploadedImage = await uploadImageToCloudinary(
          file.path,
          "products/gallery"
        );
        if (uploadedImage) {
          galleryImages.push({
            url: uploadedImage.url,
            publicId: uploadedImage.publicId,
            alt: productData.name || ""
          });
        }
      }
    }
    
    // Upload product video
    let productVideo = null;
    if (req.files && req.files.productVideo && req.files.productVideo[0]) {
      productVideo = await uploadVideoToCloudinary(
        req.files.productVideo[0].path,
        "products/videos"
      );
    }
    
    // Create product
    const product = new Product({
      ...productData,
      mainImage: mainImage || { url: "", publicId: "" },
      galleryImages: galleryImages,
      productVideo: productVideo,
      images: mainImage ? [mainImage.url] : []
    });
    
    await product.save();
    console.log("✅ Product saved with", galleryImages.length, "images and", productVideo ? "video" : "no video");
    
    await updateCategoryProductCount(productData.category);
    
    res.status(201).json({
      success: true,
      product: product,
      message: `Product added with ${galleryImages.length} images and ${productVideo ? 'video' : 'no video'}`
    });
    
  } catch (error) {
    console.error("❌ Error adding product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ UPDATE PRODUCT WITH IMAGES + VIDEO ============
router.put("/:id/with-images", upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 10 },
  { name: "productVideo", maxCount: 1 }
]), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    
    const oldProduct = await Product.findById(id);
    if (!oldProduct) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    
    const productData = JSON.parse(req.body.productData);
    
    // Update main image if new one provided
    let mainImage = oldProduct.mainImage;
    if (req.files && req.files.mainImage && req.files.mainImage[0]) {
      if (oldProduct.mainImage && oldProduct.mainImage.publicId) {
        await cloudinary.uploader.destroy(oldProduct.mainImage.publicId);
      }
      const uploadedImage = await uploadImageToCloudinary(
        req.files.mainImage[0].path,
        "products/main"
      );
      if (uploadedImage) {
        mainImage = uploadedImage;
      }
    }
    
    // Add new gallery images
    let galleryImages = [...(oldProduct.galleryImages || [])];
    if (req.files && req.files.galleryImages) {
      for (const file of req.files.galleryImages) {
        const uploadedImage = await uploadImageToCloudinary(
          file.path,
          "products/gallery"
        );
        if (uploadedImage) {
          galleryImages.push({
            url: uploadedImage.url,
            publicId: uploadedImage.publicId,
            alt: productData.name || ""
          });
        }
      }
    }
    
    // Update video if new one provided
    let productVideo = oldProduct.productVideo;
    if (req.files && req.files.productVideo && req.files.productVideo[0]) {
      if (oldProduct.productVideo && oldProduct.productVideo.publicId) {
        await cloudinary.uploader.destroy(oldProduct.productVideo.publicId, { resource_type: "video" });
      }
      productVideo = await uploadVideoToCloudinary(
        req.files.productVideo[0].path,
        "products/videos"
      );
    }
    
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        ...productData,
        mainImage: mainImage,
        galleryImages: galleryImages,
        productVideo: productVideo,
        images: mainImage ? [mainImage.url] : oldProduct.images
      },
      { new: true, runValidators: true }
    );
    
    if (oldProduct.category !== updatedProduct.category) {
      await updateCategoryProductCount(oldProduct.category);
      await updateCategoryProductCount(updatedProduct.category);
    }
    
    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct
    });
    
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ DELETE GALLERY IMAGE ============
router.delete("/:id/gallery-image/:publicId", async (req, res) => {
  try {
    const { id, publicId } = req.params;
    
    await cloudinary.uploader.destroy(publicId);
    
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    
    product.galleryImages = product.galleryImages.filter(img => img.publicId !== publicId);
    await product.save();
    
    res.json({ success: true, message: "Gallery image deleted successfully" });
  } catch (error) {
    console.error("Error deleting gallery image:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ DELETE PRODUCT VIDEO ============
router.delete("/:id/product-video", async (req, res) => {
  try {
    const { id } = req.params;
    
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    
    if (product.productVideo && product.productVideo.publicId) {
      await cloudinary.uploader.destroy(product.productVideo.publicId, { resource_type: "video" });
      product.productVideo = null;
      await product.save();
    }
    
    res.json({ success: true, message: "Product video deleted successfully" });
  } catch (error) {
    console.error("Error deleting product video:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ CREATE (Existing - Keep as is) ============
router.post("/add", async (req, res) => {
  try {
    console.log("📝 Adding product:", req.body.name);
    
    const existingProduct = await Product.findOne({ sku: req.body.sku });
    if (existingProduct) {
      return res.status(400).json({ 
        success: false, 
        message: `SKU ${req.body.sku} already exists` 
      });
    }
    
    const categoryExists = await Category.findOne({ 
      name: { $regex: new RegExp(`^${req.body.category}$`, 'i') } 
    });
    
    if (!categoryExists) {
      return res.status(400).json({ 
        success: false, 
        message: `Category "${req.body.category}" does not exist.` 
      });
    }
    
    const product = new Product(req.body);
    await product.save();
    console.log("✅ Product saved:", product._id);
    
    await updateCategoryProductCount(req.body.category);
    
    res.status(201).json({
      success: true,
      product: product,
      message: "Product added successfully"
    });
  } catch (error) {
    console.error("❌ Error adding product:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ READ ROUTES ============
router.get("/", async (req, res) => {
  try {
    const { category, status, search, limit = 100 } = req.query;
    
    let query = {};
    if (category) query.category = { $regex: new RegExp(`^${category}$`, 'i') };
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }
    
    const products = await Product.find(query).limit(parseInt(limit));
    const sortedProducts = products.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    res.status(200).json({
      success: true,
      count: sortedProducts.length,
      products: sortedProducts
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID format" });
    }
    
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    
    res.status(200).json({ success: true, product });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ UPDATE (Existing) ============
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const oldProduct = await Product.findById(id);
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    
    const product = await Product.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    
    if (oldProduct && oldProduct.category !== product.category) {
      await updateCategoryProductCount(oldProduct.category);
      await updateCategoryProductCount(product.category);
    }
    
    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product
    });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ STOCK UPDATE ============
router.patch("/:id/stock", async (req, res) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;
    
    if (stock === undefined || stock < 0) {
      return res.status(400).json({ success: false, message: "Valid stock value is required" });
    }
    
    const product = await Product.findByIdAndUpdate(
      id,
      { stock },
      { new: true }
    );
    
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    
    res.status(200).json({
      success: true,
      message: "Stock updated successfully",
      product
    });
  } catch (error) {
    console.error("Error updating stock:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ STATUS UPDATE ============
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['Published', 'Draft', 'Archived'].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }
    
    const product = await Product.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    
    await updateCategoryProductCount(product.category);
    
    res.status(200).json({
      success: true,
      message: "Status updated successfully",
      product
    });
  } catch (error) {
    console.error("Error updating status:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ DELETE ============
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    
    // Delete Cloudinary images
    if (product.mainImage && product.mainImage.publicId) {
      await cloudinary.uploader.destroy(product.mainImage.publicId);
    }
    
    if (product.galleryImages && product.galleryImages.length > 0) {
      for (const img of product.galleryImages) {
        if (img.publicId) {
          await cloudinary.uploader.destroy(img.publicId);
        }
      }
    }
    
    // Delete product video
    if (product.productVideo && product.productVideo.publicId) {
      await cloudinary.uploader.destroy(product.productVideo.publicId, { resource_type: "video" });
    }
    
    const categoryName = product.category;
    await Product.findByIdAndDelete(id);
    
    await updateCategoryProductCount(categoryName);
    
    res.status(200).json({
      success: true,
      message: "Product deleted successfully (including images and video)"
    });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ DELETE ALL ============
router.delete("/delete/all", async (req, res) => {
  try {
    const products = await Product.find({});
    
    for (const product of products) {
      if (product.mainImage && product.mainImage.publicId) {
        await cloudinary.uploader.destroy(product.mainImage.publicId);
      }
      if (product.galleryImages && product.galleryImages.length > 0) {
        for (const img of product.galleryImages) {
          if (img.publicId) {
            await cloudinary.uploader.destroy(img.publicId);
          }
        }
      }
      if (product.productVideo && product.productVideo.publicId) {
        await cloudinary.uploader.destroy(product.productVideo.publicId, { resource_type: "video" });
      }
    }
    
    const result = await Product.deleteMany({});
    
    const categories = await Category.find();
    for (const category of categories) {
      await updateCategoryProductCount(category.name);
    }
    
    res.status(200).json({
      success: true,
      message: `${result.deletedCount} products deleted successfully`
    });
  } catch (error) {
    console.error("Error deleting all products:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;