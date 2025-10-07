const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const ServiceOrder = require('./serviceOrder.model');
const ServiceOrderItem = require('./serviceOrderItem.model');
const Service = require('../service/service.model');
const Transaction = require('../transaction/transaction.Model');
const User = require('../auth/user.Model');
const Employee = require('../employeeUser/employeeUser.model');
const ErrorHandler = require('../../utils/errorHandler');
const moment = require('moment');
const Coupon = require('../coupon/coupon.model');
const ProductOrder = require('../productOrder/productOrder.model');

// @desc Create Service Order (Buy Now - Multiple Services)
// @route POST /api/service-order/create
// @access Customer
// exports.createServiceOrder = asyncHandler(async (req, res, next) => {
//   const userId = req.user._id;
//   const {
//     serviceItems, // <-- array of service items
//     paymentType,
//     paymentId,
//     paymentDetails,
//     couponId,
//   } = req.body;

//   if (!Array.isArray(serviceItems) || serviceItems.length === 0) {
//     return next(new ErrorHandler('At least one service item is required', 400));
//   }

//   // --------------- ✅ Validate Coupon (if provided) ----------------
//   let coupon = null;
//   if (couponId) {
//     if (!mongoose.Types.ObjectId.isValid(couponId)) {
//       return next(new ErrorHandler('Invalid couponId', 400));
//     }

//     coupon = await Coupon.findOne({ _id: couponId, isDeleted: false });
//     if (!coupon) {
//       return next(new ErrorHandler('Coupon not found', 404));
//     }

//     if (!coupon.isActive) {
//       return next(new ErrorHandler('Coupon is inactive', 400));
//     }

//     const now = new Date();
//     if (coupon.activationDate && now < coupon.activationDate) {
//       return next(new ErrorHandler('Coupon is not yet active', 400));
//     }
//     if (coupon.expiryDate && now > coupon.expiryDate) {
//       return next(new ErrorHandler('Coupon has expired', 400));
//     }

//     if (!['services'].includes(coupon.couponType)) {
//       return next(new ErrorHandler('Coupon not applicable for services', 400));
//     }

//     // Check redemption limits
//     const [userServiceUses, userProductUses, totalServiceUses, totalProductUses] = await Promise.all([
//       ServiceOrder.countDocuments({ user: userId, coupon: couponId }),
//       ProductOrder.countDocuments({ user: userId, coupon: couponId }),
//       ServiceOrder.countDocuments({ coupon: couponId }),
//       ProductOrder.countDocuments({ coupon: couponId })
//     ]);

//     const userTotalUses = userServiceUses + userProductUses;
//     const globalTotalUses = totalServiceUses + totalProductUses;

//     if (coupon.redemptionPerUser && coupon.redemptionPerUser > 0 && userTotalUses >= coupon.redemptionPerUser) {
//       return next(new ErrorHandler('Coupon redemption limit reached for this user', 400));
//     }

//     if (coupon.totalRedemptions && coupon.totalRedemptions > 0 && globalTotalUses >= coupon.totalRedemptions) {
//       return next(new ErrorHandler('Coupon redemption limit reached', 400));
//     }
//   }

//   // --------------- ✅ Process Each Service Item ----------------
//   let totalAmount = 0;
//   const createdOrderItems = [];

//   for (const item of serviceItems) {
//     const {
//       serviceId,
//       astrologerId,
//       bookingDate,
//       startTime,
//       firstName,
//       lastName,
//       email,
//       phone,
//       address
//     } = item;

//     if (!mongoose.Types.ObjectId.isValid(serviceId)) {
//       return next(new ErrorHandler('Invalid serviceId', 400));
//     }
//     if (!mongoose.Types.ObjectId.isValid(astrologerId)) {
//       return next(new ErrorHandler('Invalid astrologerId', 400));
//     }
//     if (!bookingDate || !startTime) {
//       return next(new ErrorHandler('Booking date and start time are required', 400));
//     }

//     // Fetch service
//     const service = await Service.findById(serviceId);
//     if (!service) return next(new ErrorHandler('Service not found', 404));

//     // check serviceType for address
//     if (service.serviceType === 'pooja_at_home' && !address) {
//       return next(new ErrorHandler('Please provide address', 400));
//     }

//     // Fetch astrologer
//     const astrologer = await User.findById(astrologerId).populate('profile');
//     if (!astrologer || astrologer.profile.employeeType !== 'astrologer') {
//       return next(new ErrorHandler('Astrologer not found', 404));
//     }

//     // --------------- ✅ Day Check ----------------
//     const bookingDay = moment(bookingDate).format('dddd');
//     if (!astrologer.profile.days.includes(bookingDay)) {
//       return next(new ErrorHandler(`Astrologer not available on ${bookingDay}`, 400));
//     }

//     // --------------- ✅ Time Window Check ----------------
//     const serviceDuration = parseInt(service.durationInMinutes, 10);
//     const bookingStart = moment(`${bookingDate} ${startTime}`, 'YYYY-MM-DD HH:mm');
//     const bookingEnd = moment(bookingStart).add(serviceDuration, 'minutes');

//     const astrologerStart = moment(`${bookingDate} ${astrologer.profile.startTime}`, 'YYYY-MM-DD HH:mm');
//     const astrologerEnd = moment(`${bookingDate} ${astrologer.profile.endTime}`, 'YYYY-MM-DD HH:mm');

//     if (bookingStart.isBefore(astrologerStart) || bookingEnd.isAfter(astrologerEnd)) {
//       return next(new ErrorHandler('Please select a time slot within the astrologer\'s available time window', 400));
//     }

//     // --------------- ✅ Pre-Booking Check ----------------
//     if (astrologer.profile.preBooking) {
//       const now = moment();
//       const diffHours = bookingStart.diff(now, 'hours');
//       if (diffHours < astrologer.profile.preBooking) {
//         return next(new ErrorHandler(`Booking must be at least ${astrologer.profile.preBooking} hours in advance`, 400));
//       }
//     }

//     // --------------- ✅ Overlap Check ----------------
//     const overlapBooking = await ServiceOrderItem.findOne({
//       astrologer: astrologerId,
//       bookingDate: { $eq: bookingDate },
//       $or: [
//         {
//           startTime: { $lt: bookingEnd.format('HH:mm') },
//           endTime: { $gt: bookingStart.format('HH:mm') }
//         }
//       ]
//     });

//     if (overlapBooking) {
//       return next(new ErrorHandler('Astrologer already booked for this time slot', 400));
//     }

//     // --------------- ✅ Create Order Item ----------------
//     const orderItem = new ServiceOrderItem({
//       customerId: userId,
//       cust: { firstName, lastName, email, phone },
//       service: service._id,
//       astrologer: astrologerId,
//       snapshot: {
//         price: service.price,
//         durationInMinutes: serviceDuration
//       },
//       bookingDate: bookingDate,
//       startTime: bookingStart.format('HH:mm'),
//       endTime: bookingEnd.format('HH:mm'),
//       serviceType: service.serviceType,
//       total: service.price
//     });

//     await orderItem.save();
//     createdOrderItems.push(orderItem._id);

//     totalAmount += service.price;
//   }

//   // --------------- ✅ Create Transaction ----------------
//   const transaction = await Transaction.create({
//     from: 'service',
//     serviceId: serviceItems[0].serviceId,
//     type: paymentType || 'OTHER',
//     status: 'unpaid',
//     amount: 0, // to be filled from webhook
//     pendingAmount: totalAmount + (coupon ? coupon.discount : 0),
//     payingAmount: totalAmount + (coupon ? coupon.discount : 0),
//     isCoupon: coupon ? true : false,
//     paymentId: paymentId || `PAY-${Date.now()}`,
//     userId,
//     paymentDetails: paymentDetails || {}
//   });

//   // --------------- ✅ Create Service Order ----------------
//   const serviceOrderPayload = {
//     user: userId,
//     services: createdOrderItems,
//     paymentStatus: 'pending',
//     totalAmount,
//     finalAmount: totalAmount,
//     payingAmount: totalAmount + (coupon ? coupon.discount : 0),
//     transaction: transaction._id,
//   };

//   if (couponId && mongoose.Types.ObjectId.isValid(couponId)) {
//     serviceOrderPayload.coupon = couponId;
//     serviceOrderPayload.isCoupon = true;
//   }

//   const serviceOrder = await ServiceOrder.create(serviceOrderPayload);

//   // update each order item with serviceOrder._id
//   await ServiceOrderItem.updateMany(
//     { _id: { $in: createdOrderItems } },
//     { $set: { orderId: serviceOrder._id } }
//   );

//   res.status(201).json({
//     success: true,
//     message: 'Service order created successfully',
//     order: serviceOrder
//   });
// });

// @desc Create Service Order (Buy Now - Multiple Services)
// @route POST /api/service-order/create
// @access Customer
exports.createServiceOrder = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const {
    serviceItems, // array of service items
    paymentType,
    paymentId,
    paymentDetails,
    couponId,
  } = req.body;

  if (!Array.isArray(serviceItems) || serviceItems.length === 0) {
    return next(new ErrorHandler('At least one service item is required', 400));
  }

  // --------------- ✅ Validate Coupon (if provided) ----------------
  let coupon = null;
  if (couponId) {
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return next(new ErrorHandler('Invalid couponId', 400));
    }

    coupon = await Coupon.findOne({ _id: couponId, isDeleted: false });
    if (!coupon) return next(new ErrorHandler('Coupon not found', 404));
    if (!coupon.isActive) return next(new ErrorHandler('Coupon is inactive', 400));

    const now = new Date();
    if (coupon.activationDate && now < coupon.activationDate)
      return next(new ErrorHandler('Coupon not yet active', 400));
    if (coupon.expiryDate && now > coupon.expiryDate)
      return next(new ErrorHandler('Coupon expired', 400));

    if (!['services'].includes(coupon.couponType))
      return next(new ErrorHandler('Coupon not applicable for services', 400));

    // Check redemption limits
    const [userServiceUses, userProductUses, totalServiceUses, totalProductUses] = await Promise.all([
      ServiceOrder.countDocuments({ user: userId, coupon: couponId }),
      ProductOrder.countDocuments({ user: userId, coupon: couponId }),
      ServiceOrder.countDocuments({ coupon: couponId }),
      ProductOrder.countDocuments({ coupon: couponId }),
    ]);

    const userTotalUses = userServiceUses + userProductUses;
    const globalTotalUses = totalServiceUses + totalProductUses;

    if (coupon.redemptionPerUser && userTotalUses >= coupon.redemptionPerUser)
      return next(new ErrorHandler('Coupon redemption limit reached for this user', 400));

    if (coupon.totalRedemptions && globalTotalUses >= coupon.totalRedemptions)
      return next(new ErrorHandler('Coupon redemption limit reached', 400));
  }

  // --------------- ✅ Process Each Service Item ----------------
  let totalAmount = 0;
  const createdOrderItems = [];

  for (const item of serviceItems) {
    const {
      serviceId,
      astrologerId,
      bookingDate,
      startTime,
      firstName,
      lastName,
      email,
      phone,
      address,
    } = item;

    if (!mongoose.Types.ObjectId.isValid(serviceId))
      return next(new ErrorHandler('Invalid serviceId', 400));
    if (!mongoose.Types.ObjectId.isValid(astrologerId))
      return next(new ErrorHandler('Invalid astrologerId', 400));
    if (!bookingDate || !startTime)
      return next(new ErrorHandler('Booking date and start time required', 400));

    const service = await Service.findById(serviceId);
    if (!service) return next(new ErrorHandler('Service not found', 404));

    if (service.serviceType === 'pooja_at_home' && !address)
      return next(new ErrorHandler('Address required for pooja_at_home', 400));

    const astrologer = await User.findById(astrologerId).populate('profile');
    if (!astrologer || astrologer.profile.employeeType !== 'astrologer')
      return next(new ErrorHandler('Astrologer not found', 404));

    const bookingDay = moment(bookingDate).format('dddd');
    if (!astrologer.profile.days.includes(bookingDay))
      return next(new ErrorHandler(`Astrologer not available on ${bookingDay}`, 400));

    const serviceDuration = parseInt(service.durationInMinutes, 10);
    const bookingStart = moment(`${bookingDate} ${startTime}`, 'YYYY-MM-DD HH:mm');
    const bookingEnd = moment(bookingStart).add(serviceDuration, 'minutes');
    const astrologerStart = moment(`${bookingDate} ${astrologer.profile.startTime}`, 'YYYY-MM-DD HH:mm');
    const astrologerEnd = moment(`${bookingDate} ${astrologer.profile.endTime}`, 'YYYY-MM-DD HH:mm');

    if (bookingStart.isBefore(astrologerStart) || bookingEnd.isAfter(astrologerEnd))
      return next(new ErrorHandler('Select time within astrologer\'s available window', 400));

    if (astrologer.profile.preBooking) {
      const diffHours = bookingStart.diff(moment(), 'hours');
      if (diffHours < astrologer.profile.preBooking)
        return next(new ErrorHandler(`Booking must be at least ${astrologer.profile.preBooking} hours in advance`, 400));
    }

    const overlapBooking = await ServiceOrderItem.findOne({
      astrologer: astrologerId,
      bookingDate: { $eq: bookingDate },
      $or: [
        {
          startTime: { $lt: bookingEnd.format('HH:mm') },
          endTime: { $gt: bookingStart.format('HH:mm') },
        },
      ],
    });

    if (overlapBooking)
      return next(new ErrorHandler('Astrologer already booked for this time slot', 400));

    // ✅ Create Order Item
    const orderItem = await ServiceOrderItem.create({
      customerId: userId,
      cust: { firstName, lastName, email, phone },
      service: service._id,
      astrologer: astrologerId,
      snapshot: { price: service.price, durationInMinutes: serviceDuration },
      bookingDate,
      startTime: bookingStart.format('HH:mm'),
      endTime: bookingEnd.format('HH:mm'),
      serviceType: service.serviceType,
      total: service.price,
    });

    // ✅ Create Transaction for this item
    const transaction = await Transaction.create({
      from: 'service',
      serviceId: service._id,
      type: paymentType || 'OTHER',
      status: 'unpaid',
      amount: 0,
      pendingAmount: service.price,
      payingAmount: service.price,
      isCoupon: !!coupon,
      paymentId: `${paymentId || 'PAY'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      paymentDetails: paymentDetails || {},
    });

    // Link transaction to orderItem (if you want)
    orderItem.transaction = transaction._id;
    await orderItem.save();

    createdOrderItems.push(orderItem._id);
    totalAmount += service.price;
  }

  // ✅ Create a Single ServiceOrder (parent record)
  const serviceOrderPayload = {
    user: userId,
    services: createdOrderItems,
    paymentStatus: 'pending',
    totalAmount,
    finalAmount: totalAmount,
    payingAmount: totalAmount,
    isCoupon: !!coupon,
    coupon: coupon?._id || null,
  };

  const serviceOrder = await ServiceOrder.create(serviceOrderPayload);

  // ✅ Update all items with parent orderId
  await ServiceOrderItem.updateMany(
    { _id: { $in: createdOrderItems } },
    { $set: { orderId: serviceOrder._id } }
  );

  res.status(201).json({
    success: true,
    message: 'Service order created successfully with individual transactions per service',
    order: serviceOrder,
  });
});

// @desc Get All Service Orders (Customer)
// @route GET /api/service-order/get-all
// @access Customer
exports.getAllServiceOrders = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const orders = await ServiceOrder.find({ user: req.user._id })
    .populate({
      path: 'services',
      populate: [
        { path: 'service', model: 'Service' },
        { path: 'astrologer', model: 'User', select: 'name' } // ✅
      ]
    })
    .populate('transaction')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const destructuredOrders = orders.map((order) => ({
    orderId: order._id,
    services: order.services.map((service) => ({
      serviceId: service.service._id,
      serviceName: service.service.name,
      astrologerName: service.astrologer?.name || null,
      servicePrice: service.snapshot.price,
      durationInMinutes: service.snapshot.durationInMinutes,
      startTime: service.startTime,
      endTime: service.endTime,
      bookingDate: service.bookingDate,
      serviceType: service.serviceType,
      total: service.total,
      astrologerStatus: service.astrologerStatus,
      rejectReason: service.rejectReason || null,
      bookingStatus: service.status,
      paymentStatus: service.paymentStatus,   // ✅ added
      zoomLink: service.zoomLink || null      // ✅ added
    })),
    paymentStatus: order.paymentStatus,
    totalAmount: order.totalAmount,
    finalAmount: order.finalAmount,
    paymentId: order.transaction?.paymentId || null,
    paymentDetails: order.transaction?.paymentDetails || null,
    address: order.address || null,           // ✅ added
    createdAt: order.createdAt
  }));

  res.paginated(
    destructuredOrders,
    { page, limit, total: orders.length, pages: Math.ceil(orders.length / limit) },
    'Orders fetched successfully'
  );
});

// @desc Get Single Service Order (Customer)
// @route GET /api/service-order/get-single?id=ORDER_ID
// @access Customer
exports.getServiceOrder = asyncHandler(async (req, res, next) => {
  const { serviceId } = req.query;
  const id = req.query.id;

  const orders = await ServiceOrder.find({ _id: id, user: req.user._id })
    .populate({
      path: 'services',
      populate: [
        { path: 'service', model: 'Service' },
        { path: 'astrologer', model: 'User', select: 'name' } // ✅
      ]
    })
    .populate('transaction')
    .sort({ createdAt: -1 })
  console.log("🚀 ~ orders:", orders);

  const destructuredOrders = orders.map((order) => ({
    orderId: order._id,
    services: order.services.map((service) => ({
      serviceId: service.service._id,
      serviceImage: service.service.image,
      serviceName: service.service.name,
      astrologerName: service.astrologer?.name || null,
      servicePrice: service.snapshot.price,
      durationInMinutes: service.snapshot.durationInMinutes,
      startTime: service.startTime,
      endTime: service.endTime,
      bookingDate: service.bookingDate,
      serviceType: service.serviceType,
      total: service.total,
      astrologerStatus: service.astrologerStatus,
      rejectReason: service.rejectReason || null,
      bookingStatus: service.status,
      paymentStatus: service.paymentStatus,   // ✅ added
      zoomLink: service.zoomLink || null      // ✅ added
    })),
    paymentStatus: order.paymentStatus,
    totalAmount: order.totalAmount,
    finalAmount: order.finalAmount,
    paymentId: order.transaction?.paymentId || null,
    paymentDetails: order.transaction?.paymentDetails || null,
    address: order.address || null,           // ✅ added
    createdAt: order.createdAt
  }));

  res.paginated(
    destructuredOrders,
    'Order fetched successfully'
  );
});

// @desc Get All Service Orders (Admin)
// @route GET /api/service-order/get-all
// @access Admin
exports.getAllServiceOrdersAdmin = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  let filters = {};

  if (req.query.orderId) {
    filters._id = req.query.orderId;
  }
  if (req.query.status) {
    filters.status = req.query.status;
  }
  if (req.query.date) {
    filters.createdAt = req.query.date;
  }

  // ✅ Handle astrologerId filtering
  if (req.query.astrologerId) {
    const astrologerServices = await ServiceOrderItem.find({
      astrologer: req.query.astrologerId,
    }).select("_id");

    const serviceIds = astrologerServices.map(s => s._id);

    filters.services = { $in: serviceIds };
  }

  const orders = await ServiceOrder.find(filters)
    .populate({
      path: "services",
      populate: [
        { path: "service", model: "Service" },
        { path: "astrologer", model: "User", select: "name" },
      ],
    })
    .populate("transaction")
    .populate("address")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const destructuredOrders = orders.map((order) => ({
    orderId: order._id,
    services: order.services.map((service) => ({
      serviceId: service.service._id,
      serviceName: service.service.name,
      astrologerName: service.astrologer?.name || null,
      servicePrice: service.snapshot.price,
      durationInMinutes: service.snapshot.durationInMinutes,
      startTime: service.startTime,
      endTime: service.endTime,
      bookingDate: service.bookingDate,
      serviceType: service.serviceType,
      total: service.total,
      astrologerStatus: service.astrologerStatus,
      rejectReason: service.rejectReason || null,
      bookingStatus: service.status,
      paymentStatus: service.paymentStatus,
      zoomLink: service.zoomLink || null,
    })),
    paymentStatus: order.paymentStatus,
    totalAmount: order.totalAmount,
    finalAmount: order.finalAmount,
    paymentId: order.transaction?.paymentId || null,
    paymentDetails: order.transaction?.paymentDetails || null,
    address: order.address || null,
    createdAt: order.createdAt,
  }));

  res.paginated(
    destructuredOrders,
    { page, limit, total: orders.length, pages: Math.ceil(orders.length / limit) },
    "Orders fetched successfully"
  );
});

// @desc Update Service Order Astrologer Status (Astrologer)
// @route POST /api/service-order/astrologer/update-order-status
// @access Admin
exports.updateServiceOrderAstrologer = asyncHandler(async (req, res, next) => {
  const { serviceItemId, astrologerStatus, rejectReason } = req.body;

  // 1. Validate required fields
  if (!serviceItemId || !astrologerStatus) {
    return next(new ErrorHandler("Service Item ID and astrologerStatus are required", 400));
  }

  // 2. Validate status value
  const allowedStatuses = ["pending", "accepted", "rejected"];
  if (!allowedStatuses.includes(astrologerStatus)) {
    return next(new ErrorHandler("Invalid astrologerStatus value", 400));
  }

  // 3. Find the service item
  const serviceItem = await ServiceOrderItem.findById(serviceItemId);
  if (!serviceItem) {
    return next(new ErrorHandler("Service Order Item not found", 404));
  }

  // 4. Apply changes
  serviceItem.astrologerStatus = astrologerStatus;
  serviceItem.rejectReason = astrologerStatus === "rejected" ? rejectReason || "No reason provided" : null;

  // 5. Save
  await serviceItem.save();

  // 6. Respond
  res.ok(serviceItem, "Astrologer status updated successfully");
});

// @desc Get All Service Orders for Astrologer
// @route GET /api/service-order/astrologer/get-all
// @access Astrologer
exports.getAllServiceOrdersAstrologer = asyncHandler(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  // 🔹 Find service order items for astrologer
  const serviceItems = await ServiceOrderItem.find({ astrologer: req.user._id })
    .populate('service', 'name durationInMinutes') // service details
    .populate('astrologer', 'firstName lastName')  // astrologer details
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  // 🔹 Collect parent ServiceOrders for context (payment, totals, address, etc.)
  const orderIds = [...new Set(serviceItems.map(item => item.orderId))];
  const parentOrders = await ServiceOrder.find({ _id: { $in: orderIds } })
    .populate('user', 'email mobileNo')
    .populate('address')
    .populate('transaction');

  // 🔹 Map into structured response
  const data = serviceItems.map(item => {
    const parentOrder = parentOrders.find(o => o._id.toString() === item.orderId);

    return {
      serviceItemId: item._id,
      orderId: parentOrder?._id || null,
      serviceId: item.service?._id || null,
      serviceName: item.service?.name || null,
      astrologerName: item.astrologer ? `${item.astrologer.firstName} ${item.astrologer.lastName}` : null,
      servicePrice: item.snapshot.price,
      durationInMinutes: item.snapshot.durationInMinutes,
      startTime: item.startTime,
      endTime: item.endTime,
      bookingDate: item.bookingDate,
      serviceType: item.serviceType,
      total: item.total,
      astrologerStatus: item.astrologerStatus,
      rejectReason: item.rejectReason || null,
      bookingStatus: item.status,
      zoomLink: item.zoomLink || null,

      // Parent order details
      paymentStatus: parentOrder?.paymentStatus || null,
      totalAmount: parentOrder?.totalAmount || null,
      finalAmount: parentOrder?.finalAmount || null,
      paymentId: parentOrder?.transaction?.paymentId || null,
      paymentDetails: parentOrder?.transaction?.paymentDetails || null,
      address: parentOrder?.address || null,
      createdAt: parentOrder?.createdAt || item.createdAt
    };
  });

  res.paginated(
    data,
    { page, limit, total: serviceItems.length, pages: Math.ceil(serviceItems.length / limit) },
    "Astrologer service orders fetched successfully"
  );
});

// @desc Get Single Service Order (Astrologer)
// @route GET /api/service-order/astrologer/get-single?orderId=123
// @access Astrologer
exports.getServiceOrderAstrologer = asyncHandler(async (req, res, next) => {
  const { orderId } = req.query;

  if (!orderId) {
    return next(new ErrorHandler("Order ID is required", 400));
  }

  // 🔹 Find all service items of this order for astrologer
  const serviceItems = await ServiceOrderItem.find({
    orderId,
    astrologer: req.user._id, // only astrologer's own services
  })
    .populate("service", "name durationInMinutes")
    .populate("astrologer", "firstName lastName")
    .sort({ createdAt: -1 });

  if (!serviceItems.length) {
    return next(new ErrorHandler("No services found for this order", 404));
  }

  // 🔹 Fetch parent order
  const parentOrder = await ServiceOrder.findById(orderId)
    .populate("user", "email mobileNo")
    .populate("address")
    .populate("transaction");

  if (!parentOrder) {
    return next(new ErrorHandler("Parent service order not found", 404));
  }

  // 🔹 Map into structured response
  const data = serviceItems.map((item) => ({
    serviceItemId: item._id,
    orderId: parentOrder?._id || null,
    serviceId: item.service?._id || null,
    serviceName: item.service?.name || null,
    astrologerName: item.astrologer
      ? `${item.astrologer.firstName} ${item.astrologer.lastName}`
      : null,
    servicePrice: item.snapshot.price,
    durationInMinutes: item.snapshot.durationInMinutes,
    startTime: item.startTime,
    endTime: item.endTime,
    bookingDate: item.bookingDate,
    serviceType: item.serviceType,
    total: item.total,
    astrologerStatus: item.astrologerStatus,
    rejectReason: item.rejectReason || null,
    bookingStatus: item.status,
    zoomLink: item.zoomLink || null,

    // Parent order details
    paymentStatus: parentOrder?.paymentStatus || null,
    totalAmount: parentOrder?.totalAmount || null,
    finalAmount: parentOrder?.finalAmount || null,
    paymentId: parentOrder?.transaction?.paymentId || null,
    paymentDetails: parentOrder?.transaction?.paymentDetails || null,
    address: parentOrder?.address || null,
    createdAt: parentOrder?.createdAt || item.createdAt,
  }));

  res.status(200).json({
    success: true,
    order: data,
    message: "Astrologer service order fetched successfully",
  });
});

// @desc Get Service Order Item by ID
// @route GET /api/service-order/item/get-single?id=ITEM_ID
// @access Authenticated (role-guard via routes)
exports.getServiceOrderItemById = asyncHandler(async (req, res, next) => {
  const { id } = req.query;

  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return next(new ErrorHandler("Valid service order item id is required", 400));
  }

  // Find the service order item
  const item = await ServiceOrderItem.findById(id)
    .populate('service', 'name durationInMinutes price')
    .populate('astrologer', 'firstName lastName');

  const itemData = await ServiceOrderItem.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(id)
      }
    },
    {
      $lookup: {
        from: 'services',
        localField: 'service',
        foreignField: '_id',
        as: 'service'
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'astrologer',
        foreignField: '_id',
        as: 'astrologer'
      }
    },
    {
      $unwind: {
        path: '$service',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $unwind: {
        path: '$astrologer',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'employees',
        localField: 'astrologer.profile',
        foreignField: '_id',
        as: 'astrologer'
      }
    },
    {
      $unwind: {
        path: '$astrologer',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'customers',
        localField: 'user.profile',
        foreignField: '_id',
        as: 'customer'
      }
    },
    // Convert orderId (string) -> ObjectId for subsequent lookups
    {
      $addFields: {
        orderIdObj: {
          $convert: { input: '$orderId', to: 'objectId', onError: null, onNull: null }
        }
      }
    },
    {
      $lookup: {
        from: 'serviceorders',
        localField: 'orderIdObj',
        foreignField: '_id',
        as: 'orderData'
      }
    },
    {
      $unwind: {
        path: '$orderData',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'transactions',
        localField: 'orderData.transaction',
        foreignField: '_id',
        as: 'transaction'
      }
    },
    {
      $unwind: {
        path: '$transaction',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "customerId",
        foreignField: "_id",
        as: "user"
      }
    },
    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: "customers",
        localField: "user.profile",
        foreignField: "_id",
        as: "customer"
      }
    },
    {
      $unwind: {
        path: '$customer',
        preserveNullAndEmptyArrays: true
      }
    },

  ])

  if (!item) {
    return next(new ErrorHandler("Service Order Item not found", 404));
  }

  // Fetch parent order for payment/address context
  const parentOrder = item.orderId
    ? await ServiceOrder.findById(item.orderId)
      .populate('user', 'email mobileNo')
      .populate('address')
      .populate('transaction')
    : null;

  const data = {
    serviceItemId: item._id,
    orderId: parentOrder?._id || null,
    serviceId: item.service?._id || null,
    serviceName: item.service?.name || null,
    astrologerName: item.astrologer
      ? `${item.astrologer.firstName} ${item.astrologer.lastName}`
      : null,
    servicePrice: item.snapshot.price,
    durationInMinutes: item.snapshot.durationInMinutes,
    startTime: item.startTime,
    endTime: item.endTime,
    bookingDate: item.bookingDate,
    serviceType: item.serviceType,
    total: item.total,
    astrologerStatus: item.astrologerStatus,
    rejectReason: item.rejectReason || null,
    bookingStatus: item.status,
    paymentStatus: item.paymentStatus,
    zoomLink: item.zoomLink || null,

    // Parent order details
    parent: parentOrder
      ? {
        paymentStatus: parentOrder.paymentStatus || null,
        totalAmount: parentOrder.totalAmount || null,
        finalAmount: parentOrder.finalAmount || null,
        paymentId: parentOrder.transaction?.paymentId || null,
        paymentDetails: parentOrder.transaction?.paymentDetails || null,
        address: parentOrder.address || null,
        createdAt: parentOrder.createdAt || item.createdAt,
      }
      : null,
  };

  res.status(200).json({
    success: true,
    item: data,
    itemData,
    message: "Service order item fetched successfully",
  });
});

