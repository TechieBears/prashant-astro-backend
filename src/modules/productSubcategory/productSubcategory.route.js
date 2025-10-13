const express = require('express');
const ProductSubcategoryController = require('./productSubcategory.controller');
const { protect, authorize } = require('../../middlewares/auth');

const router = express.Router();

// Public
router.get('/active', ProductSubcategoryController.getActiveProductSubcategories);
router.get('/get-by-category', ProductSubcategoryController.getProductSubcategoriesByCategory);

// Authenticated admin routes
router.use(protect);
router.post('/create', authorize('admin', 'employee'), ProductSubcategoryController.createProductSubcategory);

router.get('/get-all', authorize('admin', 'employee'), ProductSubcategoryController.getAllProductSubcategories);
router.get('/get-single', authorize('admin', 'employee'), ProductSubcategoryController.getProductSubcategory);
router.get('/get-dropdown', authorize('admin', 'employee'), ProductSubcategoryController.getAllProductSubcategoriesDropdown);
// router.get('/stats', authorize('admin', 'employee'), ProductSubcategoryController.getProductSubcategoryStats);

router.put('/update', authorize('admin', 'employee'), ProductSubcategoryController.updateProductSubcategory);

// router.delete('/:id', authorize('admin', 'employee'), ProductSubcategoryController.deleteProductSubcategory);

// router.put('/:id/restore', authorize('admin', 'employee'), ProductSubcategoryController.restoreProductSubcategory);

module.exports = router;


