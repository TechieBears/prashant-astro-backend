const express = require('express');
const TransactionController = require('./transaction.controller');
const { protect, authorize } = require('../../middlewares/auth');
const router = express.Router();

router.get('/get-all', protect, authorize("customer"), TransactionController.getAllTransactions);

module.exports = router;