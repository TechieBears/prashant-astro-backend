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

    try {
        // First, get transactions with basic population
        const transactionsQuery = Transaction.find(filter)
            .populate({
                path: 'serviceId',
                select: 'name title price'
            })
            .populate({
                path: 'productOrderId',
                // Don't populate productId here yet - we'll handle it differently
                select: ''
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
            .limit(parseInt(limit));

        const [transactions, total] = await Promise.all([
            transactionsQuery,
            Transaction.countDocuments(filter)
        ]);

        // If you need product details, you need to know the structure of ProductOrder
        // Let's assume ProductOrder has a reference to Product called 'product' or 'productId'
        // We'll fetch product details separately if needed

        // Format the response
        const formattedTransactions = transactions.map(transaction => {
            const transactionObj = transaction.toObject();
            
            // Get service or product details
            let itemDetails = {
                name: '',
                type: transaction.from,
                price: 0,
                orderId: null
            };
            
            if (transaction.from === 'service' && transaction.serviceId) {
                itemDetails = {
                    name: transaction.serviceId.name || '',
                    type: 'service',
                    price: transaction.serviceId.price || 0,
                    orderId: transaction.serviceId._id,
                    serviceId: transaction.serviceId._id
                };
            } else if (transaction.from === 'product' && transaction.productOrderId) {
                // Try different possible field names for product reference
                // You need to adjust this based on your actual ProductOrder model
                itemDetails = {
                    name: 'Product Order', // Default name
                    type: 'product',
                    price: 0,
                    orderId: transaction.productOrderId._id,
                    productOrderId: transaction.productOrderId._id
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

        res.status(200).json({
            success: true,
            count: formattedTransactions.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            data: formattedTransactions
        });
    } catch (error) {
        // Handle population error by trying a simpler query
        if (error.message.includes('Cannot populate path')) {
            // Fallback to simpler query without nested population
            const transactionsQuery = Transaction.find(filter)
                .populate({
                    path: 'serviceId',
                    select: 'name title price'
                })
                .populate({
                    path: 'productOrderId',
                    select: ''
                })
                .populate({
                    path: 'userId',
                    select: 'email mobileNo'
                })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit));

            const [transactions, total] = await Promise.all([
                transactionsQuery,
                Transaction.countDocuments(filter)
            ]);

            // Format with available data
            const formattedTransactions = transactions.map(transaction => {
                const transactionObj = transaction.toObject();
                
                let itemDetails = {
                    name: '',
                    type: transaction.from,
                    price: 0
                };
                
                if (transaction.from === 'service' && transaction.serviceId) {
                    itemDetails.name = transaction.serviceId.name || '';
                } else if (transaction.from === 'product') {
                    itemDetails.name = 'Product Order';
                }

                const customer = {
                    fullName: '',
                    email: transaction.userId?.email || '',
                    mobileNo: transaction.userId?.mobileNo || '',
                    userId: transaction.userId?._id || null
                };

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

            res.status(200).json({
                success: true,
                count: formattedTransactions.length,
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
                currentPage: parseInt(page),
                data: formattedTransactions,
                note: "Customer full names not available due to schema limitations"
            });
        } else {
            throw error; // Re-throw other errors
        }
    }
});