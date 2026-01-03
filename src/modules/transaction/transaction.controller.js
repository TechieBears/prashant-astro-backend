const asyncHandler = require('express-async-handler');
const ErrorHander = require('../../utils/errorHandler');
const Transaction = require('./transaction.Model');


// @desc    get all transactions
// @route   GET /api/transactions
// @access  Private
exports.getAllTransactions = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        status,
        type,
        from,
        startDate,
        endDate,
        userId
    } = req.query;

    // Build filter object
    const filter = {};

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (from) filter.from = from;
    if (userId) filter.userId = userId;

    // Date range filter
    if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) {
            filter.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
            filter.createdAt.$lte = new Date(endDate);
        }
    }

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const [transactions, total] = await Promise.all([
        Transaction.find(filter)
            .populate({
                path: 'serviceId',
                select: 'name title price'
            })
            .populate({
                path: 'productOrderId',
                populate: {
                    path: 'productId',
                    select: 'name sellingPrice'
                }
            })
            .populate({
                path: 'userId',
                select: 'email mobileNo role profile',
                populate: {
                    path: 'profile',
                    select: 'firstName lastName fullName',
                    model: 'customer'
                }
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        Transaction.countDocuments(filter)
    ]);

    // Format the response
    const formattedTransactions = transactions.map(transaction => {
        const transactionObj = transaction.toObject();

        // Get service or product details
        let itemDetails = {
            name: '',
            type: transaction.from,
            price: 0
        };

        if (transaction.from === 'service' && transaction.serviceId) {
            itemDetails = {
                name: transaction.serviceId.name || '',
                type: 'service',
                price: transaction.serviceId.price || 0
            };
        } else if (transaction.from === 'product' && transaction.productOrderId?.productId) {
            itemDetails = {
                name: transaction.productOrderId.productId.name || '',
                type: 'product',
                price: transaction.productOrderId.productId.sellingPrice || 0
            };
        }

        // Get customer details
        let customer = {};
        if (transaction.userId && transaction.userId.profile) {
            const profile = transaction.userId.profile;
            customer = {
                fullName: profile.fullName || `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
                email: transaction.userId.email || '',
                mobileNo: transaction.userId.mobileNo || '',
                userId: transaction.userId._id
            };
        } else {
            customer = {
                fullName: '',
                email: transaction.userId?.email || '',
                mobileNo: transaction.userId?.mobileNo || '',
                userId: transaction.userId?._id || null
            };
        }

        return {
            _id: transaction._id,
            paymentId: transaction.paymentId,
            type: transaction.type,
            status: transaction.status,
            from: transaction.from,
            amount: transaction.amount,
            pendingAmount: transaction.pendingAmount,
            payingAmount: transaction.payingAmount,
            walletUsed: transaction.walletUsed,
            isCoupon: transaction.isCoupon,
            refund: transaction.refund,
            createdAt: transaction.createdAt,
            item: itemDetails,
            customer: customer,
            paymentDetails: transaction.paymentDetails
        };
    });

    // res.status(200).json({
    //     success: true,
    //     count: formattedTransactions.length,
    //     total,
    //     totalPages: Math.ceil(total / parseInt(limit)),
    //     currentPage: parseInt(page),
    //     data: formattedTransactions
    // });

    res.paginated(
        formattedTransactions,
        { page, limit, total, totalPages: Math.ceil(total / parseInt(limit)) },
        'Transactions fetched successfully'
    );
});