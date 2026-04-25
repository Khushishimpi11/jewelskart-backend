const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Category name is required"],
    unique: true,
    trim: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  description: { type: String, default: "" },
  image: { type: String, default: "" },
  icon: { type: String, default: "" },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    default: null
  },
  level: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
  featured: { type: Boolean, default: false },
  productCount: { type: Number, default: 0 }
}, { timestamps: true });

// Generate slug before saving
categorySchema.pre("save", function(next) {
  if (this.name && !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, "-")
      .replace(/-+/g, "-");
  }
  next();
});

// Method to update product count for this category
categorySchema.methods.updateProductCount = async function() {
  const Product = mongoose.model("Product");
  const count = await Product.countDocuments({
    category: { $regex: new RegExp(`^${this.name}$`, 'i') },
    status: "Published"
  });
  this.productCount = count;
  await this.save();
  return count;
};

// Static method to update all category counts
categorySchema.statics.updateAllProductCounts = async function() {
  const categories = await this.find();
  let updated = 0;
  for (const category of categories) {
    await category.updateProductCount();
    updated++;
  }
  return updated;
};

module.exports = mongoose.model("Category", categorySchema);