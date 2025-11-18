const router = require('express').Router();
const couponController = require('./coupon.controller');
const { protect, authorize } = require('../../middlewares/auth');

router.get('/public/get-all', couponController.getAllActiveCoupons);
router.post('/service/apply', protect, authorize('customer'), couponController.applyServiceCoupon);
router.post('/product/apply', protect, authorize('customer'), couponController.applyProductCoupon);

// Admin routes
router.use(protect);
router.post('/create', authorize('admin', 'employee'), couponController.createCoupon);
router.get('/get-all', authorize('admin', 'employee'), couponController.getCouponsAdmin);
router.put('/update', authorize('admin', 'employee'), couponController.updateCoupon);
// router.delete('/delete', authorize('admin', 'employee'), couponController.deleteCoupon);

module.exports = router;


