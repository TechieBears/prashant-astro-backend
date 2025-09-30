const express = require('express');
const ServiceCartController = require('./serviceCart.controller');
const { protect, authorize } = require('../../middlewares/auth');

const router = express.Router();

router.use(protect);

router.post('/public/add', authorize('customer'), ServiceCartController.addToCart);

router.get('/public/get', authorize('customer'), ServiceCartController.getCart);

router.put('/public/update', authorize('customer'), ServiceCartController.updateCart);
router.put('/public/remove-item', authorize('customer'), ServiceCartController.removeItem);

router.delete('/public/clear', authorize('customer'), ServiceCartController.removeAllFromCart);


module.exports = router;
