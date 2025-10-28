const asyncHandler = require('express-async-handler');
const ProductsOrderModel = require('../productOrder/productOrder.model');
const ServiceOrderModel = require('../serviceOrder/serviceOrder.model');
const ServiceItemModel = require('../serviceOrder/serviceOrderItem.model');
const moment = require('moment');
const { default: mongoose } = require('mongoose');

// 🔹 Get dashboard data
exports.getDashboardData = asyncHandler(async (req, res) => {

    const astrologer = req.query.astrologer;
    let filter = {
        status: {
            $nin: ["blocked", "released"]
        }
    }
    if (astrologer && astrologer != '') {
        filter.astrologer = new mongoose.Types.ObjectId(astrologer);
    }
    let productOrders
    let latestOrders
    if (!astrologer || astrologer == '') {
        productOrders = await ProductsOrderModel.aggregate([
            {
                $facet: {
                    latestproducts: [
                        {
                            $sort: { createdAt: -1 }
                        },
                        {
                            $limit: 5
                        },
                        {
                            $lookup: {
                                from: "users",
                                localField: "user",
                                foreignField: "_id",
                                as: "user"
                            }
                        },
                        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: "customers",
                                localField: "user.profile",
                                foreignField: "_id",
                                as: "customer"
                            }
                        },
                        { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
                        {
                            $lookup: {
                                from: "customeraddresses",
                                localField: "address",
                                foreignField: "_id",
                                as: "address"
                            }
                        },
                        { $unwind: { path: "$address", preserveNullAndEmptyArrays: true } },
                        {
                            $project: {
                                customerName: { $concat: ["$customer.firstName", " ", "$customer.lastName"] },
                                customerEmail: "$user.email",
                                customerPhone: "$user.phone",
                                items: "$items",
                                address: "$address",
                                amount: 1,
                                paymentMethod: 1,
                                orderStatus: 1,
                                paymentStatus: 1,
                                createdAt: 1
                            }
                        }
                    ],
                    totalProductsOrders: [
                        {
                            $count: "totalProductsOrders"
                        }
                    ],
                    totalProductsOrdersAmount: [
                        {
                            $group: {
                                _id: null,
                                totalAmount: { $sum: "$totalAmount" }
                            }
                        }
                    ],
                    pendingProductOrders: [
                        {
                            $match: { orderStatus: "PENDING" }
                        },
                        {
                            $count: "pendingProductOrders"
                        }
                    ],
                    pendingProductOrdersAmount: [
                        {
                            $match: { orderStatus: "PENDING" }
                        },
                        {
                            $group: {
                                _id: null,
                                totalAmount: { $sum: "$totalAmount" }
                            }
                        }
                    ],
                    shippedProductsOrders: [
                        {
                            $match: { orderStatus: "SHIPPED" }
                        },
                        {
                            $count: "shippedProductsOrders"
                        }
                    ],
                    shippedProductsOrdersAmount: [
                        {
                            $match: { orderStatus: "SHIPPED" }
                        },
                        {
                            $group: {
                                _id: null,
                                totalAmount: { $sum: "$totalAmount" }
                            }
                        }
                    ],
                    deliveredProductsOrders: [
                        {
                            $match: { orderStatus: "DELIVERED" }
                        },
                        {
                            $count: "deliveredProductsOrders"
                        }
                    ],
                    deliveredProductsOrdersAmount: [
                        {
                            $group: {
                                _id: null,
                                totalAmount: { $sum: "$totalAmount" }
                            }
                        }
                    ]
                }
            }
        ])

        latestOrders = await ServiceOrderModel.aggregate([
            { $sort: { createdAt: -1 } },
            { $limit: 5, },
            {
                $lookup: {
                    from: "serviceorderitems",
                    localField: "services",
                    foreignField: "_id",
                    as: "bookings"
                }
            }
        ])
    }

    const ServiceItems = await ServiceItemModel.aggregate([
        {
            $match: filter
        },
        {
            $facet: {
                // 2️⃣ Today's Bookings (Upcoming first, then recent past)
                todaysBookings: [
                    {
                        $addFields: {
                            bookingDateTime: {
                                $dateFromString: {
                                    dateString: { $concat: ["$bookingDate", "T", "$startTime", ":00+05:30"] } // Convert to IST
                                }
                            }
                        }
                    },
                    {
                        $match: {
                            bookingDateTime: {
                                $gte: moment().startOf('day').toDate(),
                                $lte: moment().endOf('day').toDate()
                            }
                        }
                    },
                    {
                        $addFields: {
                            isUpcoming: {
                                $cond: [{ $gte: ["$bookingDateTime", new Date()] }, 1, 0]
                            },
                            sortTime: {
                                $cond: [
                                    { $gte: ["$bookingDateTime", new Date()] },
                                    "$bookingDateTime",
                                    { $multiply: [-1, { $toLong: "$bookingDateTime" }] }
                                ]
                            },
                            status: {
                                $cond: [{ $gte: ["$bookingDateTime", new Date()] }, "upcoming", "past"]
                            }
                        }
                    },
                    { $sort: { isUpcoming: -1, sortTime: 1 } },
                    { $limit: 5 },
                    {
                        $lookup: {
                            from: "users",
                            localField: "astrologer",
                            foreignField: "_id",
                            as: "user"
                        }
                    },
                    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
                    {
                        $lookup: {
                            from: "employees",
                            localField: "user.profile",
                            foreignField: "_id",
                            as: "astrologerData"
                        }
                    },
                    { $unwind: { path: "$astrologerData", preserveNullAndEmptyArrays: true } },
                    {
                        $lookup: {
                            from: "customeraddresses",
                            localField: "address",
                            foreignField: "_id",
                            as: "address"
                        }
                    },
                    { $unwind: { path: "$address", preserveNullAndEmptyArrays: true } },
                    {
                        $lookup: {
                            from: "services",
                            localField: "service",
                            foreignField: "_id",
                            as: "serviceData"
                        }
                    },
                    { $unwind: { path: "$serviceData", preserveNullAndEmptyArrays: true } },
                    {
                        $project: {
                            orderId: 1,
                            serviceName: 1,
                            bookingDate: 1,
                            startTime: 1,
                            endTime: 1,
                            snapshot: 1,
                            cust: 1,
                            astrologerName: { $concat: ["$astrologerData.firstName", " ", "$astrologerData.lastName"] },
                            astrologerStatus: 1,
                            paymentStatus: 1,
                            status: 1,
                            createdAt: 1
                        }
                    }
                ],

                // 3️⃣ Total Bookings
                totalBookings: [
                    { $count: "totalBookings" }
                ],

                // 4️⃣ Pending Confirmations
                pendingConfirmatch: [
                    { $match: { astrologerStatus: "pending" } },
                    { $count: "pendingConfirmatch" }
                ],

                // 5️⃣ Scheduled Bookings (Today and future)
                scheduledBookings: [
                    { $match: { astrologerStatus: "accepted" } },
                    {
                        $addFields: {
                            bookingDateTime: {
                                $dateFromString: {
                                    dateString: { $concat: ["$bookingDate", "T", "$startTime", ":00+05:30"] }
                                }
                            }
                        }
                    },
                    {
                        $match: {
                            bookingDateTime: { $gte: moment().startOf('day').toDate() }
                        }
                    },
                    { $count: "scheduledBookings" }
                ],

                // 6️⃣ Completed Bookings (Before today)
                completedBookings: [
                    { $match: { astrologerStatus: "accepted" } },
                    {
                        $addFields: {
                            bookingDateTime: {
                                $dateFromString: {
                                    dateString: { $concat: ["$bookingDate", "T", "$startTime", ":00+05:30"] }
                                }
                            }
                        }
                    },
                    {
                        $match: {
                            bookingDateTime: { $lt: moment().startOf('day').toDate() }
                        }
                    },
                    { $count: "completedBookings" }
                ]
            }
        }
    ]);

    res.status(200).json({
        success: true,
        data: {
            latestbookings: latestOrders || [],
            products: productOrders ? productOrders[0]?.latestproducts || [] : [],
            totalProductsOrders: productOrders ? productOrders[0]?.totalProductsOrders[0]?.totalProductsOrders || 0 : 0,
            totalProductsOrdersAmount: productOrders ? productOrders[0]?.totalProductsOrdersAmount[0]?.totalAmount || 0 : 0,
            pendingProductOrders: productOrders ? productOrders[0]?.pendingProductOrders[0]?.pendingProductOrders || 0 : 0,
            pendingProductOrdersAmount: productOrders ? productOrders[0]?.pendingProductOrdersAmount[0]?.totalAmount || 0 : 0,
            shippedProductsOrders: productOrders ? productOrders[0]?.shippedProductsOrders[0]?.shippedProductsOrders || 0 : 0,
            shippedProductsOrdersAmount: productOrders ? productOrders[0]?.shippedProductsOrdersAmount[0]?.totalAmount || 0 : 0,
            deliveredProductsOrders: productOrders ? productOrders[0]?.deliveredProductsOrders[0]?.deliveredProductsOrders || 0 : 0,
            deliveredProductsOrdersAmount: productOrders ? productOrders[0]?.deliveredProductsOrdersAmount[0]?.totalAmount || 0 : 0,
            // latestbookings: ServiceItems[0]?.latestBookings,
            todaysBookings: ServiceItems ? ServiceItems[0]?.todaysBookings || [] : [],
            totalBookings: ServiceItems ? ServiceItems[0]?.totalBookings[0]?.totalBookings || 0 : 0,
            pendingConfirmatch: ServiceItems ? ServiceItems[0]?.pendingConfirmatch[0]?.pendingConfirmatch || 0 : 0,
            scheduledBookings: ServiceItems ? ServiceItems[0]?.scheduledBookings[0]?.scheduledBookings || 0 : 0,
            completedBookings: ServiceItems ? ServiceItems[0]?.completedBookings[0]?.completedBookings || 0 : 0
        }
    });
});