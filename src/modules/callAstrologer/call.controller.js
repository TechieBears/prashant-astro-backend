const asyncHandler = require("express-async-handler");
const CallAstrologer = require("./call.model");
const User = require("../auth/user.Model");
const Employee = require("../employeeUser/employeeUser.model");
const Wallet = require("../wallet/wallet.model");
const { startWalletTimer } = require("./callTimer.service");
const mongoose = require("mongoose");

// Cache filter results for 1 hour (optional)
const filterCache = new Map();

exports.createCall = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { callAstrologerId, date, time, duration } = req.body;
    if (!userId || !callAstrologerId || !date || !time || !duration) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const call = await CallAstrologer.create({ userId, astrologerId: callAstrologerId, date, time, duration });
    res.created(call, 'Call created successfully');
});

exports.startCall = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { astrologerId } = req.body;

    const user = await User.findById(userId);
    const astrologer = await User.findById(astrologerId).populate("profile");
    const employee = await Employee.findById(astrologer.profile);
    const wallet = await Wallet.findOne({ userId });

    if (!astrologer) {
        return res.status(404).json({ message: "Astrologer not found" });
    }

    if (employee.isBusy) {
        return res.status(400).json({ message: "Astrologer is currently busy" });
    }

    const perMinRate = employee.priceCharge;
    const perSec = perMinRate / 60;

    if (!wallet || wallet.balance < perSec * 30) {
        return res.status(400).json({
            message: "Insufficient balance for minimum 30 seconds",
        });
    }

    // Create call
    const call = await CallAstrologer.create({
        userId,
        astrologerId,
        date: new Date(),
        time: new Date().toISOString(),
        duration: "0",
        status: "pending",
    });

    // Smartflo actions...
    const sessionResponse = await axios.post(
        "https://api-smartflo.tatateleservices.com/v1/dialer/session_call",
        {
            startOrEnd: true,
            campaignId: process.env.SMARTFLO_CAMPAIGN_ID,
        },
        {
            headers: { Authorization: `Bearer ${process.env.SMARTFLO_TOKEN}` },
        }
    );

    const clickResponse = await axios.post(
        "https://api-smartflo.tatateleservices.com/v1/click_to_call",
        {
            agent_number: "+91" + employee.mobile, // use astrologer mobile
            customer_number: user.mobileNo,
        },
        {
            headers: { Authorization: `Bearer ${process.env.SMARTFLO_TOKEN}` },
        }
    );

    call.sessionId = sessionResponse.data?.sessionId || null;
    call.smartfloCallId = clickResponse.data?.call_id || null;
    await call.save();

    // Mark astrologer busy
    employee.isBusy = true;
    employee.currentCustomerId = userId;
    await employee.save();

    // Save user session
    user.currentCallSession = {
        astrologerId,
        callId: call._id,
        isActive: true,
        perMinuteRate: perMinRate,
        startedAt: new Date(),
    };
    await user.save();

    // Start wallet timer
    startWalletTimer(user._id);

    return res.json({
        success: true,
        message: "Call initiated",
        callId: call._id,
    });
});


// exports.getAllCallAstrologersCustomer = asyncHandler(async (req, res) => {
//     const {
//         page = 1,
//         limit = 10,
//         languages,
//         skills,
//         minPrice,
//         maxPrice,
//         experience,
//         days,
//         preBooking,
//         search
//     } = req.query;

//     // Validate query parameters
//     const pageNum = parseInt(page);
//     const limitNum = parseInt(limit);

//     if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
//         return res.status(400).json({
//             success: false,
//             message: 'Invalid pagination parameters'
//         });
//     }

//     const skip = (pageNum - 1) * limitNum;

//     try {
//         // Build match conditions dynamically
//         const userMatchConditions = {
//             role: "astrologer",
//             isActive: true,
//             isDeleted: { $ne: true },
//             profile: { $exists: true, $ne: null }
//         };

//         // Build employee match conditions
//         const employeeMatchConditions = {
//             "employeeProfile.employeeType": "call_astrologer"
//         };

//         // Parse filter parameters
//         if (languages) {
//             const languageArray = Array.isArray(languages)
//                 ? languages
//                 : languages.split(',');
//             employeeMatchConditions["employeeProfile.languages"] = {
//                 $in: languageArray.map(lang => new RegExp(lang.trim(), 'i'))
//             };
//         }

//         if (skills) {
//             const skillArray = Array.isArray(skills)
//                 ? skills
//                 : skills.split(',');
//             employeeMatchConditions["employeeProfile.skills"] = {
//                 $in: skillArray.map(skill => new RegExp(skill.trim(), 'i'))
//             };
//         }

//         if (minPrice || maxPrice) {
//             employeeMatchConditions["employeeProfile.priceCharge"] = {};
//             if (minPrice) {
//                 employeeMatchConditions["employeeProfile.priceCharge"].$gte = parseFloat(minPrice);
//             }
//             if (maxPrice) {
//                 employeeMatchConditions["employeeProfile.priceCharge"].$lte = parseFloat(maxPrice);
//             }
//         }

//         if (experience) {
//             const experienceArray = Array.isArray(experience)
//                 ? experience.map(exp => parseInt(exp))
//                 : [parseInt(experience)];
//             employeeMatchConditions["employeeProfile.experience"] = {
//                 $in: experienceArray
//             };
//         }

//         if (days) {
//             const daysArray = Array.isArray(days)
//                 ? days
//                 : days.split(',');
//             employeeMatchConditions["employeeProfile.days"] = {
//                 $in: daysArray.map(day => new RegExp(day.trim(), 'i'))
//             };
//         }

//         if (preBooking !== undefined) {
//             employeeMatchConditions["employeeProfile.preBooking"] =
//                 preBooking === 'true' || preBooking === true;
//         }

//         // Search functionality (search in name or about)
//         if (search) {
//             employeeMatchConditions.$or = [
//                 { "employeeProfile.firstName": { $regex: search, $options: 'i' } },
//                 { "employeeProfile.lastName": { $regex: search, $options: 'i' } },
//                 { "employeeProfile.about": { $regex: search, $options: 'i' } }
//             ];
//         }

//         // Pipeline for data retrieval
//         const dataPipeline = [
//             // Match users
//             {
//                 $match: userMatchConditions
//             },
//             // Lookup employee profile
//             {
//                 $lookup: {
//                     from: "employees",
//                     localField: "profile",
//                     foreignField: "_id",
//                     as: "employeeProfile"
//                 }
//             },
//             // Unwind employee profile
//             {
//                 $unwind: "$employeeProfile"
//             },
//             // Filter only call_astrologer type and apply other filters
//             {
//                 $match: employeeMatchConditions
//             },
//             // Sort by creation date (newest first)
//             {
//                 $sort: { createdAt: -1 }
//             },
//             // Skip and limit for pagination
//             {
//                 $skip: skip
//             },
//             {
//                 $limit: limitNum
//             },
//             // Project only needed fields
//             {
//                 $project: {
//                     _id: 1,
//                     email: 1,
//                     mobileNo: 1,
//                     profileImage: 1,
//                     createdAt: 1,
//                     updatedAt: 1,
//                     "employeeProfile._id": 1,
//                     "employeeProfile.firstName": 1,
//                     "employeeProfile.lastName": 1,
//                     "employeeProfile.about": 1,
//                     "employeeProfile.priceCharge": 1,
//                     "employeeProfile.skills": 1,
//                     "employeeProfile.experience": 1,
//                     "employeeProfile.employeeType": 1,
//                     "employeeProfile.languages": 1,
//                     "employeeProfile.startTime": 1,
//                     "employeeProfile.endTime": 1,
//                     "employeeProfile.days": 1,
//                     "employeeProfile.preBooking": 1
//                 }
//             }
//         ];

//         // Pipeline for counting total call_astrologers with filters
//         const countPipeline = [
//             {
//                 $match: userMatchConditions
//             },
//             {
//                 $lookup: {
//                     from: "employees",
//                     localField: "profile",
//                     foreignField: "_id",
//                     as: "employeeProfile"
//                 }
//             },
//             {
//                 $unwind: "$employeeProfile"
//             },
//             {
//                 $match: employeeMatchConditions
//             },
//             {
//                 $count: "total"
//             }
//         ];

//         // Execute both pipelines in parallel
//         const [dataResult, countResult] = await Promise.all([
//             User.aggregate(dataPipeline),
//             User.aggregate(countPipeline)
//         ]);

//         const total = countResult[0]?.total || 0;

//         // Format the response
//         const formattedData = dataResult.map(item => {
//             return {
//                 _id: item._id,
//                 email: item.email,
//                 mobileNo: item.mobileNo,
//                 profileImage: item.profileImage,
//                 createdAt: item.createdAt,
//                 updatedAt: item.updatedAt,
//                 profile: {
//                     _id: item.employeeProfile._id,
//                     firstName: item.employeeProfile.firstName,
//                     lastName: item.employeeProfile.lastName,
//                     fullName: `${item.employeeProfile.firstName} ${item.employeeProfile.lastName}`,
//                     about: item.employeeProfile.about,
//                     priceCharge: item.employeeProfile.priceCharge,
//                     skills: item.employeeProfile.skills,
//                     experience: item.employeeProfile.experience,
//                     employeeType: item.employeeProfile.employeeType,
//                     languages: item.employeeProfile.languages,
//                     startTime: item.employeeProfile.startTime,
//                     endTime: item.employeeProfile.endTime,
//                     days: item.employeeProfile.days,
//                     preBooking: item.employeeProfile.preBooking
//                 }
//             };
//         });

//         const totalPages = Math.ceil(total / limitNum);

//         const response = {
//             success: true,
//             data: formattedData,
//             pagination: {
//                 currentPage: pageNum,
//                 limit: limitNum,
//                 totalItems: total,
//                 totalPages,
//                 hasNextPage: pageNum < totalPages,
//                 hasPrevPage: pageNum > 1,
//                 appliedFilters: {
//                     languages: languages ? (Array.isArray(languages) ? languages : languages.split(',')) : undefined,
//                     skills: skills ? (Array.isArray(skills) ? skills : skills.split(',')) : undefined,
//                     priceRange: minPrice || maxPrice ? {
//                         min: minPrice ? parseFloat(minPrice) : undefined,
//                         max: maxPrice ? parseFloat(maxPrice) : undefined
//                     } : undefined,
//                     experience: experience ? (Array.isArray(experience) ? experience.map(exp => parseInt(exp)) : [parseInt(experience)]) : undefined,
//                     days: days ? (Array.isArray(days) ? days : days.split(',')) : undefined,
//                     preBooking: preBooking !== undefined ? (preBooking === 'true' || preBooking === true) : undefined,
//                     search: search || undefined
//                 }
//             }
//         };

//         if (res.paginated) {
//             res.paginated(formattedData, {
//                 page: pageNum,
//                 limit: limitNum,
//                 total,
//                 totalPages
//             });
//         } else {
//             res.status(200).json(response);
//         }

//     } catch (error) {
//         console.error('Error fetching call astrologers:', error);

//         if (error.name === 'CastError') {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Invalid parameters'
//             });
//         }

//         res.status(500).json({
//             success: false,
//             message: 'Server error while fetching call astrologers'
//         });
//     }
// });
exports.getAllCallAstrologersCustomer = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        languages,
        skills,
        minPrice,
        maxPrice,
        experience,
        days,
        preBooking,
        search,
        sortBy = 'newest'  // Add sortBy parameter
    } = req.query;

    // Validate query parameters
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
            success: false,
            message: 'Invalid pagination parameters'
        });
    }

    const skip = (pageNum - 1) * limitNum;

    try {
        // Build match conditions dynamically
        const userMatchConditions = {
            role: "astrologer",
            isActive: true,
            isDeleted: { $ne: true },
            profile: { $exists: true, $ne: null }
        };

        // Build employee match conditions
        const employeeMatchConditions = {
            "employeeProfile.employeeType": "call_astrologer"
        };

        // Parse filter parameters - FIXED FOR ARRAYS
        if (languages) {
            const languageArray = Array.isArray(languages)
                ? languages
                : languages.split(',');
            employeeMatchConditions["employeeProfile.languages"] = {
                $elemMatch: {
                    $in: languageArray.map(lang => new RegExp(`^${lang.trim()}$`, 'i'))
                }
            };
        }

        if (skills) {
            const skillArray = Array.isArray(skills)
                ? skills
                : skills.split(',');
            employeeMatchConditions["employeeProfile.skills"] = {
                $elemMatch: {
                    $in: skillArray.map(skill => new RegExp(`^${skill.trim()}$`, 'i'))
                }
            };
        }

        // Price filter - FIXED: Check if priceCharge exists and is a number
        if (minPrice || maxPrice) {
            employeeMatchConditions["employeeProfile.priceCharge"] = {};
            if (minPrice) {
                employeeMatchConditions["employeeProfile.priceCharge"].$gte = parseFloat(minPrice);
            }
            if (maxPrice) {
                employeeMatchConditions["employeeProfile.priceCharge"].$lte = parseFloat(maxPrice);
            }
        }

        if (experience) {
            const experienceArray = Array.isArray(experience)
                ? experience.map(exp => parseInt(exp))
                : [parseInt(experience)];
            employeeMatchConditions["employeeProfile.experience"] = {
                $in: experienceArray
            };
        }

        if (days) {
            const daysArray = Array.isArray(days)
                ? days
                : days.split(',');
            employeeMatchConditions["employeeProfile.days"] = {
                $elemMatch: {
                    $in: daysArray.map(day => new RegExp(`^${day.trim()}$`, 'i'))
                }
            };
        }

        if (preBooking !== undefined) {
            employeeMatchConditions["employeeProfile.preBooking"] =
                preBooking === 'true' || preBooking === true;
        }

        // Search functionality (search in name or about)
        if (search) {
            employeeMatchConditions.$or = [
                { "employeeProfile.firstName": { $regex: search, $options: 'i' } },
                { "employeeProfile.lastName": { $regex: search, $options: 'i' } },
                { "employeeProfile.about": { $regex: search, $options: 'i' } }
            ];
        }

        // Define sort object based on sortBy parameter
        let sortObject = { createdAt: -1 }; // Default sort: newest first

        switch (sortBy) {
            case 'price_low_to_high':
                sortObject = { "employeeProfile.priceCharge": 1 };
                break;
            case 'price_high_to_low':
                sortObject = { "employeeProfile.priceCharge": -1 };
                break;
            case 'newest':
                sortObject = { createdAt: -1 };
                break;
            case 'oldest':
                sortObject = { createdAt: 1 };
                break;
            case 'experience_high_to_low':
                sortObject = { "employeeProfile.experience": -1 };
                break;
            case 'experience_low_to_high':
                sortObject = { "employeeProfile.experience": 1 };
                break;
            default:
                // If invalid sortBy, default to newest
                sortObject = { createdAt: -1 };
        }

        // Pipeline for data retrieval
        const dataPipeline = [
            // Match users
            {
                $match: userMatchConditions
            },
            // Lookup employee profile
            {
                $lookup: {
                    from: "employees",
                    localField: "profile",
                    foreignField: "_id",
                    as: "employeeProfile"
                }
            },
            // Unwind employee profile
            {
                $unwind: "$employeeProfile"
            },
            // Filter only call_astrologer type and apply other filters
            {
                $match: employeeMatchConditions
            },
            // Add fields for proper sorting (handle null/undefined prices)
            {
                $addFields: {
                    "employeeProfile.sortPrice": {
                        $ifNull: ["$employeeProfile.priceCharge", 0]
                    },
                    "employeeProfile.sortExperience": {
                        $ifNull: ["$employeeProfile.experience", 0]
                    }
                }
            },
            // Sort based on sortBy parameter
            {
                $sort: sortObject
            },
            // Skip and limit for pagination
            {
                $skip: skip
            },
            {
                $limit: limitNum
            },
            // Project only needed fields
            {
                $project: {
                    _id: 1,
                    email: 1,
                    mobileNo: 1,
                    profileImage: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    "employeeProfile._id": 1,
                    "employeeProfile.firstName": 1,
                    "employeeProfile.lastName": 1,
                    "employeeProfile.about": 1,
                    "employeeProfile.priceCharge": 1,
                    "employeeProfile.skills": 1,
                    "employeeProfile.experience": 1,
                    "employeeProfile.employeeType": 1,
                    "employeeProfile.languages": 1,
                    "employeeProfile.startTime": 1,
                    "employeeProfile.endTime": 1,
                    "employeeProfile.days": 1,
                    "employeeProfile.preBooking": 1
                }
            }
        ];

        // Pipeline for counting total call_astrologers with filters
        const countPipeline = [
            {
                $match: userMatchConditions
            },
            {
                $lookup: {
                    from: "employees",
                    localField: "profile",
                    foreignField: "_id",
                    as: "employeeProfile"
                }
            },
            {
                $unwind: "$employeeProfile"
            },
            {
                $match: employeeMatchConditions
            },
            {
                $count: "total"
            }
        ];

        // Execute both pipelines in parallel
        const [dataResult, countResult] = await Promise.all([
            User.aggregate(dataPipeline),
            User.aggregate(countPipeline)
        ]);

        const total = countResult[0]?.total || 0;

        // Format the response
        const formattedData = dataResult.map(item => {
            return {
                _id: item._id,
                email: item.email,
                mobileNo: item.mobileNo,
                profileImage: item.profileImage,
                createdAt: item.createdAt,
                updatedAt: item.updatedAt,
                profile: {
                    _id: item.employeeProfile._id,
                    firstName: item.employeeProfile.firstName,
                    lastName: item.employeeProfile.lastName,
                    fullName: `${item.employeeProfile.firstName} ${item.employeeProfile.lastName}`,
                    about: item.employeeProfile.about,
                    priceCharge: item.employeeProfile.priceCharge,
                    skills: item.employeeProfile.skills,
                    experience: item.employeeProfile.experience,
                    employeeType: item.employeeProfile.employeeType,
                    languages: item.employeeProfile.languages,
                    startTime: item.employeeProfile.startTime,
                    endTime: item.employeeProfile.endTime,
                    days: item.employeeProfile.days,
                    preBooking: item.employeeProfile.preBooking
                }
            };
        });

        const totalPages = Math.ceil(total / limitNum);

        const response = {
            success: true,
            data: formattedData,
            pagination: {
                currentPage: pageNum,
                limit: limitNum,
                totalItems: total,
                totalPages,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1,
                sortBy: sortBy,  // Include sortBy in response
                appliedFilters: {
                    languages: languages ? (Array.isArray(languages) ? languages : languages.split(',')) : undefined,
                    skills: skills ? (Array.isArray(skills) ? skills : skills.split(',')) : undefined,
                    priceRange: minPrice || maxPrice ? {
                        min: minPrice ? parseFloat(minPrice) : undefined,
                        max: maxPrice ? parseFloat(maxPrice) : undefined
                    } : undefined,
                    experience: experience ? (Array.isArray(experience) ? experience.map(exp => parseInt(exp)) : [parseInt(experience)]) : undefined,
                    days: days ? (Array.isArray(days) ? days : days.split(',')) : undefined,
                    preBooking: preBooking !== undefined ? (preBooking === 'true' || preBooking === true) : undefined,
                    search: search || undefined
                }
            }
        };

        if (res.paginated) {
            res.paginated(formattedData, {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages,
                sortBy: sortBy
            });
        } else {
            res.status(200).json(response);
        }

    } catch (error) {
        console.error('Error fetching call astrologers:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid parameters'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error while fetching call astrologers'
        });
    }
});

exports.getSingleCallAstrologerCustomer = asyncHandler(async (req, res) => {
    const { id } = req.query;

    try {
        // First, find the user
        const user = await User.findById(id)
            .select('-__v -resetPasswordToken -resetPasswordExpire -password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user has the correct role
        if (user.role !== 'astrologer') {
            return res.status(400).json({
                success: false,
                message: 'User is not an astrologer'
            });
        }

        // Find the employee profile
        const employee = await mongoose.model('employee').findById(user.profile)
            .select('-__v');

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: 'Employee profile not found'
            });
        }

        // Check if it's a call astrologer
        if (employee.employeeType !== 'call_astrologer') {
            return res.status(400).json({
                success: false,
                message: 'This employee is not a call astrologer'
            });
        }

        // Transform the response
        const responseData = {
            _id: user._id,
            email: user.email,
            mobileNo: user.mobileNo,
            profileImage: user.profileImage,
            type: user.type,
            firstName: employee.firstName,
            lastName: employee.lastName,
            fullName: `${employee.firstName} ${employee.lastName}`,
            about: employee.about,
            priceCharge: employee.priceCharge,
            skills: employee.skills,
            experience: employee.experience,
            languages: employee.languages,
            createdAt: user.createdAt,
        };

        // If you have res.ok() defined
        res.ok(responseData, 'Call astrologer fetched successfully');

        // If res.ok() is not defined, use:
        // return res.status(200).json({
        //     success: true,
        //     message: 'Call astrologer fetched successfully',
        //     data: responseData
        // });

    } catch (error) {
        console.error('Error fetching call astrologer:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid ID format'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Server error while fetching call astrologer'
        });
    }
});

exports.getAllCallsAdminandAstrologer = asyncHandler(async (req, res) => {
    const filter = {};
    if (req.user.role === 'astrologer') {
        filter.astrologerId = req.user._id
    }
    const calls = await CallAstrologer.find(filter);
    res.status(200).json({ success: true, data: calls });
});

exports.getAllCallsHistoryCustomer = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const total = await CallAstrologer.countDocuments({ userId: req.user._id });
    const calls = await CallAstrologer.find({ userId: req.user._id })
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .populate('astrologerId', 'email mobileNo');

    res.paginated(calls, { page, limit, total, totalPages: Math.ceil(total / limit) });
});

exports.getFilters = asyncHandler(async (req, res) => {
    try {
        // Using single aggregation for efficiency
        const [filters] = await Employee.aggregate([
            {
                $match: {
                    employeeType: 'call_astrologer'
                }
            },
            {
                $facet: {
                    experiences: [
                        { $match: { experience: { $ne: null } } },
                        { $group: { _id: '$experience' } },
                        { $sort: { _id: 1 } }
                    ],
                    languages: [
                        { $match: { languages: { $exists: true, $ne: [] } } },
                        { $unwind: '$languages' },
                        { $group: { _id: '$languages' } },
                        { $sort: { _id: 1 } }
                    ],
                    skills: [
                        { $match: { skills: { $exists: true, $ne: [] } } },
                        { $unwind: '$skills' },
                        { $group: { _id: '$skills' } },
                        { $sort: { _id: 1 } }
                    ],
                    priceRange: [
                        { $match: { priceCharge: { $ne: null } } },
                        { $group: { _id: null, min: { $min: '$priceCharge' }, max: { $max: '$priceCharge' } } }
                    ]
                }
            }
        ]);

        // Extract and format the results
        const formattedData = {
            experiences: filters.experiences.map(e => e._id),
            languages: filters.languages.map(l => l._id),
            skills: filters.skills.map(s => s._id),
            priceRange: filters.priceRange[0] || { min: 0, max: 0 }
        };

        // Remove the _id field from priceRange if present
        if (formattedData.priceRange._id !== undefined) {
            delete formattedData.priceRange._id;
        }

        res.status(200).json({
            success: true,
            data: formattedData
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch filter data'
        });
    }
});
