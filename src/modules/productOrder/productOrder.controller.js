const asyncHandler = require('express-async-handler');
const Transaction = require('../transaction/transaction.Model');
const ProductOrder = require('./productOrder.model');
const Product = require('../product/product.model');
const mongoose = require('mongoose');
const ErrorHandler = require('../../utils/errorHandler');
const Coupon = require('../coupon/coupon.model');
const ServiceOrder = require('../serviceOrder/serviceOrder.model');
const moment = require('moment');


// @desc    checkout a product order
// @route   POST /api/product-order/checkout
// @access  Private (customer)
exports.checkoutProductOrder = asyncHandler(async (req, res) => { });

// @desc    Create a new product order
// @route   POST /api/product-order/create
// @access  Private (customer)
exports.createProductOrder = asyncHandler(async (req, res) => {
  const { items, address, paymentMethod, paymentDetails, couponId } = req.body;
  // --------------- ✅ Validate Coupon (if provided) ----------------
  let coupon = null;
  if (couponId) {
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      throw new Error('Invalid couponId');
    }

    coupon = await Coupon.findOne({ _id: couponId, isDeleted: false });
    if (!coupon) {
      return res.ok([], 'Coupon not found');
    }

    if (!coupon.isActive) {
      throw new Error('Coupon is inactive');
    }

    const now = new Date();
    if (coupon.activationDate && now < coupon.activationDate) {
      throw new Error('Coupon is not yet active');
    }
    if (coupon.expiryDate && now > coupon.expiryDate) {
      throw new Error('Coupon has expired');
    }

    if (!['products'].includes(coupon.couponType)) {
      throw new Error('Coupon not applicable for products');
    }

    // Check redemption limits
    const [userProductUses, userServiceUses, totalProductUses, totalServiceUses] = await Promise.all([
      ProductOrder.countDocuments({ user: userId, coupon: couponId }),
      ServiceOrder.countDocuments({ user: userId, coupon: couponId }),
      ProductOrder.countDocuments({ coupon: couponId }),
      ServiceOrder.countDocuments({ coupon: couponId })
    ]);

    const userTotalUses = userProductUses + userServiceUses;
    const globalTotalUses = totalProductUses + totalServiceUses;

    if (coupon.redemptionPerUser && coupon.redemptionPerUser > 0 && userTotalUses >= coupon.redemptionPerUser) {
      throw new Error('Coupon redemption limit reached for this user');
    }

    if (coupon.totalRedemptions && coupon.totalRedemptions > 0 && globalTotalUses >= coupon.totalRedemptions) {
      throw new Error('Coupon redemption limit reached');
    }
  }
  const userId = req.user._id; // assuming you set req.user in auth middleware

  if (!items || items.length === 0) {
    res.status(400);
    throw new Error('No items in order');
  }

  // Start session for transaction safety
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product).populate('category', 'name').populate('subcategory', 'name').session(session);
      console.log(product._id);
      if (!product || !product.isActive) {
        throw new Error(`Product not found: ${item.product}`);
      }

      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      const subtotal = product.sellingPrice * item.quantity;
      totalAmount += subtotal;

      // Snapshot product data
      const snapshot = {
        name: product.name,
        categoryName: product.category?.name || '', // optional
        subCategoryName: product.subcategory?.name || '',
        mrpPrice: product.mrpPrice,
        sellingPrice: product.sellingPrice,
        stock: product.stock,
        images: product.images?.[0] || null,
      };

      orderItems.push({
        product: product._id,
        snapshot,
        quantity: item.quantity,
        subtotal,
      });

      // Deduct stock
      product.stock -= item.quantity;
      await product.save({ session });
    }

    // GST & amounts (dummy logic, adjust as needed)
    const gst = totalAmount * 0.18; // 18%
    const finalAmount = totalAmount + gst;

    // Create order
    const productOrderPayload = {
      user: userId,
      items: orderItems,
      totalAmount,
      finalAmount,
      payingAmount: finalAmount + (coupon ? coupon.discount : 0),
      isCoupon: coupon ? true : false,
      coupon: coupon ? coupon._id : null,
      amount: {
        currency: 'INR',
        gst,
        basePrice: totalAmount,
      },
      address,
      paymentMethod,
      paymentDetails: paymentDetails || {},
      orderStatus: 'PENDING',
      paymentStatus: paymentMethod === 'COD' ? 'PENDING' : 'PAID',
    };

    if (couponId && mongoose.Types.ObjectId.isValid(couponId)) {
      productOrderPayload.coupon = couponId;
    }

    const productOrder = new ProductOrder(productOrderPayload);

    const savedOrder = await productOrder.save({ session });

    // Create transaction entry
    const transaction = new Transaction({
      from: 'product',
      productOrderId: savedOrder._id,
      type: paymentMethod,
      status: paymentMethod === 'COD' ? 'unpaid' : 'paid',
      // amount: productOrder.paymentStatus === 'PAID' ? finalAmount : 0,
      amount: productOrder.paymentStatus === 'CASH' ? finalAmount : 0,
      pendingAmount: finalAmount,
      payingAmount: finalAmount + (coupon ? coupon.discount : 0),
      isCoupon: coupon ? true : false,
      paymentId: paymentDetails?.transactionId || new mongoose.Types.ObjectId().toString(),
      userId,
      paymentDetails: paymentDetails || {},
    });

    await transaction.save({ session });

    // remove all from cart
    await ProductCart.deleteMany({ user: userId }, { session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order: savedOrder,
        transaction,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(400);
    throw new Error(error.message || 'Failed to create order');
  }
});

// @desc    Get all product orders for a user
// @route   GET /api/product-order/get-all
// @access  Private (customer)
exports.getProductOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const userId = req.user._id;

  // Fetch orders with product populated
  const orders = await ProductOrder.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('address')
    .populate({
      path: 'items.product',
      select: 'name category subcategory stock images isActive', // select only needed fields
      populate: [
        { path: 'category', select: 'name' },
        { path: 'subcategory', select: 'name' },
      ],
    });

  const totalOrders = await ProductOrder.countDocuments({ user: userId });

  const destructuredOrders = orders.map(order => ({
    _id: order._id,
    items: order.items.map(item => ({
      _id: item._id,
      product: item.product
        ? {
          _id: item.product._id,
          name: item.product.name,
          category: item.product.category?.name || null,
          subcategory: item.product.subcategory?.name || null,
          images: item.product.images,
          // ✅ Only prices from snapshot
          mrpPrice: item.snapshot?.mrpPrice,
          sellingPrice: item.snapshot?.sellingPrice,
          quantity: item.quantity,
          subtotal: item.subtotal,
        }
        : null,
    })),
    totalAmount: order.totalAmount,
    finalAmount: order.finalAmount,
    amount: {
      currency: order.amount?.currency,
      gst: order.amount?.gst,
      basePrice: order.amount?.basePrice,
    },
    address: order.address
      ? {
        _id: order.address._id,
        line1: order.address.line1,
        line2: order.address.line2,
        city: order.address.city,
        state: order.address.state,
        pincode: order.address.pincode,
        country: order.address.country,
      }
      : null,
    paymentMethod: order.paymentMethod,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentDetails: order.paymentDetails || {},
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }));

  res.paginated(
    destructuredOrders,
    { page, limit, total: totalOrders, pages: Math.ceil(totalOrders / limit) },
    'Orders fetched successfully'
  );
});

// @desc    Get a single product order by ID
// @route   GET /api/product-order/get-single/:id
// @access  Private (customer)
exports.getProductOrderById = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const orderId = req.query.id;

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    res.status(400);
    throw new Error('Invalid order ID');
  }

  const order = await ProductOrder.findOne({ _id: orderId, user: userId })
    .populate('address')
    .populate({
      path: 'items.product',
      select: 'name category subcategory stock images isActive',
      populate: [
        { path: 'category', select: 'name' },
        { path: 'subcategory', select: 'name' },
      ],
    });

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // ✅ Destructure same as getProductOrders
  const destructuredOrder = {
    _id: order._id,
    items: order.items.map(item => ({
      _id: item._id,
      product: item.product
        ? {
          _id: item.product._id,
          name: item.product.name,
          category: item.product.category?.name || null,
          subcategory: item.product.subcategory?.name || null,
          images: item.product.images,
          // ✅ prices from snapshot
          mrpPrice: item.snapshot?.mrpPrice,
          sellingPrice: item.snapshot?.sellingPrice,
          quantity: item.quantity,
          subtotal: item.subtotal,
        }
        : null,
    })),
    totalAmount: order.totalAmount,
    finalAmount: order.finalAmount,
    amount: {
      currency: order.amount?.currency,
      gst: order.amount?.gst,
      basePrice: order.amount?.basePrice,
    },
    address: order.address
      ? {
        _id: order.address._id,
        line1: order.address.line1,
        line2: order.address.line2,
        city: order.address.city,
        state: order.address.state,
        pincode: order.address.pincode,
        country: order.address.country,
      }
      : null,
    paymentMethod: order.paymentMethod,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    paymentDetails: order.paymentDetails || {},
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };

  res.ok(destructuredOrder, 'Order fetched successfully');
});

// @desc    Get all product orders (admin)
// @route   GET /api/product-order/get-all
// @access  Private (admin)
exports.getAllProductOrdersAdmin = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const filters = {};
  if (req.query.status) {
    filters.orderStatus = req.query.status;
  }
  if (req.query.date) {
    filters.createdAt = {
      $gte: moment(req.query.date).startOf('day').toDate(),
      $lte: moment(req.query.date).endOf('day').toDate(),
    };
  }
  if (req.query.orderId) {
    filters._id = req.query.orderId;
  }
  if (req.query.name) {
    filters['items.snapshot.name'] = { $regex: req.query.name, $options: 'i' };
  }

  // 🔹 Fetch orders with user + profile + address populated
  const orders = await ProductOrder.find(filters)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({
      path: 'user',
      select: 'email role profile',
      populate: {
        path: 'profile',
        model: 'customer', // since role = customer
        select: 'firstName lastName fullName gender',
      },
    })
    .populate('address');

  // 🔹 Restructure items with snapshots
  const formattedOrders = orders.map(order => {
    const formattedItems = order.items.map(item => {
      return {
        _id: item._id,
        quantity: item.quantity,
        subtotal: item.subtotal,
        product: {
          _id: item.product?._id,
          name: item.snapshot?.name || item.product?.name,
          categoryName: item.snapshot?.categoryName,
          subCategoryName: item.snapshot?.subCategoryName,
          stock: item.snapshot?.stock ?? item.product?.stock,
          images: item.snapshot?.images || (item.product?.images?.[0] || null),
        },
        // Always take prices from snapshot
        mrpPrice: item.snapshot?.mrpPrice,
        sellingPrice: item.snapshot?.sellingPrice,
      };
    });

    return {
      _id: order._id,
      user: {
        _id: order.user._id,
        email: order.user.email,
        firstName: order.user.profile?.firstName,
        lastName: order.user.profile?.lastName,
      },
      address: order.address ? {
        _id: order.address._id,
        firstName: order.address.firstName,
        lastName: order.address.lastName,
        phoneNumber: order.address.phoneNumber,
        address: order.address.address,
        city: order.address.city,
        state: order.address.state,
        country: order.address.country,
        postalCode: order.address.postalCode,
        addressType: order.address.addressType,
      } : null,
      items: formattedItems,
      totalAmount: order.totalAmount,
      finalAmount: order.finalAmount,
      amount: order.amount,
      paymentMethod: order.paymentMethod,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  });

  const totalOrders = await ProductOrder.countDocuments(filters);

  res.paginated(formattedOrders, {
    page,
    limit,
    total: totalOrders,
    pages: Math.ceil(totalOrders / limit),
  });
});

// @desc    Get a single product order by ID (admin)
// @route   GET /api/product-order/get-single/:id
// @access  Private (admin)
exports.getProductOrderByIdAdmin = asyncHandler(async (req, res) => {

  res.ok({}, 'Order found');
});

// @desc    Update order status (admin)
// @route   POST /api/product-order/update-order-status
// @access  Private (admin)
exports.updateOrderStatusAdmin = asyncHandler(async (req, res, next) => {
  const { orderId, status } = req.body;

  // check order id validity
  const order = await ProductOrder.findById(orderId);
  if (!order) return next(new ErrorHandler('Order not found', 404));

  // ensure order status flow is like this: "['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'],"
  if (!['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'].includes(status)) return next(new ErrorHandler('Invalid order status', 400));

  if (order.orderStatus === status) return next(new ErrorHandler('Order status already updated', 400));

  order.orderStatus = status;
  order.orderHistory.push({
    status: status,
    timestamp: Date.now(),
  });
  await order.save();

  res.ok({}, 'Order status updated successfully');
});

// @desc    Accept a product order (admin)
// @route   POST /api/product-order/accept-order
// @access  Private (admin)
exports.acceptOrderAdmin = asyncHandler(async (req, res) => { });

// @desc    Reject a product order (admin)
// @route   POST /api/product-order/reject-order
// @access  Private (admin)
exports.rejectOrderAdmin = asyncHandler(async (req, res) => { });

// @desc    Cancel a product order (admin)
// @route   POST /api/product-order/cancel-order
// @access  Private (admin)
exports.cancelOrderAdmin = asyncHandler(async (req, res) => { });