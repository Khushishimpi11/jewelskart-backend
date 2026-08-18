const express = require("express");
const router = express.Router();
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const Product = require("../models/Product");
const Category = require("../models/Category");
const mongoose = require("mongoose");

// ============ MULTER CONFIGURATION ============
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 15
  }
});

// ============ HELPER FUNCTIONS ============

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

// ============ TOTAL PRODUCT COUNT (Unfiltered) ============
router.get("/count", async (req, res) => {
  try {
    const totalCount = await Product.countDocuments({});
    const publishedCount = await Product.countDocuments({ status: "Published" });
    const draftCount = await Product.countDocuments({ status: "Draft" });
    const archivedCount = await Product.countDocuments({ status: "Archived" });

    res.status(200).json({
      success: true,
      total: totalCount,
      published: publishedCount,
      draft: draftCount,
      archived: archivedCount,
    });
  } catch (error) {
    console.error("Error fetching product count:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ CREATE PRODUCT ============
router.post("/add-with-images", upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "galleryImages", maxCount: 10 },
  { name: "productVideo", maxCount: 1 }
]), async (req, res) => {
  try {
    console.log("📝 Adding product with Cloudinary images and video");

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

    let mainImage = null;
    if (req.files && req.files.mainImage && req.files.mainImage[0]) {
      mainImage = await uploadImageToCloudinary(
        req.files.mainImage[0].path,
        "products/main"
      );
    }

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

    let productVideo = null;
    if (req.files && req.files.productVideo && req.files.productVideo[0]) {
      productVideo = await uploadVideoToCloudinary(
        req.files.productVideo[0].path,
        "products/videos"
      );
    }

    // Build final images array
    let finalImages = [];
    if (mainImage && mainImage.url) {
      finalImages.push(mainImage.url);
    }
    galleryImages.forEach(img => {
      if (img.url) {
        finalImages.push(img.url);
      }
    });

    const product = new Product({
      ...productData,
      mainImage: mainImage || { url: "", publicId: "" },
      galleryImages: galleryImages,
      productVideo: productVideo,
      images: finalImages
    });

    if (productData.coupleRing) {
      product.coupleRing = {
        womenPrice: Number(productData.coupleRing.womenPrice) || 0,
        womenWeight: Number(productData.coupleRing.womenWeight) || 0,
        menPrice: Number(productData.coupleRing.menPrice) || 0,
        menWeight: Number(productData.coupleRing.menWeight) || 0,
      };
      product.markModified('coupleRing');
    }

    await product.save();
    console.log("✅ Product saved with", galleryImages.length, "images");

    await updateCategoryProductCount(productData.category);

    res.status(201).json({
      success: true,
      product: product,
      message: `Product added with ${galleryImages.length} images`
    });

  } catch (error) {
    console.error("❌ Error adding product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============ UPDATE PRODUCT ============
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

    // Delete removed images from Cloudinary (by publicId)
    if (productData.removedImagePublicIds && productData.removedImagePublicIds.length > 0) {
      console.log(`🗑️ Deleting ${productData.removedImagePublicIds.length} removed images from Cloudinary...`);
      for (const publicId of productData.removedImagePublicIds) {
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log(`✅ Deleted image from Cloudinary: ${publicId}`);
        } catch (err) {
          console.error(`❌ Failed to delete image ${publicId}:`, err);
        }
      }
    }

    // ── Main Image ──
    // Start from exactly what the frontend says is kept (null means user deleted it)
    let mainImage = productData.existingMainImage || null;

    if (req.files && req.files.mainImage && req.files.mainImage[0]) {
      // User uploaded a brand-new main image — delete the old one from Cloudinary first
      if (oldProduct.mainImage && oldProduct.mainImage.publicId) {
        try {
          await cloudinary.uploader.destroy(oldProduct.mainImage.publicId);
          console.log(`✅ Deleted old main image from Cloudinary: ${oldProduct.mainImage.publicId}`);
        } catch (err) {
          console.error("Failed to delete old main image:", err);
        }
      }
      const uploadedImage = await uploadImageToCloudinary(
        req.files.mainImage[0].path,
        "products/main"
      );
      if (uploadedImage) {
        mainImage = uploadedImage;
        console.log(`✅ Uploaded new main image: ${uploadedImage.publicId}`);
      }
    } else if (!productData.existingMainImage && oldProduct.mainImage && oldProduct.mainImage.publicId) {
      // Main image was removed on the frontend and no new one was uploaded — delete from Cloudinary
      try {
        await cloudinary.uploader.destroy(oldProduct.mainImage.publicId);
        console.log(`✅ Deleted removed main image from Cloudinary: ${oldProduct.mainImage.publicId}`);
      } catch (err) {
        console.error("Failed to delete removed main image from Cloudinary:", err);
      }
    }

    // ── Gallery Images ──
    // Start from EXACTLY the kept gallery images sent by the frontend (already filtered, no merging)
    let galleryImages = Array.isArray(productData.existingGalleryImages)
      ? productData.existingGalleryImages
      : [];
    console.log(`📸 Kept gallery images from frontend: ${galleryImages.length}`);

    // Append any newly uploaded gallery image files
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
            alt: productData.name || oldProduct.name || ""
          });
          console.log(`📸 Added new gallery image: ${uploadedImage.publicId}`);
        }
      }
    }

    // Build final flat images array (main + gallery)
    let finalImages = [];
    if (mainImage && mainImage.url) {
      finalImages.push(mainImage.url);
    }
    galleryImages.forEach(img => {
      if (img.url) finalImages.push(img.url);
    });
    console.log(`📸 Final images array: ${finalImages.length} images`);

    // Clean up frontend-only fields before saving to DB
    delete productData.existingMainImage;
    delete productData.existingGalleryImages;
    delete productData.removedImagePublicIds;
    delete productData.keptImages;

    // Update video
    let productVideo = oldProduct.productVideo;
    if (req.files && req.files.productVideo && req.files.productVideo[0]) {
      if (oldProduct.productVideo && oldProduct.productVideo.publicId) {
        try {
          await cloudinary.uploader.destroy(oldProduct.productVideo.publicId, { resource_type: "video" });
          console.log(`✅ Deleted old video: ${oldProduct.productVideo.publicId}`);
        } catch (err) {
          console.error("Failed to delete old video:", err);
        }
      }
      productVideo = await uploadVideoToCloudinary(
        req.files.productVideo[0].path,
        "products/videos"
      );
      if (productVideo) {
        console.log(`✅ Uploaded new video: ${productVideo.publicId}`);
      }
    }

    // Update product with REPLACED images array
    const updatePayload = {
      ...productData,
      mainImage: mainImage,
      galleryImages: galleryImages,
      productVideo: productVideo,
      images: finalImages,
    };

    if (productData.coupleRing) {
      updatePayload.coupleRing = {
        womenPrice: Number(productData.coupleRing.womenPrice) || 0,
        womenWeight: Number(productData.coupleRing.womenWeight) || 0,
        menPrice: Number(productData.coupleRing.menPrice) || 0,
        menWeight: Number(productData.coupleRing.menWeight) || 0,
      };
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true, runValidators: true }
    );

    console.log(`✅ Product updated with ${galleryImages.length} gallery images and coupleRing:`, updatedProduct?.coupleRing);

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
    console.error("❌ Error updating product:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ DELETE - FIXED ============
// ============ DELETE - COMPLETELY FIXED ============
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔍 DELETE request received for ID: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log(`❌ Invalid product ID: ${id}`);
      return res.status(400).json({
        success: false,
        message: "Invalid product ID format"
      });
    }

    // First find the product
    const product = await Product.findById(id);
    if (!product) {
      console.log(`❌ Product not found with ID: ${id}`);
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    console.log(`🗑️ Found product: ${product.name} (${product.sku})`);
    console.log(`📸 Main Image: ${product.mainImage?.publicId || 'None'}`);
    console.log(`📸 Gallery Images: ${product.galleryImages?.length || 0}`);
    console.log(`🎬 Video: ${product.productVideo?.publicId || 'None'}`);

    // ========== DELETE FROM DATABASE FIRST ==========
    // This ensures product is removed even if Cloudinary fails
    const categoryName = product.category;
    const deleteResult = await Product.findByIdAndDelete(id);

    if (!deleteResult) {
      console.log(`❌ Failed to delete product from database`);
      return res.status(500).json({
        success: false,
        message: "Failed to delete product from database"
      });
    }

    console.log(`✅ Product deleted from database: ${id}`);

    // ========== DELETE CLOUDINARY IMAGES ==========
    let deletedCount = 0;
    let errors = [];

    // Delete main image
    if (product.mainImage && product.mainImage.publicId && product.mainImage.publicId !== '') {
      try {
        console.log(`🗑️ Deleting main image: ${product.mainImage.publicId}`);
        const result = await cloudinary.uploader.destroy(product.mainImage.publicId);
        if (result.result === 'ok') {
          console.log(`✅ Deleted main image: ${product.mainImage.publicId}`);
          deletedCount++;
        } else {
          console.log(`⚠️ Cloudinary returned: ${result.result} for main image`);
        }
      } catch (err) {
        console.error(`❌ Failed to delete main image:`, err);
        errors.push(`Main image: ${err.message}`);
      }
    } else {
      console.log(`ℹ️ No main image to delete`);
    }

    // Delete gallery images
    if (product.galleryImages && product.galleryImages.length > 0) {
      console.log(`🗑️ Deleting ${product.galleryImages.length} gallery images...`);
      for (const img of product.galleryImages) {
        if (img.publicId && img.publicId !== '') {
          try {
            const result = await cloudinary.uploader.destroy(img.publicId);
            if (result.result === 'ok') {
              console.log(`✅ Deleted gallery image: ${img.publicId}`);
              deletedCount++;
            }
          } catch (err) {
            console.error(`❌ Failed to delete gallery image ${img.publicId}:`, err);
            errors.push(`Gallery image: ${err.message}`);
          }
        }
      }
    } else {
      console.log(`ℹ️ No gallery images to delete`);
    }

    // Delete product video
    if (product.productVideo && product.productVideo.publicId && product.productVideo.publicId !== '') {
      try {
        console.log(`🗑️ Deleting product video: ${product.productVideo.publicId}`);
        const result = await cloudinary.uploader.destroy(
          product.productVideo.publicId,
          { resource_type: "video" }
        );
        if (result.result === 'ok') {
          console.log(`✅ Deleted product video: ${product.productVideo.publicId}`);
          deletedCount++;
        }
      } catch (err) {
        console.error(`❌ Failed to delete product video:`, err);
        errors.push(`Video: ${err.message}`);
      }
    } else {
      console.log(`ℹ️ No video to delete`);
    }

    // Update category count
    await updateCategoryProductCount(categoryName);

    console.log(`✅ Product deletion complete. ${deletedCount} media files deleted.`);

    res.status(200).json({
      success: true,
      message: `Product deleted successfully. ${deletedCount} media files removed.`,
      deletedCount: deletedCount,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error("❌ Error in delete endpoint:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ============ OTHER ROUTES ============

router.get("/", async (req, res) => {
  try {
    const { category, status, search, limit } = req.query;

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

    let productsQuery = Product.find(query);
    if (limit) {
      productsQuery = productsQuery.limit(parseInt(limit));
    }

    const products = await productsQuery;
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