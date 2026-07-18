const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Category = require("../models/Category");
const Product = require("../models/Product");

// ============ HELPER FUNCTIONS ============

const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-");
};

// ============ PUBLIC ROUTES ============

// GET all categories
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find()
      .sort({ order: 1, name: 1 })
      .populate("parentCategory", "name slug");
    
    res.status(200).json({
      success: true,
      count: categories.length,
      categories
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ PUBLIC SYNC ROUTE
router.get("/sync-counts", async (req, res) => {
  try {
    console.log("🔄 Syncing all category product counts...");
    
    const categories = await Category.find();
    const results = [];
    
    for (const category of categories) {
      const productCount = await Product.countDocuments({
        category: { $regex: new RegExp(`^${category.name}$`, 'i') },
        status: "Published"
      });
      
      category.productCount = productCount;
      await category.save();
      
      results.push({
        id: category._id,
        name: category.name,
        productCount: productCount
      });
      
      console.log(`📊 ${category.name}: ${productCount} products`);
    }
    
    res.status(200).json({
      success: true,
      message: `Updated product counts for ${categories.length} categories`,
      results
    });
  } catch (error) {
    console.error("Error syncing category counts:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET category tree
router.get("/tree", async (req, res) => {
  try {
    const mainCategories = await Category.find({ parentCategory: null, isActive: true })
      .sort({ order: 1, name: 1 });
    
    const categoryTree = await Promise.all(mainCategories.map(async (category) => {
      const productCount = await Product.countDocuments({
        category: { $regex: new RegExp(`^${category.name}$`, 'i') },
        status: "Published"
      });
      
      const subcategories = await Category.find({ parentCategory: category._id, isActive: true })
        .sort({ order: 1, name: 1 });
      
      return {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        image: category.image,
        icon: category.icon,
        description: category.description,
        productCount: productCount,
        subcategories: subcategories.map(sub => ({
          _id: sub._id,
          name: sub.name,
          slug: sub.slug,
          productCount: 0
        }))
      };
    }));
    
    res.status(200).json({
      success: true,
      categories: categoryTree
    });
  } catch (error) {
    console.error("Get category tree error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET single category
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    let category;
    if (mongoose.Types.ObjectId.isValid(id)) {
      category = await Category.findById(id).populate("parentCategory", "name slug");
    } else {
      category = await Category.findOne({ slug: id }).populate("parentCategory", "name slug");
    }
    
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }
    
    const productCount = await Product.countDocuments({
      category: { $regex: new RegExp(`^${category.name}$`, 'i') },
      status: "Published"
    });
    
    res.status(200).json({
      success: true,
      category: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        image: category.image,
        icon: category.icon,
        level: category.level,
        featured: category.featured,
        isActive: category.isActive,
        productCount: productCount
      }
    });
  } catch (error) {
    console.error("Get category error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


// ============ ADMIN ROUTES ============

// CREATE category
router.post("/admin/create", async (req, res) => {
  try {
    const { name, description, image, icon, parentCategory, featured, isActive } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }
    
    const existing = await Category.findOne({ name: name.toLowerCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: "Category already exists" });
    }
    
    let level = 0;
    if (parentCategory) {
      const parent = await Category.findById(parentCategory);
      if (parent) level = parent.level + 1;
    }
    
    const slug = generateSlug(name);
    
    const category = await Category.create({
      name: name.toLowerCase(),
      slug,
      description: description || "",
      image: image || "",
      icon: icon || "",
      parentCategory: parentCategory || null,
      level,
      featured: featured || false,
      isActive: isActive !== undefined ? isActive : true,
      productCount: 0
    });
    
    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category
    });
  } catch (error) {
    console.error("Create category error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE category
router.put("/admin/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, icon, parentCategory, featured, isActive } = req.body;
    
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }
    
    if (name && name !== category.name) {
      const existing = await Category.findOne({ name: name.toLowerCase(), _id: { $ne: id } });
      if (existing) {
        return res.status(400).json({ success: false, message: "Category name already exists" });
      }
      category.name = name.toLowerCase();
      category.slug = generateSlug(name);
    }
    
    if (description !== undefined) category.description = description;
    if (image !== undefined) category.image = image;
    if (icon !== undefined) category.icon = icon;
    if (parentCategory !== undefined) category.parentCategory = parentCategory || null;
    if (featured !== undefined) category.featured = featured;
    if (isActive !== undefined) category.isActive = isActive;
    
    await category.save();
    
    await category.updateProductCount();
    
    res.status(200).json({
      success: true,
      message: "Category updated successfully",
      category
    });
  } catch (error) {
    console.error("Update category error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE category
router.delete("/admin/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }
    
    const subcategories = await Category.find({ parentCategory: id });
    if (subcategories.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete category with ${subcategories.length} subcategories` 
      });
    }
    
    const products = await Product.find({ 
      category: { $regex: new RegExp(`^${category.name}$`, 'i') } 
    });
    if (products.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete category with ${products.length} products` 
      });
    }
    
    await category.deleteOne();
    
    res.status(200).json({
      success: true,
      message: "Category deleted successfully"
    });
  } catch (error) {
    console.error("Delete category error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;