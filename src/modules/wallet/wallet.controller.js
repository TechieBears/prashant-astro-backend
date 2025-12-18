const asyncHandler = require('express-async-handler');
const ErrorHander = require('../../utils/errorHandler');
const Wallet = require('./wallet.model');
const WalletTransaction = require('./walletTransactions.model');
const mongoose = require('mongoose');
const { createRazorpayOrder } = require('../../services/razorpay.service');

// @desc    add wallet balance (with Razorpay payment gateway integration)
// @route   POST /api/wallet/add-balance
// @access  Private
exports.addWalletBalance = asyncHandler(async (req, res, next) => {
  const { amount, paymentMethod = 'CARD' } = req.body;
  const userId = req.user._id;

  if (amount <= 0) {
    return next(new ErrorHander('Amount must be greater than zero', 400));
  }

  if (amount > 10000) {
    return next(new ErrorHander('Amount exceeds the maximum limit of 10000', 400));
  }

  // If payment method is COD or CASH, directly add to wallet (for testing/admin purposes)
  if (['COD', 'CASH'].includes(paymentMethod)) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let wallet = await Wallet.findOne({ userId }).session(session);

      if (!wallet) {
        wallet = new Wallet({ userId, balance: 0 });
        await wallet.save({ session });
      }

      wallet.balance += amount;
      await wallet.save({ session });

      const transaction = new WalletTransaction({
        userId,
        type: 'deposit',
        amount,
      });
      await transaction.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.ok({ balance: wallet.balance }, 'Wallet balance added successfully');
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      return next(new ErrorHander('Failed to add wallet balance', 500));
    }
  }

  // For online payment methods, create Razorpay order
  try {
    const paymentOrder = await createRazorpayOrder({
      amount, // amount to add to wallet
      currency: 'INR',
      receiptPrefix: 'WALLET',
      notes: {
        userId: userId.toString(),
        orderType: 'WALLET',
      },
    });

    // Return payment order details for frontend to process payment
    res.ok({
      paymentOrder: {
        orderId: paymentOrder.id,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        paymentGateway: 'RAZORPAY'
      },
      amount: amount,
      message: 'Payment order created. Complete payment to add balance to wallet.'
    }, 'Payment order created successfully');
  } catch (error) {
    console.error('Razorpay order creation failed:', error);
    return next(new ErrorHander('Failed to create payment order: ' + error.message, 500));
  }
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