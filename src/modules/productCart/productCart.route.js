const express = require('express');
const ProductCartController = require('./productCart.controller');
const { protect, authorize } = require('../../middlewares/auth');

const router = express.Router();

router.use(protect);

router.post('/public/add', authorize('customer'), ProductCartController.addToCart);

router.get('/public/get', authorize('customer'), ProductCartController.getCart);

router.put('/public/update', authorize('customer'), ProductCartController.updateQuantity);
router.put('/public/remove-item', authorize('customer'), ProductCartController.removeItem);

router.delete('/public/clear', authorize('customer'), ProductCartController.removeAllFromCart);


module.exports = router;
