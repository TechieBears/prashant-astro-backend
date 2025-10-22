const asyncHandler = require('express-async-handler');
const User = require('../auth/user.Model');
const CustomerUser = require('./customerUser.model');
const ErrorHander = require('../../utils/errorHandler');
const sendEmail = require('../../services/email.service');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Wallet = require('../wallet/wallet.model');

const sendUser = (user, profile) => ({
    _id: user._id,
    title: profile.title,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: user.email,
    phone: user.mobileNo,
    profileImage: user.profileImage,
    gender: profile.gender,
    mobileNo: user.mobileNo,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
});

// @desc    Create new customer user with token
// @route   POST /api/customer/register
// @access  Public
// exports.createCustomerUser = asyncHandler(async (req, res, next) => {
//     const { email, password, mobileNo, firstName, lastName, title, registerType, } = req.body;

//     // check if registerType is 'google' or 'normal'
//     if (!['google', 'normal'].includes(registerType)) {
//         return next(new ErrorHander("Invalid register type", 400));
//     }

//     // Check if email already exists
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//         if (existingUser.isActive === true || existingUser.isDeleted === false) {
//             return next(new ErrorHander("User with this email already exists", 400));
//         }
//     }

//     // Start a session
//     const session = await mongoose.startSession();
//     session.startTransaction();

//     let customerUser;
//     let user;

//     try {
//         if (existingUser) {
//             customerUser = await CustomerUser.findOneAndUpdate(
//                 { _id: existingUser.profile },
//                 { $set: { firstName, lastName, title } },
//                 { new: true }
//             );

//             user = await User.findOneAndUpdate(
//                 { _id: existingUser._id },
//                 { $set: { mobileNo, isActive: true, isDeleted: false } },
//                 { new: true }
//             );

//             customerUser = [customerUser];
//             user = [user];

//         } else {
//             // 1. Create Customer profile
//             customerUser = await CustomerUser.create(
//                 [
//                     {
//                         firstName,
//                         lastName,
//                         title,
//                     },
//                 ],
//                 { session }
//             );

//             // 2. Create linked User
//             user = await User.create(
//                 [
//                     {
//                         email,
//                         password,
//                         mobileNo,
//                         profileImage: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
//                         role: "customer",
//                         profile: customerUser[0]._id,
//                     }
//                 ],
//                 { session }
//             );
//             // 3. Commit
//             await session.commitTransaction();
//             session.endSession();
//         }

//         // token for immediate login after registration
//         const token = user[0].generateAuthToken();

//         switch (registerType) {
//             case 'google': {
//                 res.ok({ token, user: sendUser(user[0], customerUser[0]) }, "Customer user created successfully");
//                 break;
//             }
//             case 'normal': {
//                 res.ok({ user: sendUser(user[0], customerUser[0]) }, "Customer user created successfully");
//                 break;
//             }
//             default:
//                 break;
//         }
//     } catch (error) {
//         // ❌ Rollback
//         await session.abortTransaction();
//         session.endSession();
//         return next(error);
//     }
// });
exports.createCustomerUser = asyncHandler(async (req, res, next) => {
  const {
    email,
    password,
    mobileNo,
    profileImage,
    firstName,
    lastName,
    title,
    registerType,
    gender,
    referralCode, // 👈 referral code entered by new user
  } = req.body;

  console.log("req.body: ", req.body);

  // Validate registerType
  if (!["google", "normal"].includes(registerType)) {
    return next(new ErrorHander("Invalid register type", 400));
  }

  // Check existing user
  const existingUser = await User.findOne({ email }).populate("profile");

  // ---------------- GOOGLE REGISTER/LOGIN FLOW ----------------
  if (registerType === "google") {
    if (existingUser) {
      const token = existingUser.generateAuthToken();
      return res.ok(
        { token, user: sendUser(existingUser, existingUser.profile) },
        "Customer Registered Successfully"
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1️⃣ Create Customer
      const customerUser = await CustomerUser.create(
        [
          {
            firstName,
            lastName,
            title,
            gender,
          },
        ],
        { session }
      );

      // 2️⃣ Create Wallet (check referral)
      const initialBalance = referralCode ? 200 : 0;
      const wallet = await Wallet.create(
        [
          {
            balance: initialBalance,
          },
        ],
        { session }
      );

      // 3️⃣ Link wallet to customer
      customerUser[0].wallet = wallet[0]._id;
      await customerUser[0].save({ session });

      // 4️⃣ Create User
      const user = await User.create(
        [
          {
            email,
            // password: null,
            mobileNo: mobileNo || undefined,
            role: "customer",
            profileImage: profileImage || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
            profile: customerUser[0]._id,
            type: "google",
          },
        ],
        { session }
      );

      // 5️⃣ If referral code exists, verify it and reward referrer (optional)
      if (referralCode) {
        const referrer = await CustomerUser.findOne({ referralCode }).populate("walletId");

        if (referrer && referrer.wallet) {
          referrer.wallet.balance += 200; // add ₹200 to referrer
          await referrer.wallet.save({ session });
        }
      }

      await session.commitTransaction();
      session.endSession();

      const token = user[0].generateAuthToken();

      return res.ok(
        { token, user: sendUser(user[0], customerUser[0]) },
        "Customer Registered Successfully"
      );
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      return next(error);
    }
  }

  // ---------------- NORMAL REGISTRATION FLOW ----------------
  if (registerType === "normal") {
    if (existingUser) {
      if (existingUser.isActive === true || existingUser.isDeleted === false) {
        return next(new ErrorHander("User with this email already exists", 400));
      }
    }
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let customerUser;
      let user;
      if (existingUser) {
        customerUser = await CustomerUser.findOneAndUpdate(
          { _id: existingUser.profile },
          { $set: { firstName, lastName, title } },
          { new: true }
        );

        user = await User.findOneAndUpdate(
          { _id: existingUser._id },
          { $set: { mobileNo, isActive: true, isDeleted: false } },
          { new: true }
        );

        customerUser = [customerUser];
        user = [user];

      } else {
        // 1️⃣ Create Customer
        customerUser = await CustomerUser.create(
          [
            {
              firstName,
              lastName,
              title,
            },
          ],
          { session }
        );

        // 4️⃣ Create User
        user = await User.create(
          [
            {
              email,
              password,
              mobileNo,
              role: "customer",
              profileImage: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
              profile: customerUser[0]._id,
              type: "normal",
            },
          ],
          { session }
        );

        // 5️⃣ Handle referral reward for referrer (if code provided)
        if (referralCode) {
          const referrer = await CustomerUser.findOne({ referralCode }).populate("walletId");

          if (referrer && referrer.walletId) {
            referrer.walletId.balance += 200; // reward referrer
            await referrer.walletId.save({ session });
          }
        }
      }
      // 2️⃣ Create Wallet (check referral)
      // const initialBalance = referralCode ? 200 : 0;                // If both referer and referred needs credited
      const initialBalance = 0;                                        // If only referred needs credited
      const wallet = await Wallet.create(
        [
          {
            balance: initialBalance,
          },
        ],
        { session }
      );

      // 3️⃣ Link wallet to customer
      customerUser[0].walletId = wallet[0]._id;
      await customerUser[0].save({ session });

      await session.commitTransaction();
      session.endSession();

      const token = user[0].generateAuthToken();

      return res.ok(
        { token, user: sendUser(user[0], customerUser[0]) },
        "Customer user created successfully"
      );
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      return next(error);
    }
  }
});

// @desc    Update customer user
// @route   PUT /api/customer/:id
// @access  Private/Customer
exports.updateCustomerUser = asyncHandler(async (req, res) => {
    console.log(req.body);
    const customerId = req.user.profile._id;

    if (!customerId) {
        throw new ErrorHander("Please provide customer id", 400);
    }

    const customer = await CustomerUser.findById(customerId);
    if (!customer) {
        throw new ErrorHander("Customer not found", 404);
    }

    // Update profile fields
    const { firstName, lastName, title, profileImage, email, mobileNo, isActive, gender } = req.body;

    if (firstName !== undefined) customer.firstName = firstName;
    if (lastName !== undefined) customer.lastName = lastName;
    if (title !== undefined) customer.title = title;
    if (gender !== undefined) customer.gender = gender;
    await customer.save();

    // Update linked user fields
    const user = await User.findOne({ profile: customer._id, role: 'customer' });
    if (!user) {
        // If somehow user is missing, still return updated profile
        return res.ok({ user: sendUser({ _id: null, email: email || null, mobileNo: mobileNo || null, role: 'customer', isActive: true, createdAt: customer.createdAt }, customer) }, "Customer updated successfully");
    }

    // If email is changing, ensure uniqueness
    if (email && email !== user.email) {
        const existing = await User.findOne({ email });
        if (existing && existing._id.toString() !== user._id.toString()) {
            throw new ErrorHander("User with this email already exists", 400);
        }
        user.email = email;
    }
    if (mobileNo !== undefined) user.mobileNo = mobileNo;
    if (isActive !== undefined) user.isActive = isActive;
    if (profileImage !== undefined) user.profileImage = profileImage;
    await user.save();
    return res.ok({ user: sendUser(user, customer) }, "Customer updated successfully");
});

// @desc    Admin update customer user
// @route   PUT /api/customer/admin-update
// @access  Private/Admin
exports.adminUpdateCustomerUser = asyncHandler(async (req, res, next) => {
    const customerId = req.query.id;
    console.log("🚀 ~ customerId:", customerId);
    if (!customerId) return next(new ErrorHander("Please provide customer id", 400));

    const customer = await CustomerUser.findById(customerId);
    console.log("🚀 ~ customer:", customer);
    if (!customer) return next(new ErrorHander("Customer not found", 404));

    const user = await User.findOne({ profile: customer._id, role: 'customer' });
    if (!user) return next(new ErrorHander("Linked user not found", 404));

    // Update profile fields
    const { firstName, lastName, title, profileImage, email, phone, isActive, isDeleted } = req.body;
    console.log("🚀 ~ isActive:", isActive);

    if (firstName !== undefined) customer.firstName = firstName;
    if (lastName !== undefined) customer.lastName = lastName;
    if (title !== undefined) customer.title = title;
    await customer.save();

    // Update linked user fields
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (isActive !== undefined) user.isActive = isActive;
    if (isDeleted !== undefined) user.isDeleted = isDeleted;
    if (profileImage !== undefined) user.profileImage = profileImage;
    console.log("🚀 ~ user:", user);
    await user.save();

    return res.ok({ user: sendUser(user, customer) }, "Customer updated successfully");
});

// @desc    Delete customer user
// @route   DELETE /api/customer/:id
// @access  Private/Customer
exports.deleteCustomerUser = asyncHandler(async (req, res, next) => {
    const customerId = req.user.profile._id;
    if (!customerId) return next(new ErrorHander("Please provide customer id", 400));

    const customer = await CustomerUser.findById(customerId);
    if (!customer) return next(new ErrorHander("Customer not found", 404));

    const user = await User.findOne({ profile: customer._id, role: 'customer' });
    if (!user) return next(new ErrorHander("Linked user not found", 404));

    // Delete profile image from Cloudinary if exists
    if (user.profileImage?.imageId) {
        try {
            await deleteImageFromCloudinary(user.profileImage.imageId);
        } catch (err) {
            // Log and continue
            console.error('Failed to delete profile image from Cloudinary:', err.message);
        }
    }

    // Soft delete user account
    user.isActive = false;
    user.isDeleted = true;
    await user.save();

    res.ok(null, "Customer deleted successfully");
});

// @desc    Get all customer users for excel download
// @route   GET /api/customer/all
// @access  Private/Admin
exports.getAllCustomerUsers = asyncHandler(async (req, res) => {
    const users = await User.find({ role: 'customer' })
        .populate('profile')
        .sort({ createdAt: -1 });

    const data = users.map(u => sendUser(u, u.profile));
    res.ok(data, "Customer users fetched successfully");
});

// @desc    Get all customer users with pagination + filters
// @route   GET /api/customer/get-all?page=1&limit=10&name=rohit
// @access  Private/Admin
exports.getAllCustomerUsersWithPagination = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const pipeline = [
        { $match: { role: "customer", isDeleted: false } },

        // join with customer profile
        {
            $lookup: {
                from: "customers", // collection name from model "customer"
                localField: "profile",
                foreignField: "_id",
                as: "profile"
            }
        },
        { $unwind: "$profile" },

        // join with addresses inside profile
        {
            $lookup: {
                from: "customeraddresses", // collection name from model "customerAddress"
                localField: "profile.addresses",
                foreignField: "_id",
                as: "profile.addresses"
            }
        }
    ];

    // 🔍 filter by name if provided
    if (req.query.name) {
        pipeline.push({
            $addFields: {
                fullname: { $concat: ["$profile.firstName", " ", "$profile.lastName"] }
            }
        })
        pipeline.push({
            $match: { fullname: { $regex: req.query.name, $options: "i" } }
        });
    }

    // exclude sensitive fields
    pipeline.push({
        $project: {
            password: 0,
            resetPasswordToken: 0,
            resetPasswordExpire: 0,
            __v: 0,
            updatedAt: 0
        }
    });

    // sort + paginate
    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limit });

    const users = await User.aggregate(pipeline);

    // 📊 count with same filters (but no pagination)
    const countPipeline = pipeline.filter(
        stage => !("$skip" in stage) && !("$limit" in stage) && !("$sort" in stage)
    );
    countPipeline.push({ $count: "total" });

    const countAgg = await User.aggregate(countPipeline);
    const total = countAgg.length > 0 ? countAgg[0].total : 0;
    const totalPages = Math.ceil(total / limit);

    res.paginated(
        users,
        { page, limit, total, totalPages },
        "Customer users fetched successfully"
    );
});

// @desc    Get single customer user by admin
// @route   GET /api/customer/get-single?id=customerId
// @access  Private/Admin
exports.getSingleCustomerUser = asyncHandler(async (req, res, next) => {
    const customerId = req.query.id;
    if (!customerId) return next(new ErrorHander("Please provide customer id", 400));

    const customer = await CustomerUser.findById(customerId);
    if (!customer) return next(new ErrorHander("Customer not found", 404));

    const user = await User.findOne({ profile: customer._id, role: 'customer' });
    if (!user) return next(new ErrorHander("Linked user not found", 404));

    res.ok({ user: sendUser(user, customer) }, "Customer user fetched successfully");
});

// @desc    POST forgot password
// @route   POST /api/customer/forgot-password
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
    const { email } = req.body;

    // 1. Validate email
    if (!email) {
        return next(new ErrorHander("Please provide email", 400));
    }

    // 2. Find customer by email
    const customer = await User.findOne({ email }).populate('profile');
    if (!customer) {
        return next(new ErrorHander("Customer not found with this email", 404));
    }

    // 3. Check if account is active
    if (customer.isActive !== true) {
        return next(new ErrorHander("Account is not active", 403));
    }

    // 4. Generate reset password token
    const resetToken = customer.getResetPasswordToken();
    await customer.save({ validateBeforeSave: false });

    // 5. Create reset password URL
    const resetPasswordUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/password/reset/${resetToken}`;

    // 6. Email message
    const message = `
        <h2>Password Reset Request</h2>
        <p>Hello ${customer.profile.firstName} ${customer.profile.lastName},</p>
        <p>You requested a password reset for your SoulPlan account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetPasswordUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a>
        <p>This link will expire in 10 minutes.</p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <p>Best regards,<br>The SoulPlan Team</p>
    `;

    try {
        // 7. Send email
        await sendEmail({
            email: customer.email,
            subject: "SoulPlan - Password Reset Request",
            message: message
        });

        res.ok(null, "Password reset email sent successfully");
    } catch (error) {
        // 8. If email fails, reset the token fields
        customer.resetPasswordToken = undefined;
        customer.resetPasswordExpire = undefined;
        await customer.save({ validateBeforeSave: false });

        return next(new ErrorHander("Email could not be sent", 500));
    }
});

// @desc    POST reset password
// @route   POST /api/customer/reset-password
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
    const { token, password } = req.body;

    // 1. Validate input
    if (!token || !password) {
        return next(new ErrorHander("Please provide token and new password", 400));
    }

    // 2. Hash the token to compare with stored hash
    const resetPasswordToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    // 3. Find customer with valid token and not expired
    const customer = await User.findOne({
        resetPasswordToken: resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
    }).populate('profile');

    if (!customer) {
        return next(new ErrorHander("Invalid or expired reset token", 400));
    }

    // 4. Check if account is active
    if (customer.isActive !== true) {
        return next(new ErrorHander("Account is not active", 403));
    }

    // 5. Set new password
    customer.password = password;
    customer.resetPasswordToken = undefined;
    customer.resetPasswordExpire = undefined;
    await customer.save();

    // 6. Generate new JWT token
    const newToken = customer.generateAuthToken();

    // 7. Send success response
    res.ok({ token: newToken, customer: sendUser(customer, customer.profile) }, "Password reset successfully");
});