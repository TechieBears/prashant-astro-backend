const asyncHandler = require('express-async-handler');
const moment = require('moment');
const Errorhander = require('../../utils/errorHandler');
const User = require('../auth/user.Model');
const ServiceOrderItem = require('../serviceOrder/serviceOrderItem.model');
const { default: mongoose } = require('mongoose');


// 🔹 Private helper (not exposed as route)
const fetchMinMaxTime = async (day = null) => {
    const pipeline = [
        {
            $lookup: {
                from: "employees",
                localField: "profile",
                foreignField: "_id",
                as: "employeeData"
            }
        },
        { $unwind: "$employeeData" },
        {
            $match: {
                "employeeData.employeeType": "astrologer",
                ...(day ? { "employeeData.days": day } : {})
            }
        },
        {
            $group: {
                _id: null,
                minStartTime: { $min: "$employeeData.startTime" },
                maxEndTime: { $max: "$employeeData.endTime" }
            }
        },
        { $project: { _id: 0, minStartTime: 1, maxEndTime: 1 } }
    ];

    const result = await User.aggregate(pipeline);
    return result.length ? result[0] : { minStartTime: null, maxEndTime: null };
};

// @desc Check Customer Availability
// @route POST /api/calender/check-availability
// @access Private (Customer Only)
exports.checkAvailability = asyncHandler(async (req, res, next) => {
    try {
        const { date } = req.body;
        const bookingMinutes = Number(req.body?.bookingMinutes);

        if (!date) {
            res.status(400);
            throw new Error("Date is required");
        }

        const employeeAvailability = await User.findById(req.body.astrologer_id).populate('profile');

        const bookingday = moment(date).format('dddd');

        const employeeAvailabilityDay = employeeAvailability.profile.days.find((day) => day === bookingday);

        if (!employeeAvailabilityDay) {
            res.status(404);
            throw new Error("Astrologer is not available on this day");
        }

        if (!employeeAvailability) {
            res.status(404);
            throw new Error("No Astrologer found");
        }

        const intervals = [];
        let timeSlots = [];
        const slotsize = 30;
        const serviceSize = Number(req.body.service_duration);

        let [startHour, startMinute] = employeeAvailability.profile.startTime.split(':').map(Number);
        let [endHour, endMinute] = employeeAvailability.profile.endTime.split(':').map(Number);

        let hour = startHour;
        let minute = startMinute;

        while (hour < endHour || (hour === endHour && minute <= endMinute)) {
            const currentHour = hour;
            const currentMinute = minute;

            let endSlotHour = currentHour;
            let endSlotMinute = currentMinute + slotsize;
            let serviceEndHour = currentHour + Math.floor(serviceSize / 60);
            let serviceEndMinute = (serviceSize % 60) + currentMinute;
            if (serviceEndMinute >= 60) {
                serviceEndHour += 1;
                serviceEndMinute -= 60;
            }
            if (endSlotMinute >= 60) {
                endSlotHour += Math.floor(endSlotMinute / 60);
                endSlotMinute = endSlotMinute % 60;
            }

            // Check if there is enough time left for the next slot
            if ((endHour !== 23 || endMinute !== 59) && (endSlotHour > endHour || (endSlotHour === endHour && endSlotMinute > endMinute))) {
                break;
            }

            const startHourStr = currentHour < 10 ? "0" + currentHour : currentHour;
            const startMinuteStr = currentMinute < 10 ? "0" + currentMinute : currentMinute;
            const endHourStr = endSlotHour < 10 ? "0" + endSlotHour : endSlotHour == 24 ? 23 : endSlotHour;
            const endMinuteStr = endSlotHour == 24 ? 59 : endSlotMinute < 10 ? "0" + endSlotMinute : endSlotMinute;
            const serviceEndHourStr = serviceEndHour < 10 ? "0" + serviceEndHour : serviceEndHour == 24 ? 23 : serviceEndHour;
            const serviceEndMinuteStr = serviceEndHour == 24 ? 59 : serviceEndMinute < 10 ? "0" + serviceEndMinute : serviceEndMinute;


            intervals.push({
                display_time: `${startHourStr}:${startMinuteStr}`,
                display_end_time: `${endHourStr}:${endMinuteStr}`,
                service_end_time: `${serviceEndHourStr}:${serviceEndMinuteStr}`,
                time: `${startHourStr}:${startMinuteStr} - ${serviceEndHourStr}:${serviceEndMinuteStr}`
            });

            hour = endSlotHour;
            minute = endSlotMinute;
            // Stop the loop if the next slot exceeds the endHour and endMinute
            if (!(hour === 23 && endHour === 23 && endMinute === 59) && hour >= endHour && minute >= endMinute) {
                break;
            }
        }

        const bookingData = await ServiceOrderItem.find({
            astrologer: req.body.astrologer_id,
            bookingDate: date,
            $or: [
                { status: "paid" },
                { status: "blocked" },
                { status: "pending" },
            ],
            astrologerStatus: { $in: ["accepted", "pending"] }
        });

        if (bookingData.length > 0) {
            if (req.body.service_type === "offline") {
                res.status(404);
                throw new Error("Astrologer is not available on this day");
            }
        }
        intervals.forEach((interval) => {
            let flag = false;

            const bookedStatus = bookingData.find((booking) => {
                const startTime = moment(booking.startTime, "HH:mm");
                const endTime = moment(booking.endTime, "HH:mm");
                const intervalStart = moment(interval.display_time, "HH:mm");
                const intervalEnd = moment(interval.display_end_time, "HH:mm"); // use display_end_time, not service_end_time

                // overlap condition: (intervalStart < bookingEnd) && (intervalEnd > bookingStart)
                return intervalStart.isBefore(endTime) && intervalEnd.isAfter(startTime);
            });

            if (moment(req.body.date).format("YYYY-MM-DD") == moment().format("YYYY-MM-DD")) {
                if (moment().format("HH:mm") > moment(interval.display_time, "HH:mm").format("HH:mm")) {
                    flag = true;
                }
            }

            timeSlots.push({
                ...interval,
                booked: !!bookedStatus,
                status: bookedStatus ? "unavailable" : "available",
                disabled: flag
            });
        });

        if (bookingMinutes) {
            // Compute is_available based on bookingMinutes and consecutive contiguous availability
            const requiredSlots = Math.ceil(bookingMinutes / slotsize); // e.g., 120/30 = 4
            const toMinutes = (hhmm) => {
                const [hh, mm] = hhmm.split(':').map(Number);
                return hh * 60 + mm;
            };
            const isWindowOk = (startIdx) => {
                const endIdx = startIdx + requiredSlots - 1;
                if (startIdx < 0 || endIdx >= intervals.length) return false;
                for (let k = startIdx; k <= endIdx; k++) {
                    const slot = intervals[k];
                    if (slot.status !== 'available' || slot.booked) return false;
                    if (k > startIdx) {
                        const prev = intervals[k - 1];
                        if (toMinutes(slot.display_time) !== toMinutes(prev.display_end_time)) return false;
                    }
                }
                return true;
            };
            for (let i = 0; i < intervals.length; i++) {
                let ok = false;
                // Try all windows of size requiredSlots that include i: start from i-(requiredSlots-1) to i
                const minStart = i - (requiredSlots - 1);
                for (let start = minStart; start <= i; start++) {
                    if (isWindowOk(start) && start <= i && i <= start + requiredSlots - 1) { ok = true; break; }
                }
                intervals[i].is_available = ok;
            }
        }

        return res.ok({ timeSlots: timeSlots }, "Astrologer found");

    } catch (error) {
        console.debug("🚀 ~ error:", error);
        next(new Errorhander(error.message, 500));
    }
});


// @desc Get All Astrologers Slots
// @route GET /api/calender/get-all
// @access Private (admin only)
exports.superAdminSlots = asyncHandler(async (req, res, next) => {
    try {
        const date = req.query.date;

        // Fetch astrologers
        const astrologers = await User.aggregate([
            {
                $lookup: {
                    from: "employees",
                    localField: "profile",
                    foreignField: "_id",
                    as: "employeeData"
                }
            },
            { $unwind: "$employeeData" },
            { $match: { "employeeData.employeeType": "astrologer" } },
            {
                $project: {
                    user_id: 1,
                    astrologer_id: "$employeeData._id",
                    name: { $concat: ["$employeeData.firstName", " ", "$employeeData.lastName"] },
                    startTime: "$employeeData.startTime",
                    endTime: "$employeeData.endTime",
                    days: "$employeeData.days"
                }
            }
        ]);

        // Fetch bookings
        const bookings = await ServiceOrderItem.aggregate([
            {
                $match: {
                    bookingDate: date,
                    status: { $nin: ["cancelled", "refunded", "released"] },
                    astrologerStatus: { $in: ["accepted", "pending"] }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "customerId",
                    foreignField: "_id",
                    as: "customer"
                }
            },
            { $unwind: "$customer" },
            { $addFields: { customer_id: "$customer.profile" } },
            {
                $lookup: {
                    from: "customers",
                    localField: "customer_id",
                    foreignField: "_id",
                    as: "custData"
                }
            },
            { $unwind: { path: "$custData", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    startTime: 1,
                    endTime: 1,
                    bookingDate: 1,
                    astrologer: 1,
                    astrologerStatus: 1,
                    paymentStatus: 1,
                    status: 1,
                    customer: { $concat: ["$custData.firstName", " ", "$custData.lastName"] },
                    slot_booked: true,
                    blocked: { $eq: ["$status", "blocked"] },
                    rejectReason: 1
                }
            }
        ]);

        // 🔹 Get min/max time from helper
        const { minStartTime, maxEndTime } = await fetchMinMaxTime();

        // Helpers for slot handling
        const toMoment = (hhmm) => moment(hhmm, "HH:mm");
        const addMinutes = (hhmm, mins) =>
            toMoment(hhmm).add(mins, "minutes").format("HH:mm");

        // Block slots outside working hours
        astrologers.forEach((astro) => {
            let dayStart = minStartTime;
            let dayEnd = addMinutes(maxEndTime, -30);

            // Before working hours
            while (toMoment(dayStart).isBefore(toMoment(astro.startTime))) {
                bookings.push({
                    bookingId: "BK_BLOCK",
                    astrologer: astro.astrologer_id,
                    astrologerName: astro.name,
                    startTime: dayStart,
                    blocked: true
                });
                dayStart = addMinutes(dayStart, 30);
            }

            // After working hours
            // Start from maxEndTime - 30 to avoid creating an out-of-range start at maxEndTime
            // Include the first slot at astro.endTime (e.g., 18:00-18:30 should be blocked if outside working hours)
            while (toMoment(dayEnd).isSameOrAfter(toMoment(astro.endTime))) {
                bookings.push({
                    bookingId: "BK_BLOCK",
                    astrologer: astro.astrologer_id,
                    astrologerName: astro.name,
                    startTime: dayEnd,
                    blocked: true
                });
                dayEnd = addMinutes(dayEnd, -30);
            }
        });

        return res.ok({ time: { start: minStartTime, end: maxEndTime }, astrologers, bookings }, "Astrologers found");
    } catch (error) {
        console.debug("🚀 ~ error:", error);
        next(new Errorhander(error.message, 500));
    }
});

// @desc Get min startTime and max endTime across astrologers
// @route GET /api/calender/min-max-time
// @access Private (admin, customer, employee)
exports.getMinMaxTime = asyncHandler(async (req, res, next) => {
    try {
        const { day } = req.query;
        const { minStartTime, maxEndTime } = await fetchMinMaxTime(day);

        return res.ok({ minStartTime, maxEndTime }, "Min/Max time computed successfully");
    } catch (error) {
        console.debug("🚀 ~ error:", error);
        next(new Errorhander(error.message, 500));
    }
});


// @desc Get astrologer slots
// @route GET /api/calender/min-max-time
// @access Private (admin, customer, employee)
exports.astrologerSlots = asyncHandler(async (req, res, next) => {
    try {
        const { day } = req.query;
        const astrologerId = req.query.astrologerId;
        let startDate = req.query.sdate;
        let endDate = req.query.edate;
        if (!startDate || !endDate || startDate === "" || endDate === "" || !astrologerId || astrologerId === "") {
            return res.badRequest({ message: "Start date and end date and astrologer id are required" });
        }
        //Fetch Astrologer
        const astrologer = await User.findById(astrologerId).populate("profile");
        const { minStartTime, maxEndTime } = { minStartTime: astrologer.profile.startTime, maxEndTime: astrologer.profile.endTime };
        if (!astrologer) {
            return res.notFound({ message: "Astrologer not found" });
        }

        // Fetch bookings
        const bookings = await ServiceOrderItem.aggregate([
            {
                $match: {
                    bookingDate: { $gte: startDate, $lte: endDate },
                    astrologer: new mongoose.Types.ObjectId(astrologerId),
                    status: { $nin: ["cancelled", "refunded", "released"] },
                    astrologerStatus: { $in: ["accepted", "pending"] }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "customerId",
                    foreignField: "_id",
                    as: "customer"
                }
            },
            { $unwind: "$customer" },
            { $addFields: { customer_id: "$customer.profile" } },
            {
                $lookup: {
                    from: "customers",
                    localField: "customer_id",
                    foreignField: "_id",
                    as: "custData"
                }
            },
            { $unwind: { path: "$custData", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    startTime: 1,
                    endTime: 1,
                    date: "$bookingDate",
                    astrologer: 1,
                    astrologerStatus: 1,
                    paymentStatus: 1,
                    status: 1,
                    customer: { $concat: ["$custData.firstName", " ", "$custData.lastName"] },
                    slot_booked: true,
                    rejectReason: 1
                }
            }
        ]);

        // Local helpers for time math
        const toMoment = (hhmm) => moment(hhmm, "HH:mm");
        const addMinutes = (hhmm, mins) => toMoment(hhmm).add(mins, "minutes").format("HH:mm");

        let cursor = startDate;
        while (cursor <= endDate) {
            const bookingday = moment(cursor).format('dddd');

            const employeeAvailabilityDay = astrologer.profile.days.find((day) => day === bookingday);
            if (employeeAvailabilityDay) {
                cursor = moment(cursor).add(1, 'days').format('YYYY-MM-DD');
                continue;
            } else {
                let dayStart = astrologer.profile.startTime;
                // Before working hours
                while (toMoment(dayStart).isBefore(toMoment(astrologer.profile.endTime))) {
                    bookings.push({
                        bookingId: "BK_BLOCK",
                        date: cursor,
                        start_time: dayStart,
                        blocked: true,
                    },
                    );
                    dayStart = addMinutes(dayStart, 30);
                }
            }
            cursor = moment(cursor).add(1, 'days').format('YYYY-MM-DD');
        }

        res.ok({ bookings, date: { start: req.query.sdate, end: req.query.edate }, time: { start: minStartTime, end: maxEndTime } });
    } catch (error) {
        console.debug("🚀 ~ error:", error);
        next(new Errorhander(error.message, 500));
    }
});

// @desc Admin block slot
// @route POST /api/calender/admin-block-slots
// @access Private (admin)
exports.AdminblockSlot = asyncHandler(async (req, res, next) => {
    try {
        const { astrologer_id, date, start_time, end_time, snapshot, blocked_by, rejectReason } = req.body;
        const astrologer = await User.findById(astrologer_id);
        if (!astrologer) {
            res.status(404);
            throw new Error("Astrologer not found");
        }
        const booking = await ServiceOrderItem.create({
            astrologer: astrologer_id,
            bookingDate: date,
            startTime: start_time,
            endTime: end_time,
            status: "blocked",
            total: 0,
            snapshot: snapshot,
            service: null,
            customerId: blocked_by,
            rejectReason: rejectReason
        });
        res.ok(booking, "Booking created successfully");
    } catch (error) {
        console.debug("🚀 ~ error:", error);
        next(new Errorhander(error.message, 500));
    }
});