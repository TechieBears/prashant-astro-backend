const asyncHandler = require('express-async-handler');
const User = require('../auth/user.Model');
const EmployeeUser = require('./employeeUser.model');
const ErrorHander = require('../../utils/errorHandler');
const sendEmail = require('../../services/email.service');
const crypto = require('crypto');
// const { generateImageName } = require('../../utils/reusableFunctions');
const { deleteFile } = require("../../utils/storage");
const { emitCallAstrologersUpdate } = require('../../config/socket');

function parseField(value) {
    if (value === undefined || value === null) return value;

    // If it is already an object or array => return as-is
    if (typeof value === "object") return value;

    // Try JSON parsing
    try {
        return JSON.parse(value);
    } catch (e) {
        // Return original string if not JSON
        return value;
    }
}

const sendUser = (user, profile) => ({
    _id: user._id,
    email: user.email,
    mobileNo: user.mobileNo,
    profileImage: user.profileImage,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    profile: {
        _id: profile._id,
        uniqueId: profile.uniqueId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        fullName: profile.fullName,
        skills: profile.skills,
        languages: profile.languages,
        experience: profile.experience,
        startTime: profile.startTime,
        endTime: profile.endTime,
        days: profile.days,
        preBooking: profile.preBooking
    }
});

// @desc    Admin onboard new employee (credentials emailed)
// @route   POST /api/employee-users/register
// @access  Private/Admin
exports.createEmployeeUser = asyncHandler(async (req, res, next) => {
    const parsedBody = {};
    for (const key in req.body) {
        parsedBody[key] = parseField(req.body[key]);
    }
    const { firstName, lastName, email, mobileNo, employeeType, skills, languages, experience, serviceCategory, startTime, endTime, days, preBooking, about, priceCharge, agentId } = parsedBody;


    // validate fields with for loop
    for (const field of ['firstName', 'lastName', 'email', 'mobileNo', 'employeeType']) {
        if (!req.body[field]) {
            return next(new ErrorHander(`Please provide ${field}`, 400));
        }
    }

    // 1. Validate
    if (!firstName || !lastName || !email || !mobileNo || !employeeType) {
        return next(new ErrorHander("Please provide all required fields", 400));
    }

    // 2. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return next(new ErrorHander("User with this email already exists", 400));
    }

    const profileImage = req.files?.image?.[0]
        ? `${process.env.BACKEND_URL}/${process.env.MEDIA_FILE}/profile/${req.files?.image?.[0]?.filename}`
        : `https://ui-avatars.com/api/?name=${firstName}+${lastName}`;

    // 3. Create employee profile
    const employeeProfile = await EmployeeUser.create({
        employeeType,
        firstName,
        lastName,
        about,
        priceCharge,
        skills,
        languages,
        experience,
        startTime,
        endTime,
        days,
        preBooking,
        agentId,
        serviceCategory
    });

    const generateTempPassword = () => {
        const uppercase = firstName.charAt(0).toUpperCase();
        let lowercase = '';
        for (let i = 0; i < 4; i++) {
            lowercase += String.fromCharCode(97 + Math.floor(Math.random() * 26)); // a-z
        }
        const specialChar = '@';
        let digits = '';
        for (let i = 0; i < 4; i++) {
            digits += Math.floor(Math.random() * 10); // 0-9
        }
        return uppercase + lowercase + specialChar + digits;
    };

    const tempPassword = generateTempPassword();

    // 5. Create linked user
    const user = new User({
        email,
        password: tempPassword,
        profileImage,
        mobileNo,
        role: "employee",
        profile: employeeProfile._id,
        isActive: true
    });

    // 6. Reset token
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // 7. Reset URL
    const resetPasswordUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/password/reset/${resetToken}`;

    // 8. Email
    const message = `
        <h2>Welcome to AstroGuid</h2>
        <p>Hello ${employeeProfile.fullName},</p>
        <p>Your employee account has been created by the Admin.</p>
        <p><strong>Temporary Credentials</strong></p>
        <ul>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Temporary Password:</strong> ${tempPassword}</li>
        </ul>
        <p>Please reset your password using the link below:</p>
        <a href="${resetPasswordUrl}">Set Your Password</a>
        <p>This link will expire in 10 minutes.</p>
    `;

    try {
        await sendEmail({ email: user.email, subject: "Your AstroGuid Employee Account", message });
    } catch (error) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({ validateBeforeSave: false });
    }

    res.created({ user: sendUser(user, employeeProfile) }, "Employee registered successfully. Email sent.");
});

// @desc    Logout employee user
// @route   POST /api/employee-users/logout
// @access  Public
exports.logoutEmployeeUser = asyncHandler(async (req, res) => { res.ok(null, "Logged out"); });

// @desc    POST forgot password
// @route   POST /api/employee-users/forgot-password
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        return next(new ErrorHander("Please provide email", 400));
    }

    const employee = await User.findOne({ email });
    if (!employee) {
        return next(new ErrorHander("Employee not found with this email", 404));
    }

    // allow reset for inactive to finish onboarding; block only blocked/deleted
    if (employee.isActive !== true) {
        return next(new ErrorHander("Account is not active", 403));
    }

    const resetToken = employee.getResetPasswordToken();
    await employee.save({ validateBeforeSave: false });

    const resetPasswordUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/password/reset/${resetToken}`;

    const message = `
        <h2>Password Reset Request</h2>
        <p>Hello ${employee.firstName} ${employee.lastName},</p>
        <p>You requested a password reset for your AstroGuid employee account.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetPasswordUrl}" style="display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a>
        <p>This link will expire in 10 minutes.</p>
        <p>If you didn't request this password reset, please ignore this email.</p>
        <p>Best regards,<br>The AstroGuid Team</p>
    `;

    try {
        await sendEmail({
            email: employee.email,
            subject: "AstroGuid - Password Reset Request",
            message: message
        });

        res.ok(null, "Password reset email sent successfully");
    } catch (error) {
        employee.resetPasswordToken = undefined;
        employee.resetPasswordExpire = undefined;
        await employee.save({ validateBeforeSave: false });

        return next(new ErrorHander("Email could not be sent", 500));
    }
});

// @desc    POST reset password
// @route   POST /api/employee-users/reset-password
// @access  Public
exports.resetPassword = asyncHandler(async (req, res, next) => {
    const { token, password } = req.body;

    if (!token || !password) {
        return next(new ErrorHander("Please provide token and new password", 400));
    }

    const resetPasswordToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    const employee = await User.findOne({
        resetPasswordToken: resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
    }).populate('profile');

    if (!employee) {
        return next(new ErrorHander("Invalid or expired reset token", 400));
    }

    // allow inactive to complete onboarding, but block blocked/deleted
    if (employee.status === "blocked" || employee.status === "deleted") {
        return next(new ErrorHander("Account is not active", 403));
    }

    employee.password = password;
    employee.resetPasswordToken = undefined;
    employee.resetPasswordExpire = undefined;
    // activate account if it was inactive
    if (employee.isActive !== true) {
        employee.isActive = true;
    }
    await employee.save();

    const newToken = employee.generateAuthToken();

    res.ok({ token: newToken, employee: sendUser(employee, employee.profile) }, "Password reset successfully");
});

// @desc Update Employee User
// @route PUT /api/employee/update?id=employeeId
// @access Private/Admin
// exports.updateEmployeeUser = asyncHandler(async (req, res, next) => {
//     const { id } = req.query;
//     if (!id) return next(new ErrorHander("Please provide employee id", 400));

//     // 1️⃣ Find the user
//     const user = await User.findById(id);
//     if (!user) {
//         return next(new ErrorHander("Employee not found", 404));
//     }

//     await EmployeeUser.findByIdAndUpdate(user.profile, req.body, { new: true });
//     await User.findByIdAndUpdate(id, req.body, { new: true });

//     const updatedUser = await User.findById(id).populate("profile");

//     res.ok(sendUser(updatedUser, updatedUser.profile), "Employee updated successfully");
// });
exports.updateEmployeeUser = asyncHandler(async (req, res, next) => {
    const { id } = req.query;
    if (!id) return next(new ErrorHander("Please provide employee id", 400));

    // 1️⃣ Find the user
    const user = await User.findById(id);
    if (!user) {
        return next(new ErrorHander("Employee not found", 404));
    }

    // 2️⃣ Prepare update data
    const parsedBody = {};
    for (const key in req.body) {
        parsedBody[key] = parseField(req.body[key]);
    }

    let updateData = { ...parsedBody };

    // 3️⃣ Handle image upload if exists
    if (req.files?.image?.[0]) {
        // let imageName = generateImageName(req.files.image[0].filename);
        if (user.profileImage) {
            deleteFile(user.profileImage)
        }
        updateData.profileImage = `${process.env.BACKEND_URL}/${process.env.MEDIA_FILE}/profile/${req.files.image[0].filename}`
    }

    // 4️⃣ Update both documents
    await EmployeeUser.findByIdAndUpdate(user.profile, updateData, { new: true });
    await User.findByIdAndUpdate(id, updateData, { new: true });

    // 5️⃣ Fetch updated user with populated profile
    const updatedUser = await User.findById(id).populate("profile");

    res.ok(sendUser(updatedUser, updatedUser.profile), "Employee updated successfully");
});

// @desc    Delete employee user (soft delete)
// @route   DELETE /api/employee-users/delete?id=
// @access  Private/Admin
exports.deleteEmployeeUser = asyncHandler(async (req, res, next) => {
    const id = req.query.id;
    if (!id) return next(new ErrorHander("Please provide employee id", 400));

    const user = await User.findOne({ profile: id, role: "employee" });
    if (!user) return next(new ErrorHander("Employee not found", 404));

    user.isDeleted = true;
    user.isActive = false;
    await user.save();

    res.ok(null, "Employee deleted successfully");
});

// @desc    GET all employee users for excel download
// @route   GET /api/employee-users/all
// @access  Private/Admin
exports.getAllEmployeeUsers = asyncHandler(async (req, res, next) => {
    const employees = await EmployeeUser.find().select("-password -resetPasswordToken -resetPasswordExpire -createdAt -__v");
    res.ok(employees, "Employee users fetched successfully");
});

// @desc    Get single employee user by ID
// @route   GET /api/employee-users/get-single?id=
// @access  Private/Admin
exports.getSingleEmployeeUser = asyncHandler(async (req, res, next) => {
    const id = req.query.id;
    if (!id) return next(new ErrorHander("Please provide employee id", 400));

    const employee = await EmployeeUser.findById(id).select("-password -resetPasswordToken -resetPasswordExpire -createdAt -__v");
    if (!employee) return next(new ErrorHander("Employee not found", 404));

    res.ok(employee, "Employee user fetched successfully");
});

// @desc    Get all employee users with pagination
// @route   GET /api/employee-users/get-all?page=1&limit=10&name=rohit
// @access  Private/Admin
exports.getAllEmployeeUsersWithPagination = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const employeeType = req.query.employeeType; // Changed from role to employeeType

    const matchStage = { role: "employee" }; // Always filter by role = "employee"

    // 🔍 Employee type filter
    if (employeeType) {
        matchStage["profile.employeeType"] = employeeType;
    }

    // 🔍 Name search inside employee profile
    if (req.query.name) {
        matchStage.names = { $regex: req.query.name, $options: "i" };
    }

    // console.log("matchStage", matchStage);

    const employeesAgg = await User.aggregate([
        // First, filter only employee users
        { $match: { role: "employee", isDeleted: false } },

        // join with employee profile
        {
            $lookup: {
                from: "employees",
                localField: "profile",
                foreignField: "_id",
                as: "profile"
            }
        },
        { $unwind: "$profile" },

        // Add full name field for searching
        {
            $addFields: {
                names: { $concat: ["$profile.firstName", " ", "$profile.lastName"] }
            }
        },

        // Apply filters (including employeeType)
        { $match: matchStage },

        // hide sensitive fields
        {
            $project: {
                password: 0,
                resetPasswordToken: 0,
                resetPasswordExpire: 0,
                __v: 0,
                updatedAt: 0
            }
        },

        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit }
    ]);

    // 📊 Get total count (with same filters)
    const countAgg = await User.aggregate([
        { $match: { role: "employee", isDeleted: false } },
        {
            $lookup: {
                from: "employees",
                localField: "profile",
                foreignField: "_id",
                as: "profile"
            }
        },
        { $unwind: "$profile" },

        // Apply employeeType filter if provided
        ...(employeeType
            ? [
                {
                    $match: {
                        "profile.employeeType": employeeType
                    }
                }
            ]
            : []),

        // Apply name filter if provided
        ...(req.query.name
            ? [
                {
                    $match: {
                        $or: [
                            { "profile.firstName": { $regex: req.query.name, $options: "i" } },
                            { "profile.lastName": { $regex: req.query.name, $options: "i" } }
                        ]
                    }
                }
            ]
            : []),

        { $count: "total" }
    ]);

    const total = countAgg.length > 0 ? countAgg[0].total : 0;
    const totalPages = Math.ceil(total / limit);

    res.paginated(
        employeesAgg,
        { page, limit, total, totalPages },
        "Employee users fetched successfully"
    );
});

// @desc    Public - Get all employee users for astroguid listing
// @route   GET /api/employee-users/astroguid/public/get-all
// @access  Public
exports.getAllPublicEmployees = asyncHandler(async (req, res) => {
    // Fetch all users where role = employee
    const { employeeType } = req.body;
    const employees = await User.find({
        role: "employee",
        isActive: true,
        isDeleted: false,
    })
        .select("email mobileNo profileImage profile") // exclude sensitive fields
        .populate({
            path: "profile",
            model: "employee",
            match: { employeeType: employeeType }, // filter only astrologers
            select:
                "firstName lastName fullName skills languages experience profile _id employeeType"
        })
        .sort({ createdAt: -1 });;

    // destructure employee data 
    const formattedAstrologers = employees.filter(emp => {
        if (emp?.profile?.employeeType !== employeeType) return;
        return ({
            _id: emp._id,
            profileImage: emp.profileImage,
            fullName: emp.profile?.fullName,
            //   firstName: emp.profile?.firstName,
            //   lastName: emp.profile?.lastName,
            skills: emp.profile?.skills,
            empId: emp.profile?._id,
            languages: emp.profile?.languages,
            experience: emp.profile?.experience,
        });
    });

    res.ok(formattedAstrologers, "Public employee users fetched successfully");
});

exports.getAllcallAstrologerCustomer = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.body;
    const skip = (page - 1) * limit;
    const employees = await User.find({
        role: "employee",
        isActive: true,
        isDeleted: false,
    })
        .select("email mobileNo profileImage profile") // exclude sensitive fields
        .populate({
            path: "profile",
            model: "employee",
            match: { employeeType: "call_astrologer" },
            select:
                "firstName lastName fullName skills languages experience profile _id employeeType"
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
});

exports.toggleButton = asyncHandler(async (req, res, next) => {
    const { employeeId } = req.query;
    if (!employeeId) return next(new ErrorHander("Please provide employee id", 400));

    const user = await User.findById(employeeId);
    const employee = await EmployeeUser.findById(user.profile._id.toString());

    // check employee type is call_astrologer
    if (employee.employeeType !== "call_astrologer") {
        return next(new ErrorHander("You are not a call astrologer", 400));
    }

    employee.workingStatus = !employee.workingStatus;
    await employee.save();
    // 8. Emit WebSocket event to notify clients about updated employee status
    try {
        emitCallAstrologersUpdate({
            employeeId: employee._id.toString(),
            userId: astrologerUser._id.toString(),
            isBusy: false,
            message: 'Employee status updated - call ended'
        });
    } catch (socketError) {
        console.warn('⚠️ Failed to emit WebSocket update:', socketError.message);
    }
    res.ok(null, (employee.workingStatus ? "toggle on" : "toggle off"));
});