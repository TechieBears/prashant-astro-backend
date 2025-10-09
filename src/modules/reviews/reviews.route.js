const express = require('express');
const Controller = require('./reviews.controller');
const { protect, authorize } = require('../../middlewares/auth');

const router = express.Router();

// Public routes
router.get('/public/get-all', Controller.getPublicReviews);
router.get('/public/get-all-approved', Controller.getAllApprovedPublicReviews);

// Admin routes
router.use(protect);
router.post('/create', authorize('admin', 'customer'), Controller.createReview);
router.get('/get-all', authorize('admin', 'employee', 'customer'), Controller.getAllReviews);
router.get('/get-single', authorize('admin', 'employee'), Controller.getReviewById);
router.put('/update', authorize('admin', 'employee', 'customer'), Controller.updateReview);
router.delete('/delete', authorize('customer'), Controller.deleteReview);
router.put('/:id/active', authorize('admin', 'employee'), Controller.toggleActive);
router.put('/approval', authorize('admin', 'employee'), Controller.setApprovalStatus);
router.put('/reorder', authorize('admin', 'employee'), Controller.reorderReviews);
router.get('/filter', authorize('admin', 'employee', 'customer'), Controller.getReviewsFilter);

module.exports = router;
