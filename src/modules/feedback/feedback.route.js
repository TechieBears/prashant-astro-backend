const express = require('express');
const FeedbackController = require('./feedback.controller');
const { protect, authorize } = require('../../middlewares/auth');

const router = express.Router();

// Public route
router.post('/create', FeedbackController.createFeedback);

// Admin routes
router.use(protect);
router.get('/get-all', authorize('admin', "employee"), FeedbackController.getAllFeedbacks);
router.get('/get-single', authorize('admin', "employee"), FeedbackController.getFeedbackById);
router.put('/read', authorize('admin', "employee"), FeedbackController.toggleRead);
router.put('/:id/read', authorize('admin', "employee"), FeedbackController.toggleRead);
router.delete('/delete', authorize('admin', "employee"), FeedbackController.deleteFeedback);
router.post('/respond', authorize('admin', "employee"), FeedbackController.respondToFeedback);

module.exports = router;
