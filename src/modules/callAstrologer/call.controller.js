const asyncHandler = require("express-async-handler");
const CallAstrologer = require("./call.model");
const User = require("../auth/user.Model");

exports.createCall = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { callAstrologerId, date, time, duration } = req.body;
    if(!userId || !callAstrologerId || !date || !time || !duration) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const call = await CallAstrologer.create({ userId, astrologerId: callAstrologerId, date, time, duration });
    res.created(call, 'Call created successfully');
});

// exports.getAllCallAstrologersCustomer = asyncHandler(async (req, res) => {
//     const { page = 1, limit = 10 } = req.query;
//     const skip = (page - 1) * limit;

//     // Count total call astrologers
//     const total = await Users.countDocuments({
//         role: "employee",
//         profile: { $exists: true }
//     });

//     // Fetch employees --> populate employee profile
//     const calls = await Users.find({
//         role: "employee",
//         profile: { $exists: true }
//     })
//     .skip(skip)
//     .limit(Number(limit))
//     .sort({ createdAt: -1 })
//     .populate({
//         path: "profile",
//         match: { employeeType: "call_astrologer" },
//         select: "firstName lastName about priceCharge skills experience employeeType"
//     })
//     .select("email mobileNo profileImage");

//     // Filter out users whose populated profile didn't match employeeType
//     const filteredCalls = calls.filter(item => item.profile !== null);

//     return res.paginated(filteredCalls, {
//         page: Number(page),
//         limit: Number(limit),
//         total,
//         totalPages: Math.ceil(total / limit)
//     });
// });

exports.getAllCallAstrologersCustomer = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    
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
        // Pipeline for data retrieval
        const dataPipeline = [
            // Match users with employee role
            {
                $match: {
                    role: "astrologer",
                    isActive: true,
                    isDeleted: { $ne: true },
                    profile: { $exists: true, $ne: null }
                }
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
            // Filter only call_astrologer type
            {
                $match: {
                    "employeeProfile.employeeType": "call_astrologer"
                }
            },
            // Sort by creation date (newest first)
            {
                $sort: { createdAt: -1 }
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
        
        // Pipeline for counting total call_astrologers
        const countPipeline = [
            {
                $match: {
                    role: "employee",
                    isActive: true,
                    isDeleted: { $ne: true },
                    profile: { $exists: true, $ne: null }
                }
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
                $match: {
                    "employeeProfile.employeeType": "call_astrologer"
                }
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
                hasPrevPage: pageNum > 1
            }
        };
        
        if (res.paginated) {
            res.paginated(formattedData, {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages
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

exports.getAllCallsAdminandAstrologer = asyncHandler(async (req, res) => {
    const filter = { };
    if(req.user.role === 'astrologer') {
        filter.astrologerId = req.user._id
    }
    const calls = await CallAstrologer.find(filter);
    res.status(200).json({ success: true, data: calls });
});

exports.getAllCallsHistoryCustomer = asyncHandler(async (req, res) => {
    const {page = 1, limit = 10} = req.query;
    const skip = (page - 1) * limit;
    const total = await CallAstrologer.countDocuments({ userId: req.user._id });
    const calls = await CallAstrologer.find({ userId: req.user._id })
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .populate('astrologerId', 'email mobileNo');

    res.paginated(calls, { page, limit, total, totalPages: Math.ceil(total / limit) }); 
});

