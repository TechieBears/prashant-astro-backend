const asyncHandler = require('express-async-handler');
const CustomerAddress = require('./customerAddress.model');
const ErrorHandler = require('../../utils/errorHandler');
const mongoose = require('mongoose');

// @desc    Create a new customer address
// @route   POST /api/v1/customer-address/create
// @access  Private (customer)
exports.createCustomerAddress = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const {
        firstName,
        lastName,
        phoneNumber,
        addressType,
        address,
        country,
        state,
        city,
        postalCode,
    } = req.body;

    if (!firstName || !lastName || !phoneNumber || !addressType || !address || !country || !state || !city || !postalCode) {
        return next(new ErrorHandler("All required fields must be filled", 400));
    }

    // // If this isDefault, unset any other default address for this user
    // if (isDefault) {
    //     await CustomerAddress.updateMany(
    //         { userId },
    //         { $set: { isDefault: false } }
    //     );
    // }

    // set isDefault to current and remove all remaining
    await CustomerAddress.updateMany(
        { userId },
        { $set: { isDefault: false } }
    );

    const newAddress = await CustomerAddress.create({
        userId,
        firstName,
        lastName,
        phoneNumber,
        addressType,
        address,
        country,
        state,
        city,
        postalCode,
        isDefault: true,
    });

    res.created(newAddress, "Address created successfully");
});

// @desc    Get all addresses for the logged-in customer
// @route   GET /api/v1/customer-address/get-all
// @access  Private (customer)
exports.getAllCustomerAddresses = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;

    const addresses = await CustomerAddress.find({ userId, isDeleted: false }).sort({ createdAt: -1 }).select("-__v");

    if (addresses.length === 0) {
        res.ok([], "No addresses found");
    }

    res.ok(addresses, "Addresses retrieved successfully");
});

// @desc    Get a single address by ID for the logged-in customer
// @route   GET /api/v1/customer-address/get-single/:id
// @access  Private (customer)
exports.getCustomerAddress = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const { id } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new ErrorHandler("Invalid address ID", 400));
    }

    const address = await CustomerAddress.findOne({  userId, _id: id, isDeleted: false }).select("-__v");

    if (!address) {
        return next(new ErrorHandler("Address not found", 404));
    }

    res.ok(address, "Address retrieved successfully");
});

// @desc    Update an address by ID for the logged-in customer
// @route   PUT /api/v1/customer-address/update/:id
// @access  Private (customer)
exports.updateCustomerAddress = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const { id } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new ErrorHandler("Invalid address ID", 400));
    }

    let address = await CustomerAddress.findOne({ _id: id, userId, isDeleted: false });

    if (!address) {
        return next(new ErrorHandler("Address not found", 404));
    }

    const updateData = req.body;

    // If updating isDefault to true, unset others
    if (updateData.isDefault === true) {
        await CustomerAddress.updateMany(
            { userId },
            { $set: { isDefault: false } }
        );
    }

    address = await CustomerAddress.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
    }).select("-__v");

    res.ok(address, "Address updated successfully");
});

// @desc    Delete an address by ID for the logged-in customer
// @route   DELETE /api/v1/customer-address/delete/:id
// @access  Private (customer)
exports.deleteCustomerAddress = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const { id } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return next(new ErrorHandler("Invalid address ID", 400));
    }

    // soft delete
    const address = await CustomerAddress.findOne({ _id: id, userId });
    if (!address) {
        return next(new ErrorHandler("Address not found", 404));
    }
    // check if address is default
    if (address.isDefault) {
        return next(new ErrorHandler("Cannot delete default address", 400));
    }

    address.isDeleted = true;
    await address.save();

    res.ok(null, "Address deleted successfully");
});
