const express = require('express');
const BannerController = require('./banner.controller');
const { protect, authorize } = require('../../middlewares/auth');

const getUploader = require("../../middlewares/upload");
const bannerParser = getUploader('banners');

const router = express.Router();

// Public
router.get('/active', BannerController.getActiveBanners);

// Authenticated admin routes
router.use(protect);
router.get('/get-all', authorize('admin', 'employee'), BannerController.getAllBanners);
router.post('/create', authorize('admin', 'employee'), bannerParser.fields([{ name: 'image', maxCount: 1 }]), BannerController.createBanner);
router.get('/get-single', authorize('admin', 'employee'), BannerController.getBanner);
router.put('/update', authorize('admin', 'employee'), bannerParser.fields([{ name: 'image', maxCount: 1 }]), BannerController.updateBanner);
router.delete('/delete', authorize('admin', 'employee'), BannerController.deleteBanner);

module.exports = router;