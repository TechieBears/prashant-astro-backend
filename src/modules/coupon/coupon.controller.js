const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Coupon = require('./coupon.model');
const ErrorHandler = require('../../utils/errorHandler');
const Product = require('../product/product.model');
const Service = require('../service/service.model');
const ProductOrder = require('../productOrder/productOrder.model');
const ServiceOrder = require('../serviceOrder/serviceOrder.model');

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
    if(req.query.name) filter.couponName = { $regex: req.query.name, $options: 'i' };
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

// @desc    Apply coupon for services
// @route   POST /api/coupons/apply/service
// @access  Private/User
exports.applyServiceCoupon = asyncHandler(async (req, res, next) => {
  const { couponCode, services = [] } = req.body;
  const userId = req.user._id;

  if (!couponCode || !Array.isArray(services) || services.length === 0)
    return next(new ErrorHandler("Please provide couponCode and services", 400));

  // Find coupon
  const coupon = await Coupon.findOne({
    couponCode: couponCode.toUpperCase(),
    isActive: true,
    isDeleted: false,
    couponType: { $in: ["services", "both"] }
  });

  if (!coupon) return next(new ErrorHandler("Invalid or inactive coupon", 400));

  const now = new Date();
  if (now < coupon.activationDate || now > coupon.expiryDate)
    return next(new ErrorHandler("Coupon is not active or expired", 400));

  // Check usage limits
  const usedCount = await ServiceOrder.countDocuments({
    user: userId,
    coupon: coupon._id
  });
  if (usedCount >= coupon.redemptionPerUser)
    return next(new ErrorHandler("You have already used this coupon", 400));

  // Get all service details
  const serviceDocs = await Service.find({ _id: { $in: services }, isDeleted: false });
  if (!serviceDocs.length) return next(new ErrorHandler("Invalid service IDs", 400));

  // Eligibility logic
  let eligible = false;
  let eligibleServices = [];

  if (coupon.applyAllServices) {
    eligible = true;
    eligibleServices = serviceDocs;
  } else {
    // Match specific service/category applicability
    eligibleServices = serviceDocs.filter(svc =>
      coupon.applicableServices.includes(svc._id) ||
      coupon.applicableServiceCategories.includes(svc.category)
    );
    eligible = eligibleServices.length > 0;
  }

  if (!eligible) return next(new ErrorHandler("Coupon not applicable to selected services", 400));

  // Calculate discount
  const total = eligibleServices.reduce((acc, svc) => acc + svc.price, 0);
  let discountAmount = 0;

  if (coupon.discountIn === "percent") {
    discountAmount = (total * coupon.discount) / 100;
  } else {
    discountAmount = coupon.discount;
  }

  const finalTotal = total - discountAmount;

//   res.success(
//     {
//       couponCode: coupon.couponCode,
//       discountIn: coupon.discountIn,
//       discountValue: coupon.discount,
//       originalTotal: total,
//       discountAmount,
//       finalTotal,
//     },
//     "Coupon applied successfully"
//   );

res.ok({
    couponCode: coupon.couponCode,
    discountIn: coupon.discountIn,
    discountValue: coupon.discount,
    originalTotal: total,
    discountAmount,
    finalTotal
}, "Coupon applied");

});

// @desc    Apply coupon for products
// @route   POST /api/coupons/apply/product
// @access  Private/User
exports.applyProductCoupon = asyncHandler(async (req, res, next) => {
  const { couponCode, products = [] } = req.body;
  const userId = req.user._id;

  if (!couponCode || !Array.isArray(products) || products.length === 0)
    return next(new ErrorHandler("Please provide couponCode and products", 400));

  // Find coupon
  const coupon = await Coupon.findOne({
    couponCode: couponCode.toUpperCase(),
    isActive: true,
    isDeleted: false,
    couponType: { $in: ["products", "both"] }
  });

  if (!coupon) return next(new ErrorHandler("Invalid or inactive coupon", 400));

  const now = new Date();
  if (now < coupon.activationDate || now > coupon.expiryDate)
    return next(new ErrorHandler("Coupon is not active or expired", 400));

  // Check usage limits
  const usedCount = await ProductOrder.countDocuments({
    user: userId,
    coupon: coupon._id
  });
  if (usedCount >= coupon.redemptionPerUser)
    return next(new ErrorHandler("You have already used this coupon", 400));

  // Get all product details
  const productDocs = await Product.find({ _id: { $in: products }, isDeleted: false });
  if (!productDocs.length) return next(new ErrorHandler("Invalid product IDs", 400));

  // Eligibility logic
  let eligible = false;
  let eligibleProducts = [];

  if (coupon.applyAllProducts) {
    eligible = true;
    eligibleProducts = productDocs;
  } else {
    // Match specific product/category/subcategory applicability
    eligibleProducts = productDocs.filter(p =>
      coupon.applicableProducts.includes(p._id) ||
      coupon.applicableProductCategories.includes(p.category) ||
      coupon.applicableProductSubcategories.includes(p.subcategory)
    );
    eligible = eligibleProducts.length > 0;
  }

  if (!eligible)
    return next(new ErrorHandler("Coupon not applicable to selected products", 400));

  // Calculate discount
  const total = eligibleProducts.reduce((acc, p) => acc + p.sellingPrice, 0);
  let discountAmount = 0;

  if (coupon.discountIn === "percent") {
    discountAmount = (total * coupon.discount) / 100;
  } else {
    discountAmount = coupon.discount;
  }

  const finalTotal = total - discountAmount;

//   res.success(
//     {
//       couponCode: coupon.couponCode,
//       discountIn: coupon.discountIn,
//       discountValue: coupon.discount,
//       originalTotal: total,
//       discountAmount,
//       finalTotal,
//     },
//     "Coupon applied successfully"
//   );

  res.ok({
    couponCode: coupon.couponCode,
    discountIn: coupon.discountIn,
    discountValue: coupon.discount,
    originalTotal: total,
    discountAmount,
    finalTotal
  }, "Coupon applied");

});
