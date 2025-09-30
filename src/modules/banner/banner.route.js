const express = require('express');
const BannerController = require('./banner.controller');
const { protect, authorize } = require('../../middlewares/auth');

const router = express.Router();

// Public
router.get('/active', BannerController.getActiveBanners);

// Authenticated admin routes
router.use(protect);
router.get('/get-all', authorize('admin', 'employee'), BannerController.getAllBanners);
router.post('/create', authorize('admin', 'employee'), BannerController.createBanner);
router.get('/get-single', authorize('admin', 'employee'), BannerController.getBanner);
router.put('/update', authorize('admin', 'employee'), BannerController.updateBanner);
router.delete('/delete', authorize('admin', 'employee'), BannerController.deleteBanner);

module.exports = router;