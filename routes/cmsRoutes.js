const express = require('express');
const router = express.Router();
const {
  HeroSlide,
  BannerCategory,
  JewelrySection,
  OfferBanner,
  AboutSection,
  PartnerSection,
  PromoBanner,
  JewellerySection,
  TestimonialSection
} = require('../models/SectionImage');
const auth = require('../middleware/auth');

// ============ HERO SLIDES ============
router.get('/hero-slides', async (req, res) => {
  try {
    const slides = await HeroSlide.find({ isActive: true }).sort('displayOrder');
    res.json(slides);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/admin/hero-slide', auth, async (req, res) => {
  try {
    const newSlide = new HeroSlide(req.body);
    await newSlide.save();
    res.status(201).json(newSlide);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/admin/hero-slide/:id', auth, async (req, res) => {
  try {
    const updated = await HeroSlide.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/admin/hero-slide/:id', auth, async (req, res) => {
  try {
    await HeroSlide.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ BANNER CATEGORIES ============
router.get('/banner-categories', async (req, res) => {
  try {
    const categories = await BannerCategory.find({ isActive: true }).sort('displayOrder');
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/admin/banner-category', auth, async (req, res) => {
  try {
    const newCategory = new BannerCategory(req.body);
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/admin/banner-category/:id', auth, async (req, res) => {
  try {
    const updated = await BannerCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/admin/banner-category/:id', auth, async (req, res) => {
  try {
    await BannerCategory.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ JEWELRY SECTION IMAGES ============
router.get('/jewelry-section', async (req, res) => {
  try {
    const images = await JewelrySection.find({ isActive: true }).sort('displayOrder');
    res.json(images);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/admin/jewelry-section', auth, async (req, res) => {
  try {
    const newImage = new JewelrySection(req.body);
    await newImage.save();
    res.status(201).json(newImage);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/admin/jewelry-section/:id', auth, async (req, res) => {
  try {
    await JewelrySection.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ OFFER BANNERS ============
router.get('/offer-banners', async (req, res) => {
  try {
    const banners = await OfferBanner.find({ isActive: true }).sort('displayOrder');
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/admin/offer-banner', auth, async (req, res) => {
  try {
    const newBanner = new OfferBanner(req.body);
    await newBanner.save();
    res.status(201).json(newBanner);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete('/admin/offer-banner/:id', auth, async (req, res) => {
  try {
    await OfferBanner.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ ABOUT SECTION ============
router.get('/about-section', async (req, res) => {
  try {
    const about = await AboutSection.findOne({ isActive: true });
    res.json(about);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/admin/about-section', auth, async (req, res) => {
  try {
    let about = await AboutSection.findOne();
    if (about) {
      Object.assign(about, req.body);
      await about.save();
    } else {
      about = new AboutSection(req.body);
      await about.save();
    }
    res.json(about);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ============ PARTNER SECTION ============
router.get('/partner-section', async (req, res) => {
  try {
    const partner = await PartnerSection.findOne({ isActive: true });
    res.json(partner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/admin/partner-section', auth, async (req, res) => {
  try {
    let partner = await PartnerSection.findOne();
    if (partner) {
      Object.assign(partner, req.body);
      await partner.save();
    } else {
      partner = new PartnerSection(req.body);
      await partner.save();
    }
    res.json(partner);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ============ PROMO BANNER ============
router.get('/promo-banner', async (req, res) => {
  try {
    const promo = await PromoBanner.findOne({ isActive: true });
    res.json(promo);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/admin/promo-banner', auth, async (req, res) => {
  try {
    let promo = await PromoBanner.findOne();
    if (promo) {
      Object.assign(promo, req.body);
      await promo.save();
    } else {
      promo = new PromoBanner(req.body);
      await promo.save();
    }
    res.json(promo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ============ JEWELLERY SECTION (Stylish Design) ============
router.get('/jewellery-section', async (req, res) => {
  try {
    const jewellery = await JewellerySection.findOne({ isActive: true });
    res.json(jewellery);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/admin/jewellery-section', auth, async (req, res) => {
  try {
    let jewellery = await JewellerySection.findOne();
    if (jewellery) {
      Object.assign(jewellery, req.body);
      await jewellery.save();
    } else {
      jewellery = new JewellerySection(req.body);
      await jewellery.save();
    }
    res.json(jewellery);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ============ TESTIMONIAL SECTION ============
router.get('/testimonial-section', async (req, res) => {
  try {
    const testimonial = await TestimonialSection.findOne({ isActive: true });
    res.json(testimonial);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/admin/testimonial-section', auth, async (req, res) => {
  try {
    let testimonial = await TestimonialSection.findOne();
    if (testimonial) {
      Object.assign(testimonial, req.body);
      await testimonial.save();
    } else {
      testimonial = new TestimonialSection(req.body);
      await testimonial.save();
    }
    res.json(testimonial);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;