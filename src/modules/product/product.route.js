const express = require('express');
const ProductController = require('./product.controller');
const { protect, authorize } = require('../../middlewares/auth');


const router = express.Router();

// Public routes
router.get('/public/active', ProductController.getAllProducts);
router.get('/public/filter', ProductController.getFilterData);
router.get('/public/active-single', ProductController.getProductById);
router.get('/public/our-products', ProductController.getOurProducts);
router.get('/public/our-products/v2', ProductController.getOurProductshome);
router.get('/public/featured', ProductController.getFeaturedProducts);
router.get('/public/category/:categoryId', ProductController.getProductsByCategory);
router.get('/public/subcategory/:subcategoryId', ProductController.getProductsBySubcategory);

// Protected routes (admin only)
router.use(protect);
router.post('/create', authorize('admin', "employee"), ProductController.createProduct);
router.get('/get-all', authorize('admin', "employee"), ProductController.getAllProductsAdmin);
router.get('/get-single', authorize('admin', "employee"), ProductController.getProductByIdAdmin);
router.put('/update', authorize('admin', "employee"), ProductController.updateProduct);
router.delete('/delete', authorize('admin', "employee"), ProductController.deleteProduct);
router.put('/:id/status', authorize('admin', "employee"), ProductController.setActiveInactiveStatus);
router.put('/:id/restore', authorize('admin', "employee"), ProductController.restoreProduct);
router.get('/stats', authorize('admin', "employee"), ProductController.getProductStats);

module.exports = router;