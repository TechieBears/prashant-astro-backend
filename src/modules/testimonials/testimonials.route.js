const express = require('express');
const Controller = require('./testimonials.controller');
const { protect, authorize } = require('../../middlewares/auth');

const router = express.Router();

// Public routes
router.get('/public', Controller.getPublicTestimonials);

// Admin routes
router.use(protect);
router.post('/create', authorize('admin', 'customer'), Controller.createTestimonial);
router.get('/get-all', authorize('admin', 'employee', 'customer'), Controller.getAllTestimonials);
router.get('/get-single', authorize('admin', 'employee'), Controller.getTestimonialById);
router.put('/update', authorize('admin', 'employee'), Controller.updateTestimonial);
router.delete('/delete', authorize('admin', 'employee'), Controller.deleteTestimonial);
router.put('/:id/active', authorize('admin', 'employee'), Controller.toggleActive);
router.put('/:id/approval', authorize('admin', 'employee'), Controller.setApprovalStatus);
router.put('/reorder', authorize('admin', 'employee'), Controller.reorderTestimonials);

module.exports = router;
