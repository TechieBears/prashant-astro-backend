const express = require('express');

// Import route modules
const adminUserRoutes = require('../modules/adminUser/adminUser.route');
const authRoutes = require('../modules/auth/auth.route');
const customerUserRoutes = require('../modules/customerUser/customerUser.route');
const employeeUserRoutes = require('../modules/employeeUser/employeeUser.route');
const bannerRoutes = require("../modules/banner/banner.route")
const productCategoryRoutes = require('../modules/productCategory/productCategory.route');
const productSubcategoryRoutes = require('../modules/productSubcategory/productSubcategory.route');
const serviceCategoryRoutes = require('../modules/serviceCategory/serviceCategory.route');
const addressRoutes = require('../modules/customerAddress/customerAddress.route');
const productRoutes = require('../modules/product/product.route');
const serviceRoutes = require('../modules/service/service.route');
const feedbackRoutes = require('../modules/feedback/feedback.route');
const calenderRoutes = require('../modules/calender/calender.route');
const reviewsRoutes = require('../modules/reviews/reviews.route');
const couponRoutes = require('../modules/coupon/coupon.route');
const configRoutes = require('../modules/config/config.route');
const testimonialsRoutes = require('../modules/testimonials/testimonials.route');
const templates = require('../utils/templates');
const router = express.Router();

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running successfully',
    timestamp: new Date().toISOString()
  });
});

// API routes
router.get('/templates/:notificationFor', templates.templates);
router.use('/admin-users', adminUserRoutes);
router.use('/auth', authRoutes);
router.use('/customer-users', customerUserRoutes);
router.use('/employee-users', employeeUserRoutes);
router.use('/banners', bannerRoutes);
router.use('/product-categories', productCategoryRoutes);
router.use('/product-subcategories', productSubcategoryRoutes);
router.use('/product', productRoutes);
router.use('/service-categories', serviceCategoryRoutes);
router.use('/customer-address', addressRoutes);
router.use('/service', serviceRoutes);
router.use('/service-cart', require('../modules/serviceCart/serviceCart.route'));
router.use('/product-cart', require('../modules/productCart/productCart.route'));
router.use('/feedback', feedbackRoutes);
router.use('/calender', calenderRoutes);
router.use('/coupon', couponRoutes);
router.use('/product-order', require('../modules/productOrder/productOrder.route'));
router.use('/service-order', require('../modules/serviceOrder/serviceOrder.route'));
router.use('/reviews', reviewsRoutes);
router.use('/testimonials', testimonialsRoutes);
router.use('/config', configRoutes);
router.use('/notification', require('../modules/notification/notification.route'));
router.use('/dashboard', require('../modules/Dashboard/dashboard.route'));
router.use('/zoom', require('../modules/zoom/zoom.route'));
router.use('/wallet', require('../modules/wallet/wallet.route'));
router.use('/call', require('../modules/callAstrologer/call.router'))

// 404 handler for undefined routes (commented out temporarily to debug)
// router.all('*', (req, res) => {
//   res.status(404).json({
//     success: false,
//     message: `Route ${req.originalUrl} not found`
//   });
// });

module.exports = router;