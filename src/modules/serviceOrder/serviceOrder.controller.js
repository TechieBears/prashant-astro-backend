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
const { processReferralReward } = require('../../services/referral.service');
const { createMeetingForUser } = require('../../services/zoom.service');

// @desc Create Service Order (Buy Now - Multiple Services)
// @route POST /api/service-order/create
// @access Customer
// exports.createServiceOrder = asyncHandler(async (req, res, next) => {
//   const userId = req.user._id;
//   const {
//     serviceItems, // array of service items
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
//     if (!coupon) return next(new ErrorHandler('Coupon not found', 404));
//     if (!coupon.isActive) return next(new ErrorHandler('Coupon is inactive', 400));

//     const now = new Date();
//     if (coupon.activationDate && now < coupon.activationDate)
//       return next(new ErrorHandler('Coupon not yet active', 400));
//     if (coupon.expiryDate && now > coupon.expiryDate)
//       return next(new ErrorHandler('Coupon expired', 400));

//     if (!['services'].includes(coupon.couponType))
//       return next(new ErrorHandler('Coupon not applicable for services', 400));

//     // Check redemption limits
//     const [userServiceUses, userProductUses, totalServiceUses, totalProductUses] = await Promise.all([
//       ServiceOrder.countDocuments({ user: userId, coupon: couponId }),
//       ProductOrder.countDocuments({ user: userId, coupon: couponId }),
//       ServiceOrder.countDocuments({ coupon: couponId }),
//       ProductOrder.countDocuments({ coupon: couponId }),
//     ]);

//     const userTotalUses = userServiceUses + userProductUses;
//     const globalTotalUses = totalServiceUses + totalProductUses;

//     if (coupon.redemptionPerUser && userTotalUses >= coupon.redemptionPerUser)
//       return next(new ErrorHandler('Coupon redemption limit reached for this user', 400));

//     if (coupon.totalRedemptions && globalTotalUses >= coupon.totalRedemptions)
//       return next(new ErrorHandler('Coupon redemption limit reached', 400));
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
//       address,
//     } = item;

//     if (!mongoose.Types.ObjectId.isValid(serviceId))
//       return next(new ErrorHandler('Invalid serviceId', 400));
//     if (!mongoose.Types.ObjectId.isValid(astrologerId))
//       return next(new ErrorHandler('Invalid astrologerId', 400));
//     if (!bookingDate || !startTime)
//       return next(new ErrorHandler('Booking date and start time required', 400));

//     const service = await Service.findById(serviceId);
//     if (!service) return next(new ErrorHandler('Service not found', 404));

//     if (service.serviceType === 'pooja_at_home' && !address)
//       return next(new ErrorHandler('Address required for pooja_at_home', 400));

//     const astrologer = await User.findById(astrologerId).populate('profile');
//     if (!astrologer || astrologer.profile.employeeType !== 'astrologer')
//       return next(new ErrorHandler('Astrologer not found', 404));

//     const bookingDay = moment(bookingDate).format('dddd');
//     if (!astrologer.profile.days.includes(bookingDay))
//       return next(new ErrorHandler(`Astrologer not available on ${bookingDay}`, 400));

//     const serviceDuration = parseInt(service.durationInMinutes, 10);
//     const bookingStart = moment(`${bookingDate} ${startTime}`, 'YYYY-MM-DD HH:mm');
//     const bookingEnd = moment(bookingStart).add(serviceDuration, 'minutes');
//     const astrologerStart = moment(`${bookingDate} ${astrologer.profile.startTime}`, 'YYYY-MM-DD HH:mm');
//     const astrologerEnd = moment(`${bookingDate} ${astrologer.profile.endTime}`, 'YYYY-MM-DD HH:mm');

//     if (bookingStart.isBefore(astrologerStart) || bookingEnd.isAfter(astrologerEnd))
//       return next(new ErrorHandler('Select time within astrologer\'s available window', 400));

//     if (astrologer.profile.preBooking) {
//       const diffHours = bookingStart.diff(moment(), 'hours');
//       if (diffHours < astrologer.profile.preBooking)
//         return next(new ErrorHandler(`Booking must be at least ${astrologer.profile.preBooking} hours in advance`, 400));
//     }

//     const overlapBooking = await ServiceOrderItem.findOne({
//       astrologer: astrologerId,
//       bookingDate: { $eq: bookingDate },
//       $or: [
//         {
//           startTime: { $lt: bookingEnd.format('HH:mm') },
//           endTime: { $gt: bookingStart.format('HH:mm') },
//         },
//       ],
//     });

//     if (overlapBooking)
//       return next(new ErrorHandler('Astrologer already booked for this time slot', 400));


//     // ✅ Create Order Item
//     const orderItem = await ServiceOrderItem.create({
//       customerId: userId,
//       cust: { firstName, lastName, email, phone },
//       service: service._id,
//       astrologer: astrologerId,
//       snapshot: { price: service.price, durationInMinutes: serviceDuration },
//       bookingDate,
//       startTime: bookingStart.format('HH:mm'),
//       endTime: bookingEnd.format('HH:mm'),
//       serviceType: service.serviceType,
//       total: service.price,
//       address: address || null,
//     });

//     // ✅ Create Transaction for this item
//     const transaction = await Transaction.create({
//       from: 'service',
//       serviceId: service._id,
//       type: paymentType || 'OTHER',
//       status: 'unpaid',
//       amount: 0,
//       pendingAmount: service.price,
//       payingAmount: service.price,
//       isCoupon: !!coupon,
//       paymentId: `${paymentId || 'PAY'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
//       userId,
//       paymentDetails: paymentDetails || {},
//     });

//     // Link transaction to orderItem (if you want)
//     orderItem.transaction = transaction._id;
//     await orderItem.save();

//     createdOrderItems.push(orderItem._id);
//     totalAmount += service.price;
//   }

//   // ✅ Create a Single ServiceOrder (parent record)
//   const serviceOrderPayload = {
//     user: userId,
//     services: createdOrderItems,
//     paymentStatus: 'pending',
//     totalAmount,
//     finalAmount: totalAmount,
//     payingAmount: totalAmount,
//     isCoupon: !!coupon,
//     coupon: coupon?._id || null,
//   };

//   const serviceOrder = await ServiceOrder.create(serviceOrderPayload);
//   // ✅ Update all items with parent orderId
//   await ServiceOrderItem.updateMany(
//     { _id: { $in: createdOrderItems } },
//     { $set: { orderId: serviceOrder._id } }
//   );

//   // ✅ Populate and structure final response
//   const populatedOrder = await ServiceOrder.findById(serviceOrder._id)
//     .populate({
//       path: "services",
//       populate: [
//         {
//           path: "service",
//           select: "name price durationInMinutes serviceType"
//         },
//         {
//           path: "astrologer",
//           select: "name email profile",
//           populate: {
//             path: "profile",
//             select: "employeeType startTime endTime"
//           }
//         }
//       ]
//     })
//     .populate({
//       path: "coupon",
//       select: "code discount"
//     })
//     .populate({
//       path: "user",
//       select: "name email"
//     })
//     .lean();

//   // ✅ Construct clean structured response
//   const formattedOrder = {
//     _id: populatedOrder._id,
//     user: populatedOrder.user,
//     totalAmount: populatedOrder.totalAmount,
//     finalAmount: populatedOrder.finalAmount,
//     payingAmount: populatedOrder.payingAmount,
//     paymentStatus: populatedOrder.paymentStatus,
//     isCoupon: populatedOrder.isCoupon,
//     coupon: populatedOrder.coupon || null,
//     services: populatedOrder.services.map(item => ({
//       _id: item._id,
//       service: {
//         _id: item.service?._id,
//         name: item.service?.name,
//         price: item.service?.price,
//         durationInMinutes: item.service?.durationInMinutes,
//         serviceType: item.service?.serviceType
//       },
//       astrologer: {
//         _id: item.astrologer?._id,
//         name: item.astrologer?.name,
//         email: item.astrologer?.email,
//       },
//       bookingDate: item.bookingDate,
//       startTime: item.startTime,
//       endTime: item.endTime,
//       serviceType: item.serviceType,
//       paymentStatus: item.paymentStatus,
//       total: item.total
//     })),
//     createdAt: populatedOrder.createdAt,
//     updatedAt: populatedOrder.updatedAt
//   };

//   res.status(201).json({
//     success: true,
//     message: 'Service order created successfully with individual transactions per service',
//     order: formattedOrder,
//   });
// });

// exports.createServiceOrder = asyncHandler(async (req, res, next) => {
//   const userId = req.user._id;
//   const {
//     serviceItems, // array of service items
//     paymentType,
//     paymentId,
//     paymentDetails,
//     couponId,
//   } = req.body;

//   if (!Array.isArray(serviceItems) || serviceItems.length === 0) {
//     return next(new ErrorHandler('At least one service item is required', 400));
//   }

//   const session = await mongoose.startSession(); // 👈 Start session for transaction
//   session.startTransaction();

//   try {
//     // --------------- ✅ Validate Coupon (if provided) ----------------
//     let coupon = null;
//     if (couponId) {
//       if (!mongoose.Types.ObjectId.isValid(couponId)) {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new ErrorHandler('Invalid couponId', 400));
//       }

//       coupon = await Coupon.findOne({ _id: couponId, isDeleted: false });
//       if (!coupon) {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new ErrorHandler('Coupon not found', 404));
//       }
//       if (!coupon.isActive) {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new ErrorHandler('Coupon is inactive', 400));
//       }

//       const now = new Date();
//       if (coupon.activationDate && now < coupon.activationDate) {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new ErrorHandler('Coupon not yet active', 400));
//       }
//       if (coupon.expiryDate && now > coupon.expiryDate) {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new ErrorHandler('Coupon expired', 400));
//       }

//       if (!['services'].includes(coupon.couponType)) {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new ErrorHandler('Coupon not applicable for services', 400));
//       }

//       // Check redemption limits
//       const [userServiceUses, userProductUses, totalServiceUses, totalProductUses] = await Promise.all([
//         ServiceOrder.countDocuments({ user: userId, coupon: couponId }),
//         ProductOrder.countDocuments({ user: userId, coupon: couponId }),
//         ServiceOrder.countDocuments({ coupon: couponId }),
//         ProductOrder.countDocuments({ coupon: couponId }),
//       ]);

//       const userTotalUses = userServiceUses + userProductUses;
//       const globalTotalUses = totalServiceUses + totalProductUses;

//       if (coupon.redemptionPerUser && userTotalUses >= coupon.redemptionPerUser) {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new ErrorHandler('Coupon redemption limit reached for this user', 400));
//       }

//       if (coupon.totalRedemptions && globalTotalUses >= coupon.totalRedemptions) {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new ErrorHandler('Coupon redemption limit reached', 400));
//       }
//     }

//     // --------------- ✅ Process Each Service Item ----------------
//     let totalAmount = 0;
//     const createdOrderItems = [];

//     for (const item of serviceItems) {
//       const {
//         serviceId,
//         astrologerId,
//         bookingDate,
//         startTime,
//         firstName,
//         lastName,
//         email,
//         phone,
//         address,
//       } = item;

//       if (!mongoose.Types.ObjectId.isValid(serviceId)) {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new ErrorHandler('Invalid serviceId', 400));
//       }
//       if (!mongoose.Types.ObjectId.isValid(astrologerId)) {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new ErrorHandler('Invalid astrologerId', 400));
//       }
//       if (!bookingDate || !startTime) {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new ErrorHandler('Booking date and start time required', 400));
//       }

//       const service = await Service.findById(serviceId);
//       if (!service) {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new ErrorHandler('Service not found', 404));
//       }

//       if (service.serviceType === 'pooja_at_home' && !address) {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new ErrorHandler('Address required for pooja_at_home', 400));
//       }

//       const astrologer = await User.findById(astrologerId).populate('profile');
//       if (!astrologer || astrologer.profile.employeeType !== 'astrologer') {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new ErrorHandler('Astrologer not found', 404));
//       }

//       const bookingDay = moment(bookingDate).format('dddd');
//       if (!astrologer.profile.days.includes(bookingDay)) {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new ErrorHandler(`Astrologer not available on ${bookingDay}`, 400));
//       }

//       const serviceDuration = parseInt(service.durationInMinutes, 10);
//       const bookingStart = moment(`${bookingDate} ${startTime}`, 'YYYY-MM-DD HH:mm');
//       const bookingEnd = moment(bookingStart).add(serviceDuration, 'minutes');
//       const astrologerStart = moment(`${bookingDate} ${astrologer.profile.startTime}`, 'YYYY-MM-DD HH:mm');
//       const astrologerEnd = moment(`${bookingDate} ${astrologer.profile.endTime}`, 'YYYY-MM-DD HH:mm');

//       if (bookingStart.isBefore(astrologerStart) || bookingEnd.isAfter(astrologerEnd)) {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new ErrorHandler('Select time within astrologer\'s available window', 400));
//       }

//       if (astrologer.profile.preBooking) {
//         const diffHours = bookingStart.diff(moment(), 'hours');
//         if (diffHours < astrologer.profile.preBooking) {
//           await session.abortTransaction();
//           session.endSession();
//           return next(new ErrorHandler(`Booking must be at least ${astrologer.profile.preBooking} hours in advance`, 400));
//         }
//       }

//       const overlapBooking = await ServiceOrderItem.findOne({
//         astrologer: astrologerId,
//         bookingDate: { $eq: bookingDate },
//         $or: [
//           {
//             startTime: { $lt: bookingEnd.format('HH:mm') },
//             endTime: { $gt: bookingStart.format('HH:mm') },
//           },
//         ],
//       });

//       if (overlapBooking) {
//         await session.abortTransaction();
//         session.endSession();
//         return next(new ErrorHandler('Astrologer already booked for this time slot', 400));
//       }

//       // ✅ Create Order Item
//       const orderItem = await ServiceOrderItem.create([{
//         customerId: userId,
//         cust: { firstName, lastName, email, phone },
//         service: service._id,
//         astrologer: astrologerId,
//         snapshot: { price: service.price, durationInMinutes: serviceDuration },
//         bookingDate,
//         startTime: bookingStart.format('HH:mm'),
//         endTime: bookingEnd.format('HH:mm'),
//         serviceType: service.serviceType,
//         total: service.price,
//         address: address || null,
//       }], { session });

//       // ✅ Create Transaction for this item
//       const transaction = await Transaction.create([{
//         from: 'service',
//         serviceId: service._id,
//         type: paymentType || 'OTHER',
//         status: 'unpaid',
//         amount: 0,
//         pendingAmount: service.price,
//         payingAmount: service.price,
//         isCoupon: !!coupon,
//         paymentId: `${paymentId || 'PAY'}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
//         userId,
//         paymentDetails: paymentDetails || {},
//       }], { session });

//       // Link transaction to orderItem
//       orderItem[0].transaction = transaction[0]._id;
//       await orderItem[0].save({ session });

//       createdOrderItems.push(orderItem[0]._id);
//       totalAmount += service.price;
//     }

//     // ✅ Create a Single ServiceOrder (parent record)
//     const serviceOrderPayload = {
//       user: userId,
//       services: createdOrderItems,
//       paymentStatus: 'pending',
//       totalAmount,
//       finalAmount: totalAmount,
//       payingAmount: totalAmount,
//       isCoupon: !!coupon,
//       coupon: coupon?._id || null,
//     };

//     const serviceOrder = await ServiceOrder.create([serviceOrderPayload], { session });

//     // ✅ Update all items with parent orderId
//     await ServiceOrderItem.updateMany(
//       { _id: { $in: createdOrderItems } },
//       { $set: { orderId: serviceOrder[0]._id } },
//       { session }
//     );

//     // ✅ Process referral reward if payment is successful (immediate payment)
//     // If your payment is asynchronous, you might want to move this to a webhook
//     let referralResult = null;
//     if (paymentType && paymentType !== 'COD' && paymentId) {
//       // For non-COD payments, if payment is already successful
//       referralResult = await processReferralReward(userId, session);

//       // Update payment status to paid if referral was processed successfully
//       if (referralResult.success) {
//         await ServiceOrder.updateOne(
//           { _id: serviceOrder[0]._id },
//           { $set: { paymentStatus: 'paid' } },
//           { session }
//         );

//         // Update all service order items to paid
//         await ServiceOrderItem.updateMany(
//           { _id: { $in: createdOrderItems } },
//           { $set: { paymentStatus: 'paid', status: 'paid' } },
//           { session }
//         );

//         // Update transactions to paid
//         await Transaction.updateMany(
//           { userId: userId, status: 'unpaid' },
//           { 
//             $set: { 
//               status: 'paid',
//               amount: totalAmount,
//               pendingAmount: 0
//             } 
//           },
//           { session }
//         );
//       }
//     }

//     await session.commitTransaction();
//     session.endSession();

//     // ✅ Populate and structure final response
//     const populatedOrder = await ServiceOrder.findById(serviceOrder[0]._id)
//       .populate({
//         path: "services",
//         populate: [
//           {
//             path: "service",
//             select: "name price durationInMinutes serviceType"
//           },
//           {
//             path: "astrologer",
//             select: "name email profile",
//             populate: {
//               path: "profile",
//               select: "employeeType startTime endTime"
//             }
//           }
//         ]
//       })
//       .populate({
//         path: "coupon",
//         select: "code discount"
//       })
//       .populate({
//         path: "user",
//         select: "name email"
//       })
//       .lean();

//     // ✅ Construct clean structured response
//     const formattedOrder = {
//       _id: populatedOrder._id,
//       user: populatedOrder.user,
//       totalAmount: populatedOrder.totalAmount,
//       finalAmount: populatedOrder.finalAmount,
//       payingAmount: populatedOrder.payingAmount,
//       paymentStatus: populatedOrder.paymentStatus,
//       isCoupon: populatedOrder.isCoupon,
//       coupon: populatedOrder.coupon || null,
//       services: populatedOrder.services.map(item => ({
//         _id: item._id,
//         service: {
//           _id: item.service?._id,
//           name: item.service?.name,
//           price: item.service?.price,
//           durationInMinutes: item.service?.durationInMinutes,
//           serviceType: item.service?.serviceType
//         },
//         astrologer: {
//           _id: item.astrologer?._id,
//           name: item.astrologer?.name,
//           email: item.astrologer?.email,
//         },
//         bookingDate: item.bookingDate,
//         startTime: item.startTime,
//         endTime: item.endTime,
//         serviceType: item.serviceType,
//         paymentStatus: item.paymentStatus,
//         total: item.total
//       })),
//       createdAt: populatedOrder.createdAt,
//       updatedAt: populatedOrder.updatedAt
//     };

//     res.status(201).json({
//       success: true,
//       message: 'Service order created successfully with individual transactions per service',
//       order: formattedOrder,
//       referralReward: referralResult // 👈 Include referral result in response
//     });

//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     return next(error);
//   }
// });
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

  const session = await mongoose.startSession(); // 👈 Start session for transaction
  session.startTransaction();

  try {
    // --------------- ✅ Validate Coupon (if provided) ----------------
    let coupon = null;
    if (couponId) {
      if (!mongoose.Types.ObjectId.isValid(couponId)) {
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler('Invalid couponId', 400));
      }

      coupon = await Coupon.findOne({ _id: couponId, isDeleted: false });
      if (!coupon) {
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler('Coupon not found', 404));
      }
      if (!coupon.isActive) {
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler('Coupon is inactive', 400));
      }

      const now = new Date();
      if (coupon.activationDate && now < coupon.activationDate) {
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler('Coupon not yet active', 400));
      }
      if (coupon.expiryDate && now > coupon.expiryDate) {
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler('Coupon expired', 400));
      }

      if (!['services'].includes(coupon.couponType)) {
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler('Coupon not applicable for services', 400));
      }

      // Check redemption limits
      const [userServiceUses, userProductUses, totalServiceUses, totalProductUses] = await Promise.all([
        ServiceOrder.countDocuments({ user: userId, coupon: couponId }),
        ProductOrder.countDocuments({ user: userId, coupon: couponId }),
        ServiceOrder.countDocuments({ coupon: couponId }),
        ProductOrder.countDocuments({ coupon: couponId }),
      ]);

      const userTotalUses = userServiceUses + userProductUses;
      const globalTotalUses = totalServiceUses + totalProductUses;

      if (coupon.redemptionPerUser && userTotalUses >= coupon.redemptionPerUser) {
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler('Coupon redemption limit reached for this user', 400));
      }

      if (coupon.totalRedemptions && globalTotalUses >= coupon.totalRedemptions) {
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler('Coupon redemption limit reached', 400));
      }
    }

    // --------------- ✅ Process Each Service Item ----------------
    let totalAmount = 0;
    const createdOrderItems = [];

    for (const item of serviceItems) {
      const {
        serviceId,
        astrologerId,
        bookingDate,
        serviceType,
        startTime,
        firstName,
        lastName,
        email,
        phone,
        address,
      } = item;

      if (!mongoose.Types.ObjectId.isValid(serviceId)) {
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler('Invalid serviceId', 400));
      }
      if (!mongoose.Types.ObjectId.isValid(astrologerId)) {
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler('Invalid astrologerId', 400));
      }
      if (!bookingDate || !startTime) {
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler('Booking date and start time required', 400));
      }

      const service = await Service.findById(serviceId);
      if (!service) {
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler('Service not found', 404));
      }

      if (serviceType === 'pooja_at_home' && !address) {
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler('Address required for pooja_at_home', 400));
      }

      const astrologer = await User.findById(astrologerId).populate('profile');
      if (!astrologer || astrologer.profile.employeeType !== 'astrologer') {
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler('Astrologer not found', 404));
      }

      const bookingDay = moment(bookingDate).format('dddd');
      if (!astrologer.profile.days.includes(bookingDay)) {
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler(`Astrologer not available on ${bookingDay}`, 400));
      }

      const serviceDuration = parseInt(service.durationInMinutes, 10);
      const bookingStart = moment(`${bookingDate} ${startTime}`, 'YYYY-MM-DD HH:mm');
      const bookingEnd = moment(bookingStart).add(serviceDuration, 'minutes');
      const astrologerStart = moment(`${bookingDate} ${astrologer.profile.startTime}`, 'YYYY-MM-DD HH:mm');
      const astrologerEnd = moment(`${bookingDate} ${astrologer.profile.endTime}`, 'YYYY-MM-DD HH:mm');

      if (bookingStart.isBefore(astrologerStart) || bookingEnd.isAfter(astrologerEnd)) {
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler('Select time within astrologer\'s available window', 400));
      }

      if (astrologer.profile.preBooking) {
        const diffHours = bookingStart.diff(moment(), 'hours');
        if (diffHours < astrologer.profile.preBooking) {
          await session.abortTransaction();
          session.endSession();
          return next(new ErrorHandler(`Booking must be at least ${astrologer.profile.preBooking} hours in advance`, 400));
        }
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

      if (overlapBooking) {
        await session.abortTransaction();
        session.endSession();
        return next(new ErrorHandler('Astrologer already booked for this time slot', 400));
      }

      // ✅ Create Zoom Meeting for online services
      // let zoomLink = null;
      // if (service.serviceType === 'online') {
      //   try {
      //     const zoomMeeting = await createMeetingForUser({
      //       topic: `${service.name} - ${firstName} ${lastName}`,
      //       start_time: bookingStart.toISOString(),
      //       duration: serviceDuration,
      //       timezone: 'Asia/Kolkata',
      //       agenda: `Astrology consultation with ${astrologer.name} for ${firstName} ${lastName}`,
      //     });

      //     zoomLink = zoomMeeting.join_url;
      //   } catch (zoomError) {
      //     console.error('Failed to create Zoom meeting:', zoomError);
      //     // Don't fail the entire order if Zoom fails, just log and continue
      //     // You might want to handle this differently based on your requirements
      //   }
      // }

      // ✅ Create Order Item
      const orderItem = await ServiceOrderItem.create([{
        customerId: userId,
        cust: { firstName, lastName, email, phone },
        service: service._id,
        astrologer: astrologerId,
        snapshot: { price: service.price, durationInMinutes: serviceDuration },
        bookingDate,
        startTime: bookingStart.format('HH:mm'),
        endTime: bookingEnd.format('HH:mm'),
        serviceType: serviceType,
        total: service.price,
        address: address || null,
        zoomLink: null, // Add Zoom link to the order item
      }], { session });

      // ✅ Create Transaction for this item
      const transaction = await Transaction.create([{
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
      }], { session });

      // Link transaction to orderItem
      orderItem[0].transaction = transaction[0]._id;
      await orderItem[0].save({ session });

      createdOrderItems.push(orderItem[0]._id);
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

    const serviceOrder = await ServiceOrder.create([serviceOrderPayload], { session });

    // ✅ Update all items with parent orderId
    await ServiceOrderItem.updateMany(
      { _id: { $in: createdOrderItems } },
      { $set: { orderId: serviceOrder[0]._id } },
      { session }
    );

    // ✅ Process referral reward if payment is successful (immediate payment)
    // If your payment is asynchronous, you might want to move this to a webhook
    let referralResult = null;
    if (paymentType && paymentType !== 'COD' && paymentId) {
      // For non-COD payments, if payment is already successful
      referralResult = await processReferralReward(userId, session);

      // Update payment status to paid if referral was processed successfully
      if (referralResult.success) {
        await ServiceOrder.updateOne(
          { _id: serviceOrder[0]._id },
          { $set: { paymentStatus: 'paid' } },
          { session }
        );

        // Update all service order items to paid
        await ServiceOrderItem.updateMany(
          { _id: { $in: createdOrderItems } },
          { $set: { paymentStatus: 'paid', status: 'paid' } },
          { session }
        );

        // Update transactions to paid
        await Transaction.updateMany(
          { userId: userId, status: 'unpaid' },
          {
            $set: {
              status: 'paid',
              amount: totalAmount,
              pendingAmount: 0
            }
          },
          { session }
        );
      }
    }

    await session.commitTransaction();
    session.endSession();

    // ✅ Populate and structure final response
    const populatedOrder = await ServiceOrder.findById(serviceOrder[0]._id)
      .populate({
        path: "services",
        populate: [
          {
            path: "service",
            select: "name price durationInMinutes serviceType"
          },
          {
            path: "astrologer",
            select: "name email profile",
            populate: {
              path: "profile",
              select: "employeeType startTime endTime"
            }
          }
        ]
      })
      .populate({
        path: "coupon",
        select: "code discount"
      })
      .populate({
        path: "user",
        select: "name email"
      })
      .lean();

    // ✅ Construct clean structured response
    const formattedOrder = {
      _id: populatedOrder._id,
      user: populatedOrder.user,
      totalAmount: populatedOrder.totalAmount,
      finalAmount: populatedOrder.finalAmount,
      payingAmount: populatedOrder.payingAmount,
      paymentStatus: populatedOrder.paymentStatus,
      isCoupon: populatedOrder.isCoupon,
      coupon: populatedOrder.coupon || null,
      services: populatedOrder.services.map(item => ({
        _id: item._id,
        service: {
          _id: item.service?._id,
          name: item.service?.name,
          price: item.service?.price,
          durationInMinutes: item.service?.durationInMinutes,
          serviceType: item.service?.serviceType
        },
        astrologer: {
          _id: item.astrologer?._id,
          name: item.astrologer?.name,
          email: item.astrologer?.email,
        },
        bookingDate: item.bookingDate,
        startTime: item.startTime,
        endTime: item.endTime,
        serviceType: item.serviceType,
        paymentStatus: item.paymentStatus,
        total: item.total,
        zoomLink: item.zoomLink // Include Zoom link in response
      })),
      createdAt: populatedOrder.createdAt,
      updatedAt: populatedOrder.updatedAt
    };

    res.status(201).json({
      success: true,
      message: 'Service order created successfully with individual transactions per service',
      order: formattedOrder,
      referralReward: referralResult // 👈 Include referral result in response
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return next(error);
  }
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

  // Build match stage
  const matchStage = {};

  if (req.query.orderId) {
    matchStage._id = new mongoose.Types.ObjectId(req.query.orderId);
  }

  if (req.query.status) {
    matchStage.paymentStatus = req.query.status.toLowerCase();
  }

  if (req.query.date) {
    const startDate = new Date(req.query.date);
    const endDate = new Date(startDate);
    endDate.setHours(23, 59, 59, 999);

    matchStage.createdAt = {
      $gte: startDate,
      $lte: endDate
    };
  }

  // Handle astrologerId filtering with aggregation
  if (req.query.astrologerId) {
    matchStage['services.astrologer'] = new mongoose.Types.ObjectId(req.query.astrologerId);
  }

  const aggregationPipeline = [
    // Match orders based on filters
    ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),

    // Lookup services with populated data
    {
      $lookup: {
        from: 'serviceorderitems',
        localField: 'services',
        foreignField: '_id',
        as: 'serviceItems',
        pipeline: [
          // Filter by astrologerId if provided
          ...(req.query.astrologerId ? [{
            $match: {
              astrologer: new mongoose.Types.ObjectId(req.query.astrologerId)
            }
          }] : []),

          // Lookup service details
          {
            $lookup: {
              from: 'services',
              localField: 'service',
              foreignField: '_id',
              as: 'serviceDetails'
            }
          },
          { $unwind: { path: '$serviceDetails', preserveNullAndEmptyArrays: true } },

          // Lookup astrologer details
          {
            $lookup: {
              from: 'users',
              localField: 'astrologer',
              foreignField: '_id',
              as: 'astrologerDetails',
              pipeline: [
                { $project: { name: 1 } }
              ]
            }
          },
          { $unwind: { path: '$astrologerDetails', preserveNullAndEmptyArrays: true } },

          // Lookup address details for each service item
          {
            $lookup: {
              from: 'customeraddresses',
              localField: 'address',
              foreignField: '_id',
              as: 'addressDetails'
            }
          },
          { $unwind: { path: '$addressDetails', preserveNullAndEmptyArrays: true } }
        ]
      }
    },

    // Lookup user details
    {
      $lookup: {
        from: 'users',
        localField: 'user',
        foreignField: '_id',
        as: 'userDetails',
        pipeline: [
          {
            $project: {
              email: 1,
              mobileNo: 1,
              profile: 1,
              role: 1
            }
          }
        ]
      }
    },
    { $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true } },

    // Lookup customer profile details (where firstName and lastName are stored)
    {
      $lookup: {
        from: 'customers',
        localField: 'userDetails.profile',
        foreignField: '_id',
        as: 'customerProfile',
        pipeline: [
          {
            $project: {
              firstName: 1,
              lastName: 1,
              title: 1
            }
          }
        ]
      }
    },
    { $unwind: { path: '$customerProfile', preserveNullAndEmptyArrays: true } },

    // Lookup transaction details
    {
      $lookup: {
        from: 'transactions',
        localField: 'transaction',
        foreignField: '_id',
        as: 'transactionDetails'
      }
    },
    { $unwind: { path: '$transactionDetails', preserveNullAndEmptyArrays: true } },

    // Lookup coupon details
    {
      $lookup: {
        from: 'coupons',
        localField: 'coupon',
        foreignField: '_id',
        as: 'couponDetails',
        pipeline: [
          {
            $project: {
              couponName: 1,
              couponCode: 1,
              discountIn: 1,
              discount: 1
            }
          }
        ]
      }
    },
    { $unwind: { path: '$couponDetails', preserveNullAndEmptyArrays: true } },

    // Project the final structure
    {
      $project: {
        orderId: '$_id',
        customer: {
          email: '$userDetails.email',
          mobileNo: '$userDetails.mobileNo',
          firstName: '$customerProfile.firstName',
          lastName: '$customerProfile.lastName',
          name: {
            $cond: {
              if: {
                $and: [
                  '$customerProfile.firstName',
                  '$customerProfile.lastName'
                ]
              },
              then: {
                $concat: [
                  { $ifNull: ['$customerProfile.firstName', ''] },
                  ' ',
                  { $ifNull: ['$customerProfile.lastName', ''] }
                ]
              },
              else: null
            }
          }
        },
        services: {
          $map: {
            input: '$serviceItems',
            as: 'service',
            in: {
              serviceId: '$$service.serviceDetails._id',
              serviceName: '$$service.serviceDetails.name',
              astrologerName: '$$service.astrologerDetails.name',
              servicePrice: '$$service.snapshot.price',
              durationInMinutes: '$$service.snapshot.durationInMinutes',
              startTime: '$$service.startTime',
              endTime: '$$service.endTime',
              bookingDate: '$$service.bookingDate',
              serviceType: '$$service.serviceType',
              total: '$$service.total',
              astrologerStatus: '$$service.astrologerStatus',
              rejectReason: '$$service.rejectReason',
              bookingStatus: '$$service.status',
              paymentStatus: '$$service.paymentStatus',
              zoomLink: '$$service.zoomLink',
              address: {
                $cond: {
                  if: { $eq: [{ $type: '$$service.addressDetails' }, 'missing'] },
                  then: null,
                  else: {
                    _id: '$$service.addressDetails._id',
                    firstName: '$$service.addressDetails.firstName',
                    lastName: '$$service.addressDetails.lastName',
                    phoneNumber: '$$service.addressDetails.phoneNumber',
                    addressType: '$$service.addressDetails.addressType',
                    address: '$$service.addressDetails.address',
                    country: '$$service.addressDetails.country',
                    state: '$$service.addressDetails.state',
                    city: '$$service.addressDetails.city',
                    postalCode: '$$service.addressDetails.postalCode',
                    isDefault: '$$service.addressDetails.isDefault'
                  }
                }
              }
            }
          }
        },
        paymentStatus: 1,
        totalAmount: 1,
        finalAmount: 1,
        payingAmount: 1,
        isCoupon: 1,
        coupon: {
          $cond: {
            if: { $eq: [{ $type: '$couponDetails' }, 'missing'] },
            then: null,
            else: {
              couponName: '$couponDetails.couponName',
              couponCode: '$couponDetails.couponCode',
              discountIn: '$couponDetails.discountIn',
              discount: '$couponDetails.discount'
            }
          }
        },
        paymentId: '$transactionDetails.paymentId',
        paymentDetails: '$transactionDetails.paymentDetails',
        createdAt: 1
      }
    },

    // Sort by creation date (newest first)
    { $sort: { createdAt: -1 } },

    // Pagination
    { $skip: skip },
    { $limit: limit }
  ];

  // Get total count for pagination
  const countPipeline = [
    ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),

    // Handle astrologer filtering in count
    ...(req.query.astrologerId ? [{
      $lookup: {
        from: 'serviceorderitems',
        localField: 'services',
        foreignField: '_id',
        as: 'serviceItems',
        pipeline: [{
          $match: {
            astrologer: new mongoose.Types.ObjectId(req.query.astrologerId)
          }
        }]
      }
    }, {
      $match: {
        'serviceItems.0': { $exists: true }
      }
    }] : []),

    { $count: 'total' }
  ];

  // Execute both pipelines in parallel
  const [ordersResult, countResult] = await Promise.all([
    ServiceOrder.aggregate(aggregationPipeline),
    ServiceOrder.aggregate(countPipeline)
  ]);

  const total = countResult.length > 0 ? countResult[0].total : 0;
  const pages = Math.ceil(total / limit);

  res.paginated(
    ordersResult,
    { page, limit, total, pages },
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

  // 5. if allowedStatuses is accepted then generate zoom link
  let zoomLink = null;
  if (allowedStatuses === "accepted" && serviceItem.serviceType === 'online') {
    try {
      const zoomMeeting = await createMeetingForUser({
        topic: `${serviceItem.name} - ${firstName} ${lastName}`,
        start_time: bookingStart.toISOString(),
        duration: serviceDuration,
        timezone: 'Asia/Kolkata',
        agenda: `Astrology consultation with ${astrologer.name} for ${firstName} ${lastName}`,
      });

      zoomLink = zoomMeeting.join_url;
    } catch (zoomError) {
      console.error('Failed to create Zoom meeting:', zoomError);
      // Don't fail the entire order if Zoom fails, just log and continue
      // You might want to handle this differently based on your requirements
    }
  }
  zoomLink = `${zoomLink}&uname=${serviceItem.cust.firstName}%20${serviceItem.cust.lastName}`;
  serviceItem.zoomLink = zoomLink;
  // 6. Save
  await serviceItem.save();

  // 7. Respond
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
    .populate('astrologer', 'firstName lastName')
    .populate('address');

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
      // .populate('address')
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
    address: item.address || null,

    // Parent order details
    parent: parentOrder
      ? {
        paymentStatus: parentOrder.paymentStatus || null,
        totalAmount: parentOrder.totalAmount || null,
        finalAmount: parentOrder.finalAmount || null,
        paymentId: parentOrder.transaction?.paymentId || null,
        paymentDetails: parentOrder.transaction?.paymentDetails || null,
        // address: parentOrder.address || null,
        isCoupon: parentOrder.isCoupon || false,
        coupon: parentOrder.coupon || null,
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

// @desc Get Single Service Order Item (Astrologer)
// @route GET /api/service-order/astrologer/get-single-item
// @access Astrologer & Admin
exports.getSingleServiceOrder = asyncHandler(async (req, res, next) => {
  try {
    const { id } = req.query;

    const orderData = await ServiceOrderItem.aggregate([
      {
        $match: { orderId: id }
      },
      {
        $addFields: {
          orderObjId: {
            $convert: { input: '$orderId', to: 'objectId', onError: null, onNull: null }
          }
        }
      },
      {
        $lookup: {
          from: 'serviceorders',
          localField: 'orderObjId',
          foreignField: '_id',
          as: 'orderData'
        }
      },
      { $unwind: '$orderData' },
      {
        $lookup: {
          from: 'users',
          localField: 'astrologer',
          foreignField: '_id',
          as: 'astrologerData'
        }
      },
      { $unwind: '$astrologerData' },
      {
        $lookup: {
          from: 'employees',
          localField: 'astrologerData.profile',
          foreignField: '_id',
          as: 'astroNameData'
        }
      },
      { $unwind: '$astroNameData' },
      {
        $lookup: {
          from: 'users',
          localField: 'orderData.user',
          foreignField: '_id',
          as: 'userData'
        }
      },
      {
        $unwind: '$userData'
      },
      {
        $lookup: {
          from: 'services',
          localField: 'service',
          foreignField: '_id',
          as: 'serviceData'
        }
      },
      {
        $unwind: {
          path: '$serviceData',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: '$orderId',
          orderData: { $first: '$orderData' },
          items: {
            $push: {
              _id: '$_id',
              astrologerFirstName: '$astroNameData.firstName',
              astrologerLastName: '$astroNameData.lastName',
              astrologerEmail: '$astrologerData.email',
              astrologerMobileNo: '$astrologerData.mobileNo',
              serviceName: '$serviceData.name',
              servicePrice: '$serviceData.price',
              serviceDuration: '$serviceData.durationInMinutes',
              serviceType: '$serviceData.serviceType',
              quantity: '$quantity',
              price: '$price',
              total: '$total',
              status: '$status',
              cust: "$cust",
              astrologerStatus: "$astrologerStatus",
              bookingStatus: "$status",
              paymentStatus: "$paymentStatus",
              bookingDate: "$bookingDate",
              startTime: "$startTime",
              endTime: "$endTime",
              createdAt: '$createdAt'
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          orderData: 1,
          items: 1
        }
      }
    ]);


    if (!orderData) {
      return next(new ErrorHandler("Service Order Item not found", 404));
    }

    res.status(200).json({
      success: true,
      orderData,
      message: "Service order item fetched successfully",
    });

  } catch (err) {
    console.log("🚀 ~ err:", err);
  }
})

exports.rescheduleServiceOrderCustomer = asyncHandler(async (req, res, next) => {
  const serviceOrderItemId = req.params.serviceItemId;
  const { newBookingDate, newStartTime, newEndTime, astrologerId } = req.body;

  // input validations
  if (!serviceOrderItemId) return next(new ErrorHandler('serviceItemId is required', 400));
  for (const field of ['newBookingDate', 'newStartTime', 'newEndTime']) {
    if (!req.body[field]) {
      return next(new ErrorHandler(`${field} is required`, 400));
    }
  }

  try {
    // find service order item
    const serviceOrderItem = await ServiceOrderItem.findById(serviceOrderItemId)
      .populate('astrologer', 'role')
      .populate({
        path: 'astrologer',
        populate: {
          path: 'profile',
          model: 'employee'
        }
      });

    if (!serviceOrderItem) return next(new ErrorHandler('Service Order Item not found', 404));

    // Check if astrologer status is 'pending'
    // if (serviceOrderItem.astrologerStatus !== 'pending') {
    //     return res.status(400).json({
    //         success: false,
    //         message: 'Cannot reschedule - astrologer status is not pending'
    //     });
    // }

    // Verify the astrologer exists and has correct role
    const astrologerUser = await User.findById(astrologerId).populate('profile');
    if (!astrologerUser || astrologerUser.role !== 'employee') {
      return next(new ErrorHandler('Asrologer not found or Invalid astrologer ID', 400));
    }
    // Check if astrologer profile exists and is of type astrologer
    const astrologerProfile = astrologerUser.profile;
    if (!astrologerProfile || astrologerProfile.employeeType !== 'astrologer') {
      return res.status(400).json({
        success: false,
        message: 'Invalid astrologer profile'
      });
    }

    // check astrologer availability for the new slot
    const isAvailable = await checkAstrologerAvailability(
      astrologerId,
      newBookingDate,
      newStartTime,
      newEndTime
    );

    if (!isAvailable) return next(new ErrorHandler('Astrologer is not available on the requested date and time', 400));

    // check for offline bookings conflict (no offline bookings on that day)
    const hasOfflineBooking = await checkOfflineBookings(astrologerId, newBookingDate);
    if (hasOfflineBooking) return next(new ErrorHandler('Astrologer has offline bookings on the requested date', 400));

    // Update the service order item with new timing and extraInfo
    const updatedServiceOrderItem = await ServiceOrderItem.findByIdAndUpdate(
      serviceOrderItemId,
      {
        $set: {
          bookingDate: newBookingDate,
          startTime: newStartTime,
          endTime: newEndTime,
          astrologer: astrologerId,
          astrologerStatus: 'pending',
          extraInfo: {
            bookingDate: newBookingDate,
            startTime: newStartTime,
            endTime: newEndTime,
            rescheduledAt: new Date().toISOString(),
            previousBookingDate: serviceOrderItem.bookingDate,
            previousStartTime: serviceOrderItem.startTime,
            previousEndTime: serviceOrderItem.endTime
          }
        }
      },
      { new: true, runValidators: true }
    );

    res.ok(null, 'Service order rescheduled successfully')

  } catch (error) {
    console.error('Customer Rescheduling error:', error);
    return next(new ErrorHandler('Failed to reschedule service order. Please try again later.', 500));
  }
});

exports.rescheduleServiceOrderAstrologer = asyncHandler(async (req, res, next) => {
  const serviceOrderItemId = req.params.serviceItemId;
  const { newBookingDate, newStartTime, newEndTime } = req.body;

  // input validations
  if (!serviceOrderItemId) return next(new ErrorHandler('serviceItemId is required', 400));
  for (const field of ['newBookingDate', 'newStartTime', 'newEndTime']) {
    if (!req.body[field]) {
      return next(new ErrorHandler(`${field} is required`, 400));
    }
  }

  try {

    // find service order item
    const serviceOrderItem = await ServiceOrderItem.findById(serviceOrderItemId);
    if (!serviceOrderItem) return next(new ErrorHandler('Service Order Item not found', 404));

    const astrologerId = req.user._id;

    // check astrologer availability for the new slot
    const isAvailable = await checkAstrologerAvailability(
      astrologerId,
      newBookingDate,
      newStartTime,
      newEndTime
    );
    if (!isAvailable) return next(new ErrorHandler('You are not available on the requested date and time', 400));

    // check for offline bookings conflict (no offline bookings on that day)
    const hasOfflineBooking = await checkOfflineBookings(astrologerId, newBookingDate);
    if (hasOfflineBooking) return next(new ErrorHandler('You have offline bookings on the requested date', 400));

    // Update the service order item with new timing and extraInfo
    const updatedServiceOrderItem = await ServiceOrderItem.findByIdAndUpdate(
      serviceOrderItemId,
      {
        $set: {
          bookingDate: newBookingDate,
          startTime: newStartTime,
          endTime: newEndTime,
          astrologerStatus: 'accepted',
          extraInfo: {
            bookingDate: newBookingDate,
            startTime: newStartTime,
            endTime: newEndTime,
            rescheduledAt: new Date().toISOString(),
            previousBookingDate: serviceOrderItem.bookingDate,
            previousStartTime: serviceOrderItem.startTime,
            previousEndTime: serviceOrderItem.endTime
          }
        }
      },
      { new: true, runValidators: true }
    );

    res.ok(null, 'Service order rescheduled successfully')

  } catch (error) {
    console.error('Astrologer Rescheduling error:', error);
    return next(new ErrorHandler('Failed to reschedule service order. Please try again later.', 500));
  }

});

// Helper function to check astrologer availability
const checkAstrologerAvailability = async (astrologerId, bookingDate, startTime, endTime) => {
  try {
    const astrologerUser = await User.findById(astrologerId).populate('profile');
    if (!astrologerUser || !astrologerUser.profile) return false;

    const astrologerProfile = astrologerUser.profile;

    // Check if the day is in astrologer's working days
    const bookingDay = new Date(bookingDate).toLocaleDateString('en-US', { weekday: 'long' });
    if (!astrologerProfile.days.includes(bookingDay)) {
      return false;
    }

    // Check working hours
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const [profileStartHour, profileStartMinute] = astrologerProfile.startTime.split(':').map(Number);
    const [profileEndHour, profileEndMinute] = astrologerProfile.endTime.split(':').map(Number);

    const bookingStartMinutes = startHour * 60 + startMinute;
    const bookingEndMinutes = endHour * 60 + endMinute;
    const profileStartMinutes = profileStartHour * 60 + profileStartMinute;
    const profileEndMinutes = profileEndHour * 60 + profileEndMinute;

    if (bookingStartMinutes < profileStartMinutes || bookingEndMinutes > profileEndMinutes) {
      return false;
    }

    // Check for existing bookings at the same time
    const conflictingBookings = await ServiceOrderItem.find({
      astrologer: astrologerId,
      bookingDate: bookingDate,
      astrologerStatus: { $in: ['pending', 'accepted'] },
      $or: [
        {
          $and: [
            { startTime: { $lte: startTime } },
            { endTime: { $gt: startTime } }
          ]
        },
        {
          $and: [
            { startTime: { $lt: endTime } },
            { endTime: { $gte: endTime } }
          ]
        },
        {
          $and: [
            { startTime: { $gte: startTime } },
            { endTime: { $lte: endTime } }
          ]
        }
      ]
    });

    return conflictingBookings.length === 0;

  } catch (error) {
    console.error('Availability check error:', error);
    return false;
  }
};

// Helper function to check for offline bookings
const checkOfflineBookings = async (astrologerId, bookingDate) => {
  try {
    // Check if astrologer has any offline service bookings on that date
    const offlineBookings = await ServiceOrderItem.find({
      astrologer: astrologerId,
      bookingDate: bookingDate,
      serviceType: { $in: ['pandit_center', 'pooja_at_home'] },
      status: { $in: ['pending', 'paid'] }
    });

    return offlineBookings.length > 0;
  } catch (error) {
    console.error('Offline bookings check error:', error);
    return true; // Return true to be safe and prevent rescheduling
  }
};