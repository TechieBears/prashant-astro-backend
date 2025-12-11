const express = require('express');
const ProductCategoryController = require('./productCategory.controller');
const { protect, authorize } = require('../../middlewares/auth');

const getUploader = require("../../middlewares/upload");
const productCategoryParser = getUploader('product_categories');

const router = express.Router();

// Public
router.get('/public/active', ProductCategoryController.getActiveProductCategories);
router.get('/public/our-product-categories', ProductCategoryController.getOurProductCategories);
router.get('/astroguid/public/categories-with-products', ProductCategoryController.getCategoriesWithProducts);

// Authenticated admin routes
router.use(protect);
router.post('/create', authorize('admin', 'employee'), productCategoryParser.fields([{ name: 'image', maxCount: 1 }]), ProductCategoryController.createProductCategory);

router.get('/get-all', authorize('admin', 'employee'), ProductCategoryController.getAllProductCategories);
router.get('/get-single', authorize('admin', 'employee'), ProductCategoryController.getProductCategory);
// router.get('/stats', authorize('admin', 'employee'), ProductCategoryController.getProductCategoryStats);
router.get('/dropdown', authorize('admin', 'employee'), ProductCategoryController.getAllProductCategoriesDropdown);

router.put('/update', authorize('admin', 'employee'), productCategoryParser.fields([{ name: 'image', maxCount: 1 }]), ProductCategoryController.updateProductCategory);

router.delete('/delete', authorize('admin', 'employee'), ProductCategoryController.deleteProductCategory);

// router.put('/:id/restore', authorize('admin', 'employee'), ProductCategoryController.restoreProductCategory);
// router.put('/:id/status', authorize('admin', 'employee'), ProductCategoryController.setActiveInactiveStatus);

module.exports = router;


