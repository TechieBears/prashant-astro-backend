const asyncHandler = require("express-async-handler");
const CallAstrologer = require("./call.model");

exports.createCall = asyncHandler(async (req, res) => {
    const { userId, astrologerId, date, time, duration } = req.body;
    if(!userId || !astrologerId || !date || !time || !duration) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const call = await CallAstrologer.create({ userId, astrologerId, date, time, duration });
    res.created(call, 'Call created successfully');
});

exports.getAllCallsCustomer = asyncHandler(async (req, res) => {
    const {page = 1, limit = 10} = req.body;
    const skip = (page - 1) * limit;
    const total = await CallAstrologer.countDocuments({ userId: req.user._id });
    const calls = await CallAstrologer.find({ userId: req.user._id })
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .populate('astrologerId', 'email mobileNo');

    res.paginated(calls, { page, limit, total, totalPages: Math.ceil(total / limit) });
});

exports.getAllCalls = asyncHandler(async (req, res) => {
    const filter = { };
    if(req.user.role === 'astrologer') {
        filter.astrologerId = req.user._id
    }
    const calls = await CallAstrologer.find(filter);
    res.status(200).json({ success: true, data: calls });
});

