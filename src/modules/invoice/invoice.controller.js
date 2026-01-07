const asyncHandler = require('express-async-handler');
const Invoice = require('./invoice.model');
const ErrorHandler = require('../../utils/errorHandler');
const mongoose = require('mongoose');

// @desc    Get invoice details by productOrderId or serviceOrderId
// @route   GET /api/invoice/get-details
// @access  Private
exports.getInvoiceDetails = asyncHandler(async (req, res, next) => {
    const { productOrderId, serviceOrderId } = req.query;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Validate input
    if (!productOrderId && !serviceOrderId) {
        return next(new ErrorHandler('Please provide either productOrderId or serviceOrderId', 400));
    }

    if (productOrderId && serviceOrderId) {
        return next(new ErrorHandler('Please provide only one: either productOrderId or serviceOrderId', 400));
    }

    // Validate ObjectId format
    if (productOrderId && !mongoose.Types.ObjectId.isValid(productOrderId)) {
        return next(new ErrorHandler('Invalid productOrderId format', 400));
    }

    if (serviceOrderId && !mongoose.Types.ObjectId.isValid(serviceOrderId)) {
        return next(new ErrorHandler('Invalid serviceOrderId format', 400));
    }

    // Build query
    let query = {};
    if (productOrderId) {
        query.productOrderId = productOrderId;
    } else if (serviceOrderId) {
        query.serviceOrderId = serviceOrderId;
    }

    // If user is customer, restrict to their own invoices
    if (userRole === 'customer') {
        query.userId = userId;
    }

    // Fetch invoice with populated fields
    const invoice = await Invoice.findOne(query)
        .populate('userId', 'email mobileNo')
        .populate({
            path: 'productOrderId',
            select: 'orderStatus paymentStatus createdAt',
            populate: {
                path: 'address',
                select: 'firstName lastName address city state postalCode country phoneNumber'
            }
        })
        .populate({
            path: 'serviceOrderId',
            select: 'paymentStatus createdAt'
        })
        .populate('items.productId', 'name images')
        .populate('items.serviceId', 'name image');

    if (!invoice) {
        return next(new ErrorHandler('Invoice not found', 404));
    }

    // Format response
    const invoiceData = {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        userId: {
            _id: invoice.userId._id,
            email: invoice.userId.email,
            mobileNo: invoice.userId.mobileNo
        },
        issuedTo: invoice.issuedTo,
        items: invoice.items.map(item => ({
            _id: item._id,
            productId: item.productId?._id || null,
            serviceId: item.serviceId?._id || null,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.total,
            product: item.productId ? {
                _id: item.productId._id,
                name: item.productId.name,
                images: item.productId.images
            } : null,
            service: item.serviceId ? {
                _id: item.serviceId._id,
                name: item.serviceId.name,
                image: item.serviceId.image
            } : null
        })),
        subtotal: invoice.subtotal,
        gst: invoice.gst,
        discount: invoice.discount,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        paymentInfo: invoice.paymentInfo,
        productOrderId: invoice.productOrderId,
        serviceOrderId: invoice.serviceOrderId,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt
    };

    res.ok(invoiceData, 'Invoice details retrieved successfully');
});

// @desc    Get invoice details by invoice ID or invoice number (alternative endpoint)
// @route   GET /api/invoice/get-by-invoice
// @access  Private
exports.getInvoiceByNumber = asyncHandler(async (req, res, next) => {
    const { invoiceId, invoiceNumber } = req.query;
    const userId = req.user._id;
    const userRole = req.user.role;

    // Validate input
    if (!invoiceId && !invoiceNumber) {
        return next(new ErrorHandler('Please provide either invoiceId or invoiceNumber', 400));
    }

    // Build query
    let query = {};
    if (invoiceId) {
        if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
            return next(new ErrorHandler('Invalid invoiceId format', 400));
        }
        query._id = invoiceId;
    } else if (invoiceNumber) {
        query.invoiceNumber = invoiceNumber;
    }

    // If user is customer, restrict to their own invoices
    if (userRole === 'customer') {
        query.userId = userId;
    }

    // Fetch invoice with populated fields
    const invoice = await Invoice.findOne(query)
        .populate('userId', 'email mobileNo')
        .populate({
            path: 'productOrderId',
            select: 'orderStatus paymentStatus createdAt',
            populate: {
                path: 'address',
                select: 'firstName lastName address city state postalCode country phoneNumber'
            }
        })
        .populate({
            path: 'serviceOrderId',
            select: 'paymentStatus createdAt'
        })
        .populate('items.productId', 'name images')
        .populate('items.serviceId', 'name image');

    if (!invoice) {
        return next(new ErrorHandler('Invoice not found', 404));
    }

    // Format response
    const invoiceData = {
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        userId: {
            _id: invoice.userId._id,
            email: invoice.userId.email,
            mobileNo: invoice.userId.mobileNo
        },
        issuedTo: invoice.issuedTo,
        items: invoice.items.map(item => ({
            _id: item._id,
            productId: item.productId?._id || null,
            serviceId: item.serviceId?._id || null,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            total: item.total,
            product: item.productId ? {
                _id: item.productId._id,
                name: item.productId.name,
                images: item.productId.images
            } : null,
            service: item.serviceId ? {
                _id: item.serviceId._id,
                name: item.serviceId.name,
                image: item.serviceId.image
            } : null
        })),
        subtotal: invoice.subtotal,
        gst: invoice.gst,
        discount: invoice.discount,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        paymentInfo: invoice.paymentInfo,
        productOrderId: invoice.productOrderId,
        serviceOrderId: invoice.serviceOrderId,
        createdAt: invoice.createdAt,
        updatedAt: invoice.updatedAt
    };

    res.ok(invoiceData, 'Invoice details retrieved successfully');
});

// @desc    Get all invoices for a user (customer) or all invoices (admin)
// @route   GET /api/invoice/get-all
// @access  Private
exports.getAllInvoices = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const userRole = req.user.role;
    const { page = 1, limit = 10 } = req.query;

    // Build query
    let query = {};
    if (userRole === 'customer') {
        query.userId = userId;
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Fetch invoices
    const invoices = await Invoice.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('userId', 'email mobileNo')
        .lean();

    // Get total count
    const total = await Invoice.countDocuments(query);

    // Format response
    const invoiceList = invoices.map(invoice => ({
        _id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        userId: invoice.userId,
        issuedTo: {
            name: invoice.issuedTo.name,
            address: invoice.issuedTo.address
        },
        itemsCount: invoice.items.length,
        subtotal: invoice.subtotal,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        paymentInfo: {
            paymentMethod: invoice.paymentInfo.paymentMethod,
            paymentStatus: invoice.paymentInfo.paymentStatus
        },
        createdAt: invoice.createdAt
    }));

    const pagination = {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
        itemsPerPage: limitNum
    };

    res.paginated(invoiceList, pagination, 'Invoices retrieved successfully');
});

