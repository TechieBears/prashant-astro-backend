const asyncHandler = require('express-async-handler');
const User = require('../auth/user.Model');
const AdminUser = require('./adminUser.model');
const ErrorHander = require('../../utils/errorHandler');
const mongoose = require('mongoose');

const sendUser = (user) => ({
  _id: user._id,
  email: user.email,
  mobileNo: user.mobileNo,
  profileImage: user.profileImage,
  firstName: user.profile.firstName || null,
  lastName: user.profile.lastName || null,
  role: user.role
});

const {
    uploadImageToCloudinary,
    deleteImageFromCloudinary,
    updateImageInCloudinary,
    getThumbnailUrl
} = require('../../services/cloudinary.service');
const { deleteFile } = require('../../utils/storage');

// @desc    Create new admin user
// @route   POST /api/admin-users
// @access  Private/Super-Admin
exports.createAdminUser = asyncHandler(async (req, res, next) => {
    const { email, password, phone, firstName, lastName, permissions } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return next(new ErrorHander("User with this email already exists", 400));
    }

    // Start a session
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // 1. Create Admin profile
        const adminUser = await AdminUser.create(
            [{ firstName, lastName, permissions: permissions ? permissions : ['read', 'write', 'delete', 'manage-users', 'manage-settings'] }],
            { session }
        );

        // 2. Create linked User
        const user = await User.create(
            [
                {
                    email,
                    password,
                    mobileNo: phone,
                    profileImage: `https://ui-avatars.com/api/?name=${firstName}+${lastName}`,
                    role: "admin",
                    profile: adminUser[0]._id,
                }
            ],
            { session }
        );

        // 3. Commit transaction
        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            success: true,
            message: "Admin user created successfully",
            data: { user: sendUser(user[0], adminUser[0]), }
        });
    } catch (error) {
        // ❌ Rollback if something fails
        await session.abortTransaction();
        session.endSession();
        return next(error);
    }
});

// @desc    Get all admin users
// @route   GET /api/admin-users
// @access  Private/Admin
exports.getAllAdminUsers = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {};

    // Filter by active status
    if (req.query.isActive !== undefined && req.query.isActive !== '') {
        query.isActive = req.query.isActive === 'true';
    }

    // Filter by role
    if (!req.query.role && req.query.role !== '') {
        query.role = req.query.role;
    }

    // Search by name or email
    if (!req.query.search && req.query.search !== '') {
        query.$or = [
            { firstName: { $regex: req.query.search, $options: 'i' } },
            { lastName: { $regex: req.query.search, $options: 'i' } },
            { email: { $regex: req.query.search, $options: 'i' } }
        ];
    }
    const adminUsers = await AdminUser.find(query)
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await AdminUser.countDocuments(query);

    res.paginated(
        adminUsers,
        { page, limit, total, pages: Math.ceil(total / limit) }
    );
});

// @desc    Get single admin user
// @route   GET /api/admin-users/:id
// @access  Private/Admin
exports.getAdminUser = asyncHandler(async (req, res) => {
    const adminUser = await AdminUser.findById(req.params.id)
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .select('-password');

    if (!adminUser) {
        res.status(404);
        throw new Error('Admin user not found');
    }

    res.ok(adminUser);
});

// @desc    Update admin user
// @route   PUT /api/admin-users/:id
// @access  Private/Admin
// exports.updateAdminUser = asyncHandler(async (req, res) => {
//     console.log('Files received in request:', req.files);
//     console.log('Body received in request:', req.body);
//     const user = await User.findById(req.user._id).populate('profile');
//     if (!user) {
//         res.status(404);
//         throw new Error('User not found');
//     }

//     // Check for uploaded file
//     if (req.files && req.files.image && req.files.image[0]) {
//         // Delete old profile image if it exists and is not the default
//         if (user.profileImage && 
//             user.profileImage !== "https://cdn-icons-png.flaticon.com/512/149/149071.png") {
//             try {
//                 await deleteFile(user.profileImage);
//             } catch (error) {
//                 console.error('Error deleting old profile image:', error);
//                 // Don't throw error, continue with update
//             }
//         }
        
//         // Set new profile image
//         req.body.profileImage = req.files.image[0].location || req.files.image[0].path;
//     }

//     await AdminUser.findByIdAndUpdate(user.profile, req.body, { new: true });
//     const updatedUser = await User.findByIdAndUpdate(req.user._id, req.body, { new: true }).populate('profile');

//     res.ok({ user: sendUser(updatedUser) }, 'Admin user updated successfully');

// });
exports.updateAdminUser = asyncHandler(async (req, res) => {
    
    // Find user with profile populated first to get current image
    const user = await User.findById(req.user._id).populate('profile');
    
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }

    // Check for uploaded file
    if (req.files && req.files.image && req.files.image[0]) {
        // Delete old profile image if it exists and is not the default
        if (user.profileImage && 
            user.profileImage !== `https://ui-avatars.com/api/?name=${firstName}+${lastName}`) {
            try {
                await deleteFile(user.profileImage);
            } catch (error) {
                console.error('Error deleting old profile image:', error);
                // Don't throw error, continue with update
            }
        }
        
        // Set new profile image
        req.body.profileImage = `${process.env.BACKEND_URL}/${process.env.MEDIA_FILE}/admin-profile/${req.files.image[0].filename}`;
    }

    // Define allowed fields that can be updated
    const allowedUserFields = ['mobileNo', 'profileImage', 'fcmToken'];
    const allowedProfileFields = ['firstName', 'lastName', 'title', 'gender']; // Adjust based on your AdminUser model
    
    // Filter req.body for user updates
    const userUpdates = {};
    allowedUserFields.forEach(field => {
        if (req.body[field] !== undefined) {
            userUpdates[field] = req.body[field];
        }
    });

    // Filter req.body for profile updates
    const profileUpdates = {};
    allowedProfileFields.forEach(field => {
        if (req.body[field] !== undefined) {
            profileUpdates[field] = req.body[field];
        }
    });

    // Update the profile (customer, admin, or employee model based on role)
    if (Object.keys(profileUpdates).length > 0) {
        await mongoose.model(user.role).findByIdAndUpdate(
            user.profile._id, 
            profileUpdates, 
            { new: true }
        );
    }

    // Update the user
    const updatedUser = await User.findByIdAndUpdate(
        req.user._id, 
        userUpdates, 
        { new: true }
    ).populate('profile');

    console.log('Updated User:', updatedUser);

    res.ok({ user: sendUser(updatedUser) }, 'Admin user updated successfully');
});

// @desc    Update admin user password
// @route   PUT /api/admin-users/:id/password
// @access  Private/Admin
exports.updateAdminUserPassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        res.status(400);
        throw new Error('Please provide current password and new password');
    }

    const adminUser = await AdminUser.findById(req.params.id).select('+password');

    if (!adminUser) {
        res.status(404);
        throw new Error('Admin user not found');
    }

    // Check if user is updating their own password or has permission
    if (adminUser._id.toString() !== req.user._id.toString() &&
        req.user.role !== 'super-admin') {
        res.status(403);
        throw new Error('Not authorized to update this user\'s password');
    }

    // Verify current password (only if user is updating their own password)
    if (adminUser._id.toString() === req.user._id.toString()) {
        const isCurrentPasswordValid = await adminUser.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            res.status(400);
            throw new Error('Current password is incorrect');
        }
    }

    // Update password
    adminUser.password = newPassword;
    adminUser.updatedBy = req.user._id;
    await adminUser.save();

    res.ok(null, 'Password updated successfully');
});

// @desc    Delete admin user (soft delete)
// @route   DELETE /api/admin-users/:id
// @access  Private/Super-Admin
exports.deleteAdminUser = asyncHandler(async (req, res) => {
    const adminUser = await AdminUser.findById(req.params.id);

    if (!adminUser) {
        res.status(404);
        throw new Error('Admin user not found');
    }

    // Prevent self-deletion
    if (adminUser._id.toString() === req.user._id.toString()) {
        res.status(400);
        throw new Error('You cannot delete your own account');
    }

    // Delete profile image from Cloudinary if it exists
    if (adminUser.profileImage?.imageId) {
        try {
            await deleteImageFromCloudinary(adminUser.profileImage.imageId);
        } catch (error) {
            console.error('Failed to delete profile image from Cloudinary:', error.message);
        }
    }

    // Soft delete by setting isActive to false
    adminUser.isActive = false;
    adminUser.updatedBy = req.user._id;
    await adminUser.save();

    res.ok(null, 'Admin user deleted successfully');
});

// @desc    Restore admin user
// @route   PUT /api/admin-users/:id/restore
// @access  Private/Super-Admin
exports.restoreAdminUser = asyncHandler(async (req, res) => {
    const adminUser = await AdminUser.findById(req.params.id);

    if (!adminUser) {
        res.status(404);
        throw new Error('Admin user not found');
    }

    adminUser.isActive = true;
    adminUser.updatedBy = req.user._id;
    await adminUser.save();

    const restoredUser = await AdminUser.findById(adminUser._id)
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .select('-password');

    res.ok(restoredUser, 'Admin user restored successfully');
});

// @desc    Get admin user statistics
// @route   GET /api/admin-users/stats
// @access  Private/Admin
exports.getAdminUserStats = asyncHandler(async (req, res) => {
    const totalUsers = await AdminUser.countDocuments();
    const activeUsers = await AdminUser.countDocuments({ isActive: true });
    const inactiveUsers = await AdminUser.countDocuments({ isActive: false });

    const roleStats = await AdminUser.aggregate([
        {
            $group: {
                _id: '$role',
                count: { $sum: 1 }
            }
        }
    ]);

    const recentUsers = await AdminUser.find()
        .select('firstName lastName email role createdAt')
        .sort({ createdAt: -1 })
        .limit(5);

    res.ok({
        totalUsers,
        activeUsers,
        inactiveUsers,
        roleStats,
        recentUsers
    });
});