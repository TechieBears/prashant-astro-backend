const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Coupon = require('./coupon.model');
const ErrorHandler = require('../../utils/errorHandler');

// @desc    Create a new coupon
// @route   POST /api/coupons/create
// @access  Private/Admin
exports.createCoupon = asyncHandler(async (req, res, next) => {
    const {
        couponName,
        couponCode,
        couponType,
        discountIn,
        discount,
        activationDate,
        expiryDate,
        redemptionPerUser,
        totalRedemptions
    } = req.body;

    const existing = await Coupon.findOne({ couponCode: couponCode?.toUpperCase(), isDeleted: false });
    if (existing) return next(new ErrorHandler('Coupon code already exists', 400));

    const coupon = await Coupon.create({
        couponName,
        couponCode,
        couponType,
        discountIn,
        discount,
        activationDate,
        expiryDate,
        redemptionPerUser,
        totalRedemptions,
        userId: req.user._id
    });

    res.created(coupon, 'Coupon created successfully');
});

// @desc    Get coupons (all or single by id)
// @route   GET /api/coupons/public/get-all? id=<optional>
// @access  Private/Admin
exports.getCouponsAdmin = asyncHandler(async (req, res, next) => {
    const { id, page = 1, limit = 10 } = req.query;

    if (id) {
        if (!mongoose.Types.ObjectId.isValid(id)) return next(new ErrorHandler('Invalid coupon id', 400));
        const coupon = await Coupon.findOne({ _id: id, isDeleted: false });
        if (!coupon) return next(new ErrorHandler('Coupon not found', 404));
        return res.ok(coupon, 'Coupon fetched successfully');
    }

    const filter = { isDeleted: false };
    const coupons = await Coupon.find(filter)
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .sort({ createdAt: -1 });
    const total = await Coupon.countDocuments(filter);
    res.paginated(coupons, { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) }, 'Coupons fetched successfully');
});

// @desc    Get All active coupons
// @route   GET /api/coupons/public/get-all
// @access  Public
exports.getAllActiveCoupons = asyncHandler(async (req, res, next) => {
    const { couponType } = req.query;
    const filter = { isDeleted: false, isActive: true };
    // if coupon is service then services and both are valid else if coupon is product then products and both are valid else both are valid
    if (couponType) {
        if (couponType === 'services') filter.couponType = { $in: ['services', 'both'] };
        else if (couponType === 'products') filter.couponType = { $in: ['products', 'both'] };
        else filter.couponType = couponType;
    }
    const coupons = await Coupon.find(filter).select("couponName couponCode discountIn discount activationDate expiryDate");
    if (!coupons) return res.ok([], 'No active coupons found');
    res.ok(coupons, 'Coupons fetched successfully');
});

// @desc    Update coupon
// @route   PUT /api/coupons/update?id=<id>
// @access  Private/Admin
exports.updateCoupon = asyncHandler(async (req, res, next) => {
    const { id } = req.query;
    if (!id) return next(new ErrorHandler('Please provide coupon id', 400));
    if (!mongoose.Types.ObjectId.isValid(id)) return next(new ErrorHandler('Invalid coupon id', 400));

    const coupon = await Coupon.findById(id);
    if (!coupon || coupon.isDeleted) return next(new ErrorHandler('Coupon not found', 404));

    const updatableFields = [
        'couponName', 'couponCode', 'couponType', 'discountIn', 'discount',
        'activationDate', 'expiryDate', 'redemptionPerUser', 'totalRedemptions', 'isActive',
        // scopes
        'applyAllServices', 'applicableServices', 'applicableServiceCategories',
        'applyAllProducts', 'applicableProducts', 'applicableProductCategories', 'applicableProductSubcategories'
    ];

    for (const field of updatableFields) {
        if (req.body[field] !== undefined) {
            coupon[field] = req.body[field];
        }
    }

    await coupon.save();

    const updatedCoupon = await Coupon.findById(id);

    res.ok(updatedCoupon, 'Coupon updated successfully');
});

// @desc    Soft delete coupon
// @route   DELETE /api/coupons/delete?id=<id>
// @access  Private/Admin
exports.deleteCoupon = asyncHandler(async (req, res, next) => {
    const { id } = req.query;
    if (!id) return next(new ErrorHandler('Please provide coupon id', 400));
    if (!mongoose.Types.ObjectId.isValid(id)) return next(new ErrorHandler('Invalid coupon id', 400));

    const coupon = await Coupon.findById(id);
    if (!coupon || coupon.isDeleted) return next(new ErrorHandler('Coupon not found', 404));

    coupon.isDeleted = true;
    await coupon.save();

    res.ok(null, 'Coupon deleted successfully');
});


