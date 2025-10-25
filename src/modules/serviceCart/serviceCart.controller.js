const asyncHandler = require('express-async-handler');
const ErrorHandler = require('../../utils/errorHandler');
const Service = require('../service/service.model');
const ServiceCart = require('./serviceCart.model');
const User = require('../auth/user.Model');
const Employee = require('../employeeUser/employeeUser.model');

// 🔹 Helper to recalc grand total
const calculateGrandTotal = (cart) => {
  cart.grandtotal = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);
};

// @desc Add service to cart
// @route POST /api/service-cart/add
// @access Private/User
exports.addToCart = asyncHandler(async (req, res) => {
  const {
    serviceId,
    quantity = 1,
    serviceMode,
    astrologer,
    startTime,
    endTime,
    date,
    firstName,
    lastName,
    email,
    phone,
    address,
    addressData
  } = req.body;

  // 🔹 Validate service
  const service = await Service.findById(serviceId).lean();
  if (!service) throw new ErrorHandler('Service not found', 404);

  // 🔹 Validate astrologer if provided
  let astrologerUser = null;
  if (astrologer) {
    astrologerUser = await User.findById(astrologer).populate('profile');
    if (!astrologerUser) throw new ErrorHandler('Astrologer not found', 404);
    if (astrologerUser.role !== 'employee') {
      throw new ErrorHandler('Provided user is not an astrologer', 400);
    }

    const employeeProfile = await Employee.findById(astrologerUser.profile);
    if (!employeeProfile || employeeProfile.employeeType !== 'astrologer') {
      throw new ErrorHandler('Provided user is not an astrologer', 400);
    }
  }

  let cart = await ServiceCart.findOne({ user: req.user._id });

  if (!cart) {
    // create new cart for user
    cart = new ServiceCart({
      user: req.user._id,
      items: [{
        service: service._id,
        serviceMode,
        astrologer: astrologerUser?._id,
        startTime,
        endTime,
        date,
        quantity,
        totalPrice: quantity * (service.price || 0),
        cust: {
          firstName,
          lastName,
          email,
          phone,
          addressData
        },
        address
      }],
      grandtotal: quantity * (service.price || 0),
    });
  } else {
    // check if same service+astrologer+mode+date+timeSlot already exists
    const existingItem = cart.items.find(
      (item) =>
        item.service.toString() === service._id.toString() &&
        item.serviceMode === serviceMode &&
        String(item.astrologer) === String(astrologer?._id || '') &&
        String(item.startTime || '') === String(startTime || '') &&
        String(item.endTime || '') === String(endTime || '') &&
        String(item.date || '') === String(date || '')
    );

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.totalPrice = existingItem.quantity * (service.price || 0);
    } else {
      cart.items.push({
        service: service._id,
        serviceMode,
        astrologer: astrologerUser?._id,
        startTime,
        endTime,
        date,
        quantity,
        address,
        totalPrice: quantity * (service.price || 0),
        cust: {
          firstName,
          lastName,
          email,
          phone,
          addressData
        },
      });
    }

    calculateGrandTotal(cart);
  }

  await cart.save();
  await cart.populate([
    { path: 'items.service', select: 'name price' },
    {
      path: 'items.astrologer',
      select: 'role profile',
      populate: { path: 'profile', model: 'employee', select: 'firstName lastName employeeType' }
    }
  ]);

  // Transform items into desired structure
  const formattedItems = cart.items.map((item) => ({
    _id: item._id,
    serviceId: item.service?._id,
    name: item.service?.name,
    originalPrice: item.service?.price || 0,
    serviceMode: item.serviceMode,
    astrologer: item.astrologer ? {
      _id: item.astrologer._id,
      fullName: `${item.astrologer.profile?.firstName || ''} ${item.astrologer.profile?.lastName || ''}`.trim(),
      employeeType: item.astrologer.profile?.employeeType
    } : null,
    timeSlot: item.timeSlot,
    date: item.date,
    quantity: item.quantity,
    totalPrice: item.totalPrice,
  }));

  res.created({ items: formattedItems, grandtotal: cart.grandtotal }, 'Service added to cart');
});

// @desc Get user service cart
// @route GET /api/service-cart/get-all
// @access Private/User
exports.getCart = asyncHandler(async (req, res) => {
  const cartData = await ServiceCart.aggregate([
    // 1. Match current user’s cart
    { $match: { user: req.user._id } },

    // 2. Unwind items (so we can join per item)
    { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },

    // 3. Join with Service collection
    {
      $lookup: {
        from: "services",
        localField: "items.service",
        foreignField: "_id",
        as: "service"
      }
    },
    { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },

    // 4. Join with User collection (astrologer)
    {
      $lookup: {
        from: "users",
        localField: "items.astrologer",
        foreignField: "_id",
        as: "astrologer"
      }
    },
    { $unwind: { path: "$astrologer", preserveNullAndEmptyArrays: true } },

    // 5. Join astrologer.profile → employee collection
    {
      $lookup: {
        from: "employees",
        localField: "astrologer.profile",
        foreignField: "_id",
        as: "employeeProfile"
      }
    },
    { $unwind: { path: "$employeeProfile", preserveNullAndEmptyArrays: true } },

    // 6. Group back items into an array
    {
      $group: {
        _id: "$_id",
        user: { $first: "$user" },
        grandtotal: { $first: "$grandtotal" },
        items: {
          $push: {
            _id: "$items._id",
            serviceId: "$service._id",
            name: "$service.name",
            originalPrice: { $ifNull: ["$service.price", 0] },
            serviceMode: "$items.serviceMode",
            astrologer: {
              $cond: [
                { $eq: ["$astrologer.role", "employee"] },
                {
                  _id: "$astrologer._id",
                  fullName: {
                    $concat: [
                      { $ifNull: ["$employeeProfile.firstName", ""] },
                      " ",
                      { $ifNull: ["$employeeProfile.lastName", ""] }
                    ]
                  },
                  employeeType: "$employeeProfile.employeeType"
                },
                null
              ]
            },
            cust: "$items.cust",
            date: "$items.date",
            startTime: "$items.startTime",
            endTime: "$items.endTime",
            quantity: "$items.quantity",
            totalPrice: "$items.totalPrice"
          }
        }
      }
    },

    // 7. Project clean fields
    {
      $project: {
        _id: 1,
        items: 1,
        grandtotal: 1
      }
    }
  ]);

  // if cart is empty
  if (cartData.length === 0) {
    return res.ok({ items: [], grandtotal: 0 }, 'Cart is empty');
  }

  res.ok(cartData[0], "Cart retrieved successfully");
});

// @desc Update cart item details
// @route PUT /api/service-cart/update
// @access Private/User
exports.updateCart = asyncHandler(async (req, res) => {
  const {
    serviceItemId,
    astrologer,
    serviceMode,
    startTime,
    endTime,
    date,
    quantity,
    address,
    addressData
  } = req.body;

  const cart = await ServiceCart.findOne({ user: req.user._id }).populate([
    { path: 'items.service', select: 'name price' },
    {
      path: 'items.astrologer',
      select: 'role profile',
      populate: { path: 'profile', model: 'employee', select: 'firstName lastName employeeType' }
    }
  ]);

  if (!cart) throw new ErrorHandler('Cart not found', 404);

  const cartItem = cart.items.id(serviceItemId);
  if (!cartItem) throw new ErrorHandler('Cart item not found', 404);

  // ✅ Update fields if provided
  if (astrologer) cartItem.astrologer = astrologer;
  if (serviceMode) cartItem.serviceMode = serviceMode;
  if (startTime) cartItem.startTime = startTime;
  if (endTime) cartItem.endTime = endTime;
  if (date) cartItem.date = date;
  if (address) cartItem.address = address;
  if (addressData) cartItem.cust.addressData = addressData;

  // ✅ Handle quantity & price update
  if (quantity) {
    if (quantity < 1) throw new ErrorHandler('Quantity must be at least 1', 400);
    cartItem.quantity = quantity;
  }

  cartItem.totalPrice = cartItem.quantity * (cartItem.service.price || 0);

  // ✅ Recalculate cart total
  calculateGrandTotal(cart);

  await cart.save();
  await cart.populate([
    { path: 'items.service', select: 'name price' },
    {
      path: 'items.astrologer',
      select: 'role profile',
      populate: { path: 'profile', model: 'employee', select: 'firstName lastName employeeType' }
    }
  ]);

  // 🔹 Transform items into desired response structure
  const formattedItems = cart.items.map((item) => ({
    _id: item._id,
    service: {
      _id: item.service?._id,
      name: item.service?.name,
      price: item.service?.price || 0,
    },
    serviceMode: item.serviceMode,
    astrologer: item.astrologer
      ? {
        _id: item.astrologer._id,
        fullName: `${item.astrologer.profile?.firstName || ''} ${item.astrologer.profile?.lastName || ''}`.trim(),
        employeeType: item.astrologer.profile?.employeeType,
      }
      : null,
    startTime: item.startTime,
    endTime: item.endTime,
    date: item.date,
    quantity: item.quantity,
    totalPrice: item.totalPrice,
  }));

  res.ok(
    { items: formattedItems, grandtotal: cart.grandtotal },
    'Cart item updated'
  );
});

// @desc    Remove item from cart
// @route   PUT /api/service-cart/remove-item
// @access  Private/User
exports.removeItem = asyncHandler(async (req, res) => {
  const { itemId } = req.body;

  const cart = await ServiceCart.findOne({ user: req.user._id });
  if (!cart) return res.ok({ grandtotal: 0, items: [] }, 'Cart is already empty');

  // find the item index
  const itemIndex = cart.items.findIndex(
    (item) => item._id.toString() === itemId
  );
  if (itemIndex === -1) return res.ok({ grandtotal: cart.grandtotal, items: cart.items }, 'Item not found in cart');

  // remove the item
  cart.items.splice(itemIndex, 1);

  // if no items left -> delete entire cart
  if (cart.items.length === 0) {
    await ServiceCart.findByIdAndDelete(cart._id);
    return res.ok({ grandtotal: 0, items: [] }, 'Cart deleted as last item was removed');
  }

  // otherwise recalculate and save
  calculateGrandTotal(cart);
  await cart.save();

  res.ok({ grandtotal: cart.grandtotal, items: cart.items }, 'Item removed from cart');
});

// @desc    Delete cart
// @route   DELETE /api/service-cart/delete
// @access  Private/User
exports.removeAllFromCart = asyncHandler(async (req, res) => {
  const cart = await ServiceCart.findOneAndDelete({ user: req.user._id });
  if (!cart) return res.ok({ grandtotal: 0, items: [] }, 'Cart already empty');

  return res.ok({ grandtotal: 0, items: [] }, 'Cart deleted successfully');
});