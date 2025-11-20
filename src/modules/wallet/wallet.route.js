const router = require('express').Router();
const { addWalletBalance, getWalletBalance, getWalletTransactions } = require('./wallet.controller');
const { protect, authorize } = require('../../middlewares/auth');


router.post('/add-balance', protect, authorize("customer"), addWalletBalance);
router.get('/get-balance', protect, authorize("customer"), getWalletBalance);
router.get('/get-transactions-history', protect, authorize("customer"), getWalletTransactions);

module.exports = router;