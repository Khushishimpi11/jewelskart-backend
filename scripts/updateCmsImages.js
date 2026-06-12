const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Path configurations
const reactAssetsDir = path.join(__dirname, '..', '..', 'evimeria-elegance', 'src', 'assets');
const backendUploadsDir = path.join(__dirname, '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(backendUploadsDir)) {
  fs.mkdirSync(backendUploadsDir, { recursive: true });
}

// Map of files to copy: [src_path_relative_to_react_assets, dest_filename]
const filesToCopy = [
  ['hhhh.png', 'hhhh.png'],
  ['hero/1.png', 'hero_1.png'],
  ['hero/2.png', 'hero_2.png'],
  ['hero/3.png', 'hero_3.png'],
  ['hero/4.png', 'hero_4.png'],
  ['hero/5.png', 'hero_5.png'],
  ['hero/6.png', 'hero_6.png'],
  ['c.png', 'c.png'],
  ['mm.png', 'mm.png'],
  ['e.png', 'e.png'],
  ['bracelet.jpeg', 'bracelet.jpeg'],
  ['v.png', 'v.png'], // Add Stylish Design Collections main arch image
  ['banner1.png', 'banner1.png'] // Add Signature Brand PromoBanner background image
];

console.log('⚡ Starting asset copy process...');
filesToCopy.forEach(([srcRelative, destName]) => {
  const srcPath = path.join(reactAssetsDir, srcRelative);
  const destPath = path.join(backendUploadsDir, destName);
  
  if (fs.existsSync(srcPath)) {
    try {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✅ Copied ${srcRelative} -> uploads/${destName}`);
    } catch (err) {
      console.error(`❌ Failed to copy ${srcRelative}: ${err.message}`);
    }
  } else {
    console.warn(`⚠️ Warning: Source file not found: ${srcPath}`);
  }
});

// Import models
const { HeroSlide, BannerCategory, JewellerySection, PromoBanner } = require('../models/SectionImage');

// Database Connection
const DB_URI = "mongodb+srv://jewelskartindia16_db_user:Jewelskart%2316@cluster0.sx8d4xv.mongodb.net/?appName=Cluster0";

const updateDatabase = async () => {
  try {
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(DB_URI);
    console.log('✅ Connected to MongoDB.');

    // 1. Reset and Seed Hero Slides
    console.log('\n🧹 Clearing old HeroSlides...');
    await HeroSlide.deleteMany({});
    
    console.log('🌱 Seeding new HeroSlides (parity with website)...');
    const newSlides = [
      {
        bgImage: '/uploads/hhhh.png',
        leftModelImage: '/uploads/hero_2.png',
        rightModelImage: '/uploads/hero_3.png',
        brandText: 'JEWELSKART',
        title: 'TIMELESS ELEGANCE',
        subtitle: 'Discover handcrafted jewellery that celebrates your precious moments',
        buttonLink: '/shop',
        displayOrder: 0,
        isActive: true
      },
      {
        bgImage: '/uploads/hhhh.png',
        leftModelImage: '/uploads/hero_4.png',
        rightModelImage: '/uploads/hero_1.png',
        brandText: 'JEWELSKART EXCLUSIVE',
        title: 'DIAMONDS OF DESIRE',
        subtitle: 'Where brilliance meets bold sophistication in every sparkling piece',
        buttonLink: '/shop',
        displayOrder: 1,
        isActive: true
      },
      {
        bgImage: '/uploads/hhhh.png',
        leftModelImage: '/uploads/hero_5.png',
        rightModelImage: '/uploads/hero_6.png',
        brandText: 'JEWELSKART HERITAGE',
        title: 'GOLDEN HOUR LUXURY',
        subtitle: 'Crafted with passion, worn with pride — jewellery for every occasion',
        buttonLink: '/shop',
        displayOrder: 2,
        isActive: true
      }
    ];
    await HeroSlide.insertMany(newSlides);
    console.log('✅ Successfully seeded HeroSlides.');

    // 2. Reset and Seed Banner Categories
    console.log('\n🧹 Clearing old BannerCategories...');
    await BannerCategory.deleteMany({});
    
    console.log('🌱 Seeding new BannerCategories (parity with website)...');
    const newCategories = [
      {
        category: 'pendants',
        imageUrl: '/uploads/c.png',
        title: 'PENDANTS',
        buttonText: 'shop pendants',
        buttonLink: '/shop?brand=jewelskart&category=pendants',
        displayOrder: 0,
        isActive: true
      },
      {
        category: 'rings',
        imageUrl: '/uploads/mm.png',
        title: 'RINGS',
        buttonText: 'shop rings',
        buttonLink: '/shop?brand=jewelskart&category=rings',
        displayOrder: 1,
        isActive: true
      },
      {
        category: 'earrings',
        imageUrl: '/uploads/e.png',
        title: 'EARRINGS',
        buttonText: 'shop earrings',
        buttonLink: '/shop?brand=jewelskart&category=earrings',
        displayOrder: 2,
        isActive: true
      },
      {
        category: 'bracelets',
        imageUrl: '/uploads/bracelet.jpeg',
        title: 'BRACELETS',
        buttonText: 'shop bracelets',
        buttonLink: '/shop?brand=jewelskart&category=bracelets',
        displayOrder: 3,
        isActive: true
      }
    ];
    await BannerCategory.insertMany(newCategories);
    console.log('✅ Successfully seeded BannerCategories.');

    // 3. Update JewellerySection Image
    console.log('\n🎨 Updating JewellerySection (Stylish Design Collections) main image...');
    const jewSec = await JewellerySection.findOne({});
    if (jewSec) {
      jewSec.leftImageUrl = '/uploads/v.png';
      await jewSec.save();
      console.log('✅ Updated JewellerySection leftImageUrl to /uploads/v.png');
    } else {
      console.log('⚠️ No JewellerySection found to update.');
    }

    // 4. Update PromoBanner Image
    console.log('\n📢 Updating PromoBanner (Signature Brand Banner) background image...');
    const promo = await PromoBanner.findOne({});
    if (promo) {
      promo.imageUrl = '/uploads/banner1.png';
      await promo.save();
      console.log('✅ Updated PromoBanner imageUrl to /uploads/banner1.png');
    } else {
      console.log('⚠️ No PromoBanner found to update.');
    }

    console.log('\n✨ Database seeding and updates completed successfully!');
  } catch (err) {
    console.error('❌ Error updating database:', err);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Connection closed.');
    process.exit(0);
  }
};

updateDatabase();
