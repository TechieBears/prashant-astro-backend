const asyncHandler = require('express-async-handler');
const User = require('../auth/user.Model');
const AdminUser = require('./adminUser.model');
const ErrorHander = require('../../utils/errorHandler');
const mongoose = require('mongoose');

const sendUser = (user, profile) => ({
    _id: user._id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});

const {
    uploadImageToCloudinary,
    deleteImageFromCloudinary,
    updateImageInCloudinary,
    getThumbnailUrl
} = require('../../services/cloudinary.service');

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
            [{ firstName, lastName, permissions: permissions? permissions : ['read', 'write', 'delete', 'manage-users', 'manage-settings'] }],
            { session }
        );

        // 2. Create linked User
        const user = await User.create(
            [
                {
                    email,
                    password,
                    mobileNo: phone,
                    profileImage: "https://cdn-icons-png.flaticon.com/512/149/149071.png",
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
            data: {user: sendUser(user[0], adminUser[0]),}
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
exports.updateAdminUser = asyncHandler(async (req, res) => {
    const adminUser = await AdminUser.findById(req.params.id);

    if (!adminUser) {
        res.status(404);
        throw new Error('Admin user not found');
    }

    // Check if user is updating their own profile or has permission
    if (adminUser._id.toString() !== req.user._id.toString() &&
        !['super-admin', 'admin'].includes(req.user.role)) {
        res.status(403);
        throw new Error('Not authorized to update this user');
    }

    const {
        firstName,
        lastName,
        email,
        phone,
        role,
        permissions,
        isActive
    } = req.body;

    // Check if email is being changed and if it already exists
    if (email && email !== adminUser.email) {
        const existingUser = await AdminUser.findOne({ email });
        if (existingUser) {
            res.status(400);
            throw new Error('Admin user with this email already exists');
        }
    }

    // Update fields
    if (firstName) adminUser.firstName = firstName;
    if (lastName) adminUser.lastName = lastName;
    if (email) adminUser.email = email;
    if (phone !== undefined) adminUser.phone = phone;

    // Handle profile image update if file is present
    if (req.file) {
        try {
            const oldImageId = adminUser.profileImage?.imageId;
            const uploadResult = await updateImageInCloudinary(oldImageId, req.file, 'profile-images');

            // Generate thumbnail URL
            const thumbnailUrl = getThumbnailUrl(uploadResult.imageId);

            adminUser.profileImage = {
                imageId: uploadResult.imageId,
                imageUrl: uploadResult.imageUrl,
                thumbnailUrl: thumbnailUrl,
                width: uploadResult.width,
                height: uploadResult.height,
                format: uploadResult.format,
                size: uploadResult.size
            };
        } catch (error) {
            res.status(400);
            throw new Error(`Profile image upload failed: ${error.message}`);
        }
    } else if (req.body.profileImage) {
        // Handle direct profile image data update
        adminUser.profileImage = req.body.profileImage;
    }

    // Only super-admin can change role and permissions
    if (req.user.role === 'super-admin') {
        if (role) adminUser.role = role;
        if (permissions) adminUser.permissions = permissions;
        if (isActive !== undefined) adminUser.isActive = isActive;
    }

    adminUser.updatedBy = req.user._id;
    await adminUser.save();

    const updatedUser = await AdminUser.findById(adminUser._id)
        .populate('createdBy', 'firstName lastName email')
        .populate('updatedBy', 'firstName lastName email')
        .select('-password');

    res.ok(updatedUser, 'Admin user updated successfully');
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