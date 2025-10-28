const asyncHandler = require('express-async-handler');
const ProductsOrderModel = require('../productOrder/productOrder.model');
const ServiceOrderModel = require('../serviceOrder/serviceOrder.model');
const ServiceItemModel = require('../serviceOrder/serviceOrderItem.model');
const moment = require('moment');

// 🔹 Get dashboard data
exports.getDashboardData = asyncHandler(async (req, res) => {
    const productOrders = await ProductsOrderModel.aggregate([
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
                    { $unwind: "$user" },
                    {
                        $lookup: {
                            from: "customers",
                            localField: "user.profile",
                            foreignField: "_id",
                            as: "customer"
                        }
                    },
                    { $unwind: "$customer" },
                    {
                        $lookup: {
                            from: "customeraddresses",
                            localField: "address",
                            foreignField: "_id",
                            as: "address"
                        }
                    },
                    { $unwind: "$address" },
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
                ]
            }
        }
    ])
    const ServiceItems = await ServiceItemModel.aggregate([
        {
            $facet: {
                // 1️⃣ Latest Bookings
                latestBookings: [
                    { $sort: { createdAt: -1 } },
                    { $limit: 5 }
                ],

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
                    { $limit: 5 }
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
            products: productOrders[0]?.latestproducts,
            totalProductsOrders: productOrders[0]?.totalProductsOrders || 0,
            totalProductsOrdersAmount: productOrders[0]?.totalProductsOrdersAmount || 0,
            pendingProductOrders: productOrders[0]?.pendingProductOrders || 0,
            pendingProductOrdersAmount: productOrders[0]?.pendingProductOrdersAmount || 0,
            shippedProductsOrders: productOrders[0]?.shippedProductsOrders || 0,
            shippedProductsOrdersAmount: productOrders[0]?.shippedProductsOrdersAmount || 0,
            deliveredProductsOrders: productOrders[0]?.deliveredProductsOrders || 0,
            deliveredProductsOrdersAmount: productOrders[0]?.deliveredProductsOrdersAmount || 0,
            latestbookings: ServiceItems[0]?.latestBookings,
            todaysBookings: ServiceItems[0]?.todaysBookings,
            totalBookings: ServiceItems[0]?.totalBookings[0]?.totalBookings,
            pendingConfirmatch: ServiceItems[0]?.pendingConfirmatch[0]?.pendingConfirmatch,
            scheduledBookings: ServiceItems[0]?.scheduledBookings[0]?.scheduledBookings,
            completedBookings: ServiceItems[0]?.completedBookings[0]?.completedBookings
        }
    });
});