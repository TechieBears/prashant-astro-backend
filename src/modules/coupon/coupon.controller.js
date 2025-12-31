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
        applicableTo, // enum ['all_products', 'single_product', 'product_category', 'all_services', 'single_service', 'service_category'], 
        discountIn,
        discount,
        activationDate,
        expiryDate,
        redemptionPerUser,
        totalRedemptions,
        // scopes
        applyAllServices,
        applicableServices = [],
        applicableServiceCategories = [],
        applyAllProducts,
        applicableProducts = [],
        applicableProductCategories = [],
        applicableProductSubcategories = []
    } = req.body;

    const existing = await Coupon.findOne({ couponCode: couponCode?.toUpperCase(), isDeleted: false });
    if (existing) return next(new ErrorHandler('Coupon code already exists', 400));

    const coupon = await Coupon.create({
        couponName,
        couponCode,
        couponType,
        applicableTo,
        discountIn,
        discount,
        activationDate,
        expiryDate,
        redemptionPerUser,
        totalRedemptions,
        applyAllServices: !!applyAllServices,
        applicableServices,
        applicableServiceCategories,
        applyAllProducts: !!applyAllProducts,
        applicableProducts,
        applicableProductCategories,
        // applicableProductSubcategories,
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
        .populate('applicableProductCategories', 'name')
        .populate('applicableServiceCategories', 'name')
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .sort({ createdAt: -1 });
    const total = await Coupon.countDocuments(filter);
    res.paginated(coupons, { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / limit) }, 'Coupons fetched successfully');
});

// @desc    Get coupon by ID (admin)
// @route   GET /api/coupons/get-single
// @access  Private/Admin
exports.getCouponById = asyncHandler(async (req, res, next) => {
  const { id } = req.query;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return next(new ErrorResponse('Invalid coupon ID format', 400));
  }

  const coupon = await Coupon.findById(id)
    .populate([
      // Populate applicable services
      {
        path: 'applicableServices',
        match: { isActive: true, isDeleted: false },
        select: 'name title price durationInMinutes serviceType'
      },
      // Populate applicable service categories
      {
        path: 'applicableServiceCategories',
        match: { isActive: true, isDeleted: false },
        select: 'name description image'
      },
      // Populate applicable products
      {
        path: 'applicableProducts',
        match: { isActive: true, isDeleted: false },
        select: 'name description mrpPrice sellingPrice stock images'
      },
      // Populate applicable product categories
      {
        path: 'applicableProductCategories',
        match: { isActive: true, isDeleted: false },
        select: 'name image'
      },
      // Populate applicable product subcategories
      // {
      //   path: 'applicableProductSubcategories',
      //   match: { isActive: true, isDeleted: false },
      //   select: 'name image categoryId',
      //   populate: {
      //     path: 'categoryId',
      //     select: 'name'
      //   }
      // },
      // Populate user who created the coupon
      {
        path: 'userId',
        select: 'name email mobileNo'
      }
    ])
    .lean();

  if (!coupon) {
    return next(new ErrorResponse('Coupon not found', 404));
  }

  if (coupon.isDeleted) {
    return next(new ErrorResponse('Coupon has been deleted', 410));
  }

  // Format the response with additional computed fields
  const formattedCoupon = {
    _id: coupon._id,
    couponName: coupon.couponName,
    couponCode: coupon.couponCode,
    couponType: coupon.couponType,
    discountIn: coupon.discountIn,
    discount: coupon.discount,
    activationDate: coupon.activationDate,
    expiryDate: coupon.expiryDate,
    redemptionPerUser: coupon.redemptionPerUser,
    totalRedemptions: coupon.totalRedemptions,
    isActive: coupon.isActive,
    isExpired: new Date() > new Date(coupon.expiryDate),
    isUpcoming: new Date() < new Date(coupon.activationDate),
    isValid: coupon.isActive && 
             new Date() >= new Date(coupon.activationDate) && 
             new Date() <= new Date(coupon.expiryDate),
    
    // Applicability scopes
    applicability: {
      services: {
        applyAllServices: coupon.applyAllServices,
        applicableServices: coupon.applicableServices || [],
        applicableServiceCategories: coupon.applicableServiceCategories || []
      },
      products: {
        applyAllProducts: coupon.applyAllProducts,
        applicableProducts: coupon.applicableProducts || [],
        applicableProductCategories: coupon.applicableProductCategories || [],
        // applicableProductSubcategories: coupon.applicableProductSubcategories || []
      }
    },

    // Creator information
    createdBy: coupon.userId ? {
      _id: coupon.userId._id,
      name: coupon.userId.name,
      email: coupon.userId.email,
      mobileNo: coupon.userId.mobileNo
    } : null,

    // Timestamps
    createdAt: coupon.createdAt,
    updatedAt: coupon.updatedAt
  };

  res.ok(formattedCoupon,"Coupon fetched successfully");
});

// @desc    Get All active coupons
// @route   GET /api/coupons/public/get-all
// @access  Public
exports.getAllActiveCoupons = asyncHandler(async (req, res, next) => {
  const { couponType, search } = req.query;
  const currentDate = new Date();
  
  // CORRECTED: Check both activation and expiry dates
  const filter = { 
    isDeleted: false, 
    isActive: true, 
    activationDate: { $lte: currentDate }, // Current date should be after activation
    expiryDate: { $gte: currentDate } // Current date should be before expiry
  };

  // Handle coupon type filtering
  if (couponType) {
    if (couponType === 'services') filter.couponType = { $in: ['services', 'both'] };
    else if (couponType === 'products') filter.couponType = { $in: ['products', 'both'] };
    else filter.couponType = couponType;
  }

  let coupons;

  if (search) {
    const regex = new RegExp(search, 'i'); // for partial matches

    coupons = await Coupon.aggregate([
      { $match: filter },
      {
        $addFields: {
          relevance: {
            $switch: {
              branches: [
                {
                  case: { $eq: [{ $toUpper: "$couponCode" }, search.toUpperCase()] },
                  then: 3, // exact match
                },
                {
                  case: {
                    $regexMatch: {
                      input: "$couponCode",
                      regex: new RegExp(`^${search}`, "i"),
                    },
                  },
                  then: 2, // starts with
                },
                {
                  case: {
                    $regexMatch: {
                      input: "$couponCode",
                      regex,
                    },
                  },
                  then: 1, // contains
                },
              ],
              default: 0, // no match
            },
          },
        },
      },
      { $sort: { relevance: -1, createdAt: -1 } },
      {
        $project: {
          couponName: 1,
          couponCode: 1,
          discountIn: 1,
          discount: 1,
          relevance: 1,
        },
      },
    ]);
  } else {
    coupons = await Coupon.find(filter)
      .select("couponName couponCode discountIn discount")
      .sort({ createdAt: -1 });
  }

  if (!coupons || coupons.length === 0)
    return res.ok([], "No active coupons found");

  res.ok(coupons, "Coupons fetched successfully");
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
        'applyAllProducts', 'applicableProducts', 'applicableProductCategories'
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
// exports.applyServiceCoupon = asyncHandler(async (req, res, next) => {
//   const { couponCode, services = [] } = req.body;
//   const userId = req.user._id;

//   if (!couponCode || !Array.isArray(services) || services.length === 0)
//     return next(new ErrorHandler("Please provide couponCode and services", 400));

//   // Find coupon
//   const coupon = await Coupon.findOne({
//     couponCode: couponCode.toUpperCase(),
//     isActive: true,
//     isDeleted: false,
//     couponType: "services"
//   });

//   if (!coupon) return next(new ErrorHandler("Invalid or inactive coupon", 400));

//   const now = new Date();
//   if (now < coupon.activationDate || now > coupon.expiryDate)
//     return next(new ErrorHandler("Coupon is not active or expired", 400));

//   // Check usage limits
//   const usedCount = await ServiceOrder.countDocuments({
//     user: userId,
//     coupon: coupon._id
//   });
//   if (usedCount >= coupon.redemptionPerUser)
//     return next(new ErrorHandler("You have already used this coupon", 400));

//   // Get all service details
//   const serviceDocs = await Service.find({ _id: { $in: services }, isDeleted: false });
//   if (!serviceDocs.length) return next(new ErrorHandler("Invalid service IDs", 400));

//   // Eligibility logic
//   let eligible = false;
//   let eligibleServices = [];

//   if (coupon.applyAllServices) {
//     eligible = true;
//     eligibleServices = serviceDocs;
//   } else {
//     // Match specific service/category applicability
//     eligibleServices = serviceDocs.filter(svc =>
//       coupon.applicableServices.includes(svc._id) ||
//       coupon.applicableServiceCategories.includes(svc.category)
//     );
//     eligible = eligibleServices.length > 0;
//   }

//   if (!eligible) return next(new ErrorHandler("Coupon not applicable to selected services", 400));

//   // Calculate discount
//   const total = eligibleServices.reduce((acc, svc) => acc + svc.price, 0);
//   let discountAmount = 0;

//   if (coupon.discountIn === "percent") {
//     discountAmount = (total * coupon.discount) / 100;
//   } else {
//     discountAmount = coupon.discount;
//   }

//   const finalTotal = total - discountAmount;

// //   res.success(
// //     {
// //       couponCode: coupon.couponCode,
// //       discountIn: coupon.discountIn,
// //       discountValue: coupon.discount,
// //       originalTotal: total,
// //       discountAmount,
// //       finalTotal,
// //     },
// //     "Coupon applied successfully"
// //   );

// res.ok({
//     couponCode: coupon.couponCode,
//     discountIn: coupon.discountIn,
//     discountValue: coupon.discount,
//     originalTotal: total,
//     discountAmount,
//     finalTotal
// }, "Coupon applied");

// });

// Helper function to validate service applicability
async function validateServiceApplicability(coupon, requestedServiceIds) {
  // If coupon applies to all services
  if (coupon.applyAllServices) {
    return {
      isApplicable: true,
      applicableServiceIds: requestedServiceIds,
      message: "Coupon applicable to all services"
    };
  }

  // Find valid services from the requested ones
  const validServices = await Service.find({
    _id: { $in: requestedServiceIds },
    isActive: true,
    isDeleted: false
  }).select('_id category');

  if (validServices.length === 0) {
    return {
      isApplicable: false,
      applicableServiceIds: [],
      message: "No valid services found"
    };
  }

  const validServiceIds = validServices.map(service => service._id.toString());
  const validServiceCategories = validServices.map(service => service.category.toString());

  let applicableServiceIds = [];

  // Check specific services
  if (coupon.applicableServices && coupon.applicableServices.length > 0) {
    const couponServiceIds = coupon.applicableServices.map(id => id.toString());
    const matchingServices = validServiceIds.filter(serviceId => 
      couponServiceIds.includes(serviceId)
    );
    applicableServiceIds = [...applicableServiceIds, ...matchingServices];
  }

  // Check service categories
  if (coupon.applicableServiceCategories && coupon.applicableServiceCategories.length > 0) {
    const couponCategoryIds = coupon.applicableServiceCategories.map(id => id.toString());
    
    const categoryMatchingServices = validServices
      .filter(service => couponCategoryIds.includes(service.category.toString()))
      .map(service => service._id.toString());
    
    applicableServiceIds = [...applicableServiceIds, ...categoryMatchingServices];
  }

  // Remove duplicates
  applicableServiceIds = [...new Set(applicableServiceIds)];

  if (applicableServiceIds.length === 0) {
    return {
      isApplicable: false,
      applicableServiceIds: [],
      message: "This coupon is not applicable to the selected services"
    };
  }

  return {
    isApplicable: true,
    applicableServiceIds,
    message: "Coupon applicable to selected services"
  };
}

exports.applyServiceCoupon = asyncHandler(async (req, res, next) => {
  const { couponCode, services = [] } = req.body;
  const userId = req.user._id;

  // Basic validation
  if (!couponCode || !Array.isArray(services) || services.length === 0) {
    return next(new ErrorHandler("Please provide couponCode and services", 400));
  }

  try {
    // 1. Find the coupon
    const coupon = await Coupon.findOne({
      couponCode: couponCode.toUpperCase().trim(),
      isActive: true,
      isDeleted: false
    });

    if (!coupon) {
      return next(new ErrorHandler("Invalid coupon code", 400));
    }

    // 2. Check coupon type
    if (coupon.couponType !== 'services' && coupon.couponType !== 'both') {
      return next(new ErrorHandler("This coupon is not applicable for services", 400));
    }

    // 3. Check activation and expiry dates
    const currentDate = new Date();
    if (currentDate < coupon.activationDate) {
      return next(new ErrorHandler("This coupon is not active yet", 400));
    }

    if (currentDate > coupon.expiryDate) {
      return next(new ErrorHandler("This coupon has expired", 400));
    }

    // 4. Check total redemption limit
    if (
      coupon.totalRedemptions &&
      coupon.totalRedemptions > 0 &&
      (await ServiceOrder.countDocuments({ coupon: coupon._id })) >= coupon.totalRedemptions
    ) {
      return next(new ErrorHandler("Coupon usage limit reached", 400));
    }

    // 5. Check user-specific redemption limit
    const userCouponUsage = await ServiceOrder.countDocuments({
      user: userId,
      coupon: coupon._id,
      paymentStatus: { $in: ['paid', 'pending'] } // Count both paid and pending orders
    });

    if (userCouponUsage >= coupon.redemptionPerUser) {
      return next(new ErrorHandler("You have already used this coupon maximum times", 400));
    }

    // 6. Validate service applicability
    const serviceApplicability = await validateServiceApplicability(coupon, services);
    
    if (!serviceApplicability.isApplicable) {
      return next(new ErrorHandler(serviceApplicability.message, 400));
    }

    // 7. Get applicable services and calculate discount
    const applicableServices = await Service.find({
      _id: { $in: serviceApplicability.applicableServiceIds },
      isActive: true,
      isDeleted: false
    });

    const totalAmount = applicableServices.reduce((sum, service) => sum + service.price, 0);
    
    // Calculate discount
    let discountAmount = 0;
    let finalAmount = totalAmount;

    if (coupon.discountIn === 'percent') {
      discountAmount = (totalAmount * coupon.discount) / 100;
      finalAmount = totalAmount - discountAmount;
    } else if (coupon.discountIn === 'amount') {
      discountAmount = Math.min(coupon.discount, totalAmount); // Prevent negative amount
      finalAmount = totalAmount - discountAmount;
    }

    // Ensure final amount is not negative
    finalAmount = Math.max(0, finalAmount);

    // 8. Return successful response with discount details
    res.status(200).json({
      success: true,
      message: "Coupon applied successfully",
      data: {
        coupon: {
          _id: coupon._id,
          couponName: coupon.couponName,
          couponCode: coupon.couponCode,
          couponType: coupon.couponType,
          discountIn: coupon.discountIn,
          discountValue: coupon.discount,
          discountAmount,
          totalAmount,
          finalAmount,
          applicableServices: serviceApplicability.applicableServiceIds
        }
      }
    });

  } catch (error) {
    return next(new ErrorHandler("Error applying coupon: " + error.message, 500));
  }
});

// @desc    Apply coupon for products
// @route   POST /api/coupons/apply/product
// @access  Private/User
// exports.applyProductCoupon = asyncHandler(async (req, res, next) => {
//   const { couponCode, products = [] } = req.body;
//   const userId = req.user._id;

//   if (!couponCode || !Array.isArray(products) || products.length === 0)
//     return next(new ErrorHandler("Please provide couponCode and products", 400));

//   // Find coupon
//   const coupon = await Coupon.findOne({
//     couponCode: couponCode.toUpperCase(),
//     isActive: true,
//     isDeleted: false,
//     couponType: { $in: ["products", "both"] }
//   });

//   if (!coupon) return next(new ErrorHandler("Invalid or inactive coupon", 400));

//   const now = new Date();
//   if (now < coupon.activationDate || now > coupon.expiryDate)
//     return next(new ErrorHandler("Coupon is not active or expired", 400));

//   // Check usage limits
//   const usedCount = await ProductOrder.countDocuments({
//     user: userId,
//     coupon: coupon._id
//   });
//   if (usedCount >= coupon.redemptionPerUser)
//     return next(new ErrorHandler("You have already used this coupon", 400));

//   // Get all product details
//   const productDocs = await Product.find({ _id: { $in: products }, isDeleted: false });
//   if (!productDocs.length) return next(new ErrorHandler("Invalid product IDs", 400));

//   // Eligibility logic
//   let eligible = false;
//   let eligibleProducts = [];

//   if (coupon.applyAllProducts) {
//     eligible = true;
//     eligibleProducts = productDocs;
//   } else {
//     // Match specific product/category/subcategory applicability
//     eligibleProducts = productDocs.filter(p =>
//       coupon.applicableProducts.includes(p._id) ||
//       coupon.applicableProductCategories.includes(p.category) ||
//       coupon.applicableProductSubcategories.includes(p.subcategory)
//     );
//     eligible = eligibleProducts.length > 0;
//   }

//   if (!eligible)
//     return next(new ErrorHandler("Coupon not applicable to selected products", 400));

//   // Calculate discount
//   const total = eligibleProducts.reduce((acc, p) => acc + p.sellingPrice, 0);
//   let discountAmount = 0;

//   if (coupon.discountIn === "percent") {
//     discountAmount = (total * coupon.discount) / 100;
//   } else {
//     discountAmount = coupon.discount;
//   }

//   const finalTotal = total - discountAmount;

// //   res.success(
// //     {
// //       couponCode: coupon.couponCode,
// //       discountIn: coupon.discountIn,
// //       discountValue: coupon.discount,
// //       originalTotal: total,
// //       discountAmount,
// //       finalTotal,
// //     },
// //     "Coupon applied successfully"
// //   );

//   res.ok({
//     couponCode: coupon.couponCode,
//     discountIn: coupon.discountIn,
//     discountValue: coupon.discount,
//     originalTotal: total,
//     discountAmount,
//     finalTotal
//   }, "Coupon applied");

// });
exports.applyProductCoupon = asyncHandler(async (req, res, next) => {
  const { couponCode, products = [] } = req.body;
  const userId = req.user._id;

  // Basic validation
  if (!couponCode || !Array.isArray(products) || products.length === 0) {
    return next(new ErrorHandler("Please provide couponCode and products", 400));
  }

  try {
    // 1. Find the coupon
    const coupon = await Coupon.findOne({
      couponCode: couponCode.toUpperCase().trim(),
      isActive: true,
      isDeleted: false
    });

    if (!coupon) {
      return next(new ErrorHandler("Invalid coupon code", 400));
    }

    // 2. Check coupon type
    if (coupon.couponType !== 'products' && coupon.couponType !== 'both') {
      return next(new ErrorHandler("This coupon is not applicable for products", 400));
    }

    // 3. Check activation and expiry dates
    const currentDate = new Date();
    if (currentDate < coupon.activationDate) {
      return next(new ErrorHandler("This coupon is not active yet", 400));
    }

    if (currentDate > coupon.expiryDate) {
      return next(new ErrorHandler("This coupon has expired", 400));
    }

    // 4. Check total redemption limit
    console.log( coupon.totalRedemptions, coupon.redemptionPerUser)
    if (
      coupon.totalRedemptions &&
      coupon.totalRedemptions > 0 &&
      (await ProductOrder.countDocuments({ coupon: coupon._id })) >= coupon.totalRedemptions
    ) {
      return next(new ErrorHandler("Coupon usage limit reached", 400));
    }

    // 5. Check user-specific redemption limit
    const userCouponUsage = await ProductOrder.countDocuments({
      user: userId,
      coupon: coupon._id,
      paymentStatus: { $in: ['PAID', 'PENDING'] }
    });

    if (userCouponUsage >= coupon.redemptionPerUser) {
      return next(new ErrorHandler("You have already used this coupon maximum times", 400));
    }

    // 6. Validate product applicability
    const productApplicability = await validateProductApplicability(coupon, products);
    
    if (!productApplicability.isApplicable) {
      return next(new ErrorHandler(productApplicability.message, 400));
    }

    // 7. Get applicable products and calculate discount
    const applicableProducts = await Product.find({
      _id: { $in: productApplicability.applicableProductIds },
      isActive: true,
      isDeleted: false
    }).select('_id name sellingPrice mrpPrice category');

    // Calculate total amount from requested products (considering quantities)
    let totalAmount = 0;
    const productDetails = [];

    applicableProducts.forEach(product => {
      const requestedProduct = products.find(p => p.productId.toString() === product._id.toString());
      if (requestedProduct) {
        const quantity = requestedProduct.quantity || 1;
        const subtotal = product.sellingPrice * quantity;
        totalAmount += subtotal;
        
        productDetails.push({
          productId: product._id,
          name: product.name,
          sellingPrice: product.sellingPrice,
          quantity: quantity,
          subtotal: subtotal
        });
      }
    });

    // Calculate discount
    let discountAmount = 0;
    let finalAmount = totalAmount;

    if (coupon.discountIn === 'percent') {
      discountAmount = (totalAmount * coupon.discount) / 100;
      finalAmount = totalAmount - discountAmount;
    } else if (coupon.discountIn === 'amount') {
      discountAmount = Math.min(coupon.discount, totalAmount); // Prevent negative amount
      finalAmount = totalAmount - discountAmount;
    }

    // Ensure final amount is not negative
    finalAmount = Math.max(0, finalAmount);

    // 8. Return successful response with discount details
    res.status(200).json({
      success: true,
      message: "Coupon applied successfully",
      data: {
        coupon: {
          _id: coupon._id,
          couponName: coupon.couponName,
          couponCode: coupon.couponCode,
          couponType: coupon.couponType,
          discountIn: coupon.discountIn,
          discountValue: coupon.discount,
          discountAmount,
          totalAmount,
          finalAmount,
          applicableProducts: productApplicability.applicableProductIds,
          productDetails
        }
      }
    });

  } catch (error) {
    return next(new ErrorHandler("Error applying coupon: " + error.message, 500));
  }
});

// Helper function to validate product applicability
async function validateProductApplicability(coupon, requestedProducts) {
  const requestedProductIds = requestedProducts.map(p => p.productId);

  // If coupon applies to all products
  if (coupon.applyAllProducts) {
    return {
      isApplicable: true,
      applicableProductIds: requestedProductIds,
      message: "Coupon applicable to all products"
    };
  }

  // Find valid products from the requested ones
  const validProducts = await Product.find({
    _id: { $in: requestedProductIds },
    isActive: true,
    isDeleted: false
  }).select('_id category');

  if (validProducts.length === 0) {
    return {
      isApplicable: false,
      applicableProductIds: [],
      message: "No valid products found"
    };
  }

  const validProductIds = validProducts.map(product => product._id.toString());
  const validProductCategories = validProducts.map(product => product.category.toString());
  // const validProductSubcategories = validProducts.map(product => product.subcategory.toString());

  let applicableProductIds = [];

  // Check specific products
  if (coupon.applicableProducts && coupon.applicableProducts.length > 0) {
    const couponProductIds = coupon.applicableProducts.map(id => id.toString());
    const matchingProducts = validProductIds.filter(productId => 
      couponProductIds.includes(productId)
    );
    applicableProductIds = [...applicableProductIds, ...matchingProducts];
  }

  // Check product categories
  if (coupon.applicableProductCategories && coupon.applicableProductCategories.length > 0) {
    const couponCategoryIds = coupon.applicableProductCategories.map(id => id.toString());
    
    const categoryMatchingProducts = validProducts
      .filter(product => couponCategoryIds.includes(product.category.toString()))
      .map(product => product._id.toString());
    
    applicableProductIds = [...applicableProductIds, ...categoryMatchingProducts];
  }

  // Check product subcategories
  // if (coupon.applicableProductSubcategories && coupon.applicableProductSubcategories.length > 0) {
  //   const couponSubcategoryIds = coupon.applicableProductSubcategories.map(id => id.toString());
    
  //   const subcategoryMatchingProducts = validProducts
  //     .filter(product => couponSubcategoryIds.includes(product.subcategory.toString()))
  //     .map(product => product._id.toString());
    
  //   applicableProductIds = [...applicableProductIds, ...subcategoryMatchingProducts];
  // }

  // Remove duplicates
  applicableProductIds = [...new Set(applicableProductIds)];

  if (applicableProductIds.length === 0) {
    return {
      isApplicable: false,
      applicableProductIds: [],
      message: "This coupon is not applicable to the selected products"
    };
  }

  return {
    isApplicable: true,
    applicableProductIds,
    message: "Coupon applicable to selected products"
  };
}