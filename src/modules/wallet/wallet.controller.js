const asyncHandler = require('express-async-handler');
const ErrorHander = require('../../utils/errorHandler');
const Wallet = require('./wallet.model');
const WalletTransaction = require('./walletTransactions.model');

// @desc    add wallet balance
// @route   POST /api/wallet/add-balance
// @access  Private
exports.addWalletBalance = asyncHandler(async (req, res, next) => {
  const { amount } = req.body;
  const userId = req.user._id;

    if (amount <= 0) {
        return next(new ErrorHander('Amount must be greater than zero', 400));
    }

    if(amount > 10000){
        return next(new ErrorHander('Amount exceeds the maximum limit of 10000', 400));
    }

    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
        wallet = new Wallet({ userId, balance: 0 });
    }

    wallet.balance += amount;
    await wallet.save();

    const transaction = new WalletTransaction({
        userId,
        type: 'deposit',
        amount,
    });
    await transaction.save();

    res.ok({ balance: wallet.balance }, 'Wallet balance added successfully');
});

// @desc    get wallet balance
// @route   GET /api/wallet/balance
// @access  Private
exports.getWalletBalance = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
        return res.ok({ balance: 0 }, 'Wallet balance retrieved successfully');
    }
    res.ok({ balance: wallet.balance }, 'Wallet balance retrieved successfully');
});

// @desc    get wallet transactions
// @route   GET /api/wallet/transactions
// @access  Private
exports.getWalletTransactions = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const transactions = await WalletTransaction.find({ userId }).sort({ transactionDate: -1 }).select('-__v -createdAt -updatedAt');

    res.ok({ transactions }, 'Wallet transactions retrieved successfully');
});