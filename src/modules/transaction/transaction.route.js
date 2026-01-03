const express = require('express');
const TransactionController = require('./transaction.controller');

const router = express.Router();

router.get('/get-all', TransactionController.getAllTransactions);

module.exports = router;