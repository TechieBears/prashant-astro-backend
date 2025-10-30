const router = require('express').Router();
const serviceOrderController = require('./serviceOrder.controller');
const { protect, authorize } = require('../../middlewares/auth');

// customer routes
router.post('/public/create', protect, authorize('customer'), serviceOrderController.createServiceOrder);
router.get('/public/get-all', protect, authorize('customer'), serviceOrderController.getAllServiceOrders);
router.get('/public/get-single', protect, authorize('customer'), serviceOrderController.getServiceOrder);
router.get('/public/item/get-single', protect, authorize('customer'), serviceOrderController.getServiceOrderItemById);
router.post('/public/reschedule-service', protect, authorize('customer'), serviceOrderController.rescheduleServiceOrderCustomer);

// admin routes
router.get('/get-all', protect, authorize('admin', "employee"), serviceOrderController.getAllServiceOrdersAdmin);
router.get('/item/get-single', protect, authorize('admin', 'employee'), serviceOrderController.getServiceOrderItemById);
router.get('/order/get-single', protect, authorize('admin', 'employee', 'customer'), serviceOrderController.getSingleServiceOrder);
// router.post('/update-order-status', protect, authorize('admin', "employee"), serviceOrderController.updateServiceOrder);

// astrologer routes
router.get('/astrologer/get-all', protect, authorize('admin', 'employee'), serviceOrderController.getAllServiceOrdersAstrologer);
router.get('/astrologer/get-single', protect, authorize('admin', 'employee'), serviceOrderController.getServiceOrderAstrologer);
router.post('/astrologer/update-order-status', protect, authorize('admin', 'employee'), serviceOrderController.updateServiceOrderAstrologer);
router.post('/astrologer/reschedule-service', protect, authorize('admin', 'employee'), serviceOrderController.rescheduleServiceOrderAstrologer);

module.exports = router;