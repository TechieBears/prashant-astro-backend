const express = require('express');
const ServiceCategoryController = require('./serviceCategory.controller');
const { protect, authorize } = require('../../middlewares/auth');

const getUploader = require("../../middlewares/upload");
const serviceCategoryParser = getUploader('service_categories');

const router = express.Router();

// Public
router.get('/public/active', ServiceCategoryController.getActiveServiceCategories);
router.get("/public/dropdown", ServiceCategoryController.getAllServiceCategoriesDropdown);
router.get('/public/our-service-categories', ServiceCategoryController.getOurServiceCategories);

// Authenticated admin routes
router.use(protect);

router.post('/create', authorize('admin', 'employee'), serviceCategoryParser.fields([{ name: 'image', maxCount: 1 }]), ServiceCategoryController.createServiceCategory);

router.get('/get-all', authorize('admin', 'employee'), ServiceCategoryController.getAllServiceCategoriesAdmin);
router.get('/get-single', authorize('admin', 'employee'), ServiceCategoryController.getServiceCategory);
router.get('/dropdown', authorize('admin', 'employee'), ServiceCategoryController.getAllServiceCategoriesDropdownAdmin);
// router.get('/stats', authorize('admin', 'employee'), ServiceCategoryController.getServiceCategoryStats);

router.put('/update', authorize('admin', 'employee'), serviceCategoryParser.fields([{ name: 'image', maxCount: 1 }]), ServiceCategoryController.updateServiceCategory);
// router.put('/:id/restore', authorize('admin', 'employee'), ServiceCategoryController.restoreServiceCategory);

// router.delete('/delete', authorize('admin', 'employee'), ServiceCategoryController.deleteServiceCategory);

module.exports = router;


