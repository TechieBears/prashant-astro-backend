const express = require('express');
const productOrderController = require('./productOrder.controller');
const { protect, authorize } = require('../../middlewares/auth');

const router = express.Router();

router.use(protect);

// customer routes
// router.post('/public/checkout', authorize('customer'), productOrderController.checkoutProductOrder);
router.post('/public/create', authorize('customer'), productOrderController.createProductOrder);
router.get('/public/get-all', authorize('customer'), productOrderController.getProductOrders);
router.get('/public/get-single', authorize('customer'), productOrderController.getProductOrderById);
router.post('/public/cod-payment-success', authorize('customer'), productOrderController.handleCODPaymentSuccess); // 👈 New route

// admin routes
router.get('/get-all', authorize('admin', "employee"), productOrderController.getAllProductOrdersAdmin);
router.get('/get-single', authorize('admin', "employee"), productOrderController.getProductOrderByIdAdmin);
router.post('/update-order-status', authorize('admin', "employee"), productOrderController.updateOrderStatusAdmin);
router.post('/accept-order', authorize('admin', "employee"), productOrderController.acceptOrderAdmin);
router.post('/reject-order', authorize('admin', "employee"), productOrderController.rejectOrderAdmin);
router.post('/cancel-order', authorize('admin', "employee"), productOrderController.cancelOrderAdmin);

module.exports = router;