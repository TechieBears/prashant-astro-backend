const asyncHandler = require('express-async-handler');
const Review = require('./reviews.model');
const { default: mongoose } = require('mongoose');

// @desc Create a review (admin)
// @route POST /api/reviews/create
// @access Private (admin)
exports.createReview = asyncHandler(async (req, res) => {
  const { user_id, service_id, product_id, message, rating, isActive, } = req.body;

  if (!user_id || !message) {
    res.status(400);
    throw new Error('Both user_id and message are required');
  }

  const payload = {
    user_id,
    service_id,
    product_id,
    message,
    rating: rating ?? 5,
    isActive: false
  };

  const created = await Review.create(payload);
  res.created(created, 'Review created successfully');
});

// @desc Get public active reviews
// @route GET /api/reviews/public
// @access Public
exports.getPublicReviews = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;

  const reviews = await Review.find({ isActive: true })
    .sort({ displayOrder: 1, createdAt: -1 })
    .limit(limit)
    .populate({
      path: "user_id",
      select: "email mobileNo profileImage role profile",
      populate: {
        path: "profile", // this will populate the actual 'customer' document
        model: "customer",
        select: "firstName lastName fullName gender title",
      },
    });

  res.ok(reviews, "Reviews fetched successfully");
});

// @desc Get public approved reviews
// @route GET /api/reviews/public/get-all-approved
// @access Public
exports.getAllApprovedPublicReviews = asyncHandler(async (req, res) => {
  const item = await Review.findById({ isActive: true, isApproved: true });
  if (!item) {
    res.status(404);
    throw new Error('Review not found');
  }
  res.ok(item, 'Review fetched successfully');
})

// @desc Get all reviews (admin)
// @route GET /api/reviews/get-all
// @access Private (admin)
exports.getAllReviews = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const query = {};

  if (req.query.isActive !== undefined && req.query.isActive !== '') {
    query.isActive = req.query.isActive === 'true';
  }

  if (req.query.name && req.query.name.trim() !== '') {
    const s = req.query.name.trim();
    query.$or = [
      { "name": { $regex: s, $options: 'i' } },
      { message: { $regex: s, $options: 'i' } },
    ];
  }

  const items = await Review.aggregate([
    { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'customers', localField: 'user.profile', foreignField: '_id', as: 'customer' } },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    { $addFields: { name: { $concat: ['$customer.firstName', ' ', '$customer.lastName'] } } },
    { $match: query },
    { $lookup: { from: 'services', localField: 'service_id', foreignField: '_id', as: 'service' } },
    { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'products', localField: 'product_id', foreignField: '_id', as: 'product' } },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    { $sort: { createdAt: -1 } },
    { $project: { user: { mobileNo: 1, email: 1, profileImage: 1, firstName: '$customer.firstName', lastName: '$customer.lastName' }, service: { name: 1, title: 1 }, product: { name: 1 }, message: 1, rating: 1, isActive: 1, createdAt: 1 } },
    { $skip: skip },
    { $limit: limit }
  ])
  const total = await Review.countDocuments(query);

  res.paginated(items, { page, limit, total, pages: Math.ceil(total / limit) }, 'Reviews fetched successfully');
});

// @desc Get single review (admin)
// @route GET /api/reviews/get-single
// @access Private (admin)
exports.getReviewById = asyncHandler(async (req, res) => {
  const item = await Review.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(req.query.id) } },
    { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'customers', localField: 'user.profile', foreignField: '_id', as: 'customer' } },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'services', localField: 'service_id', foreignField: '_id', as: 'service' } },
    { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'products', localField: 'product_id', foreignField: '_id', as: 'product' } },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    { $sort: { createdAt: -1 } },
    { $project: { user: { mobileNo: 1, email: 1, profileImage: 1, firstName: '$customer.firstName', lastName: '$customer.lastName' }, service: { name: 1, title: 1 }, product: { name: 1 }, message: 1, rating: 1, isActive: 1, createdAt: 1 } },
  ])
  if (!item) {
    res.status(404);
    throw new Error('Review not found');
  }
  res.ok(item);
});

// @desc Update review (admin)
// @route PUT /api/reviews/update
// @access Private (admin)
exports.updateReview = asyncHandler(async (req, res) => {
  const { id } = req.query;
  const update = req.body || {};

  const item = await Review.findById(id);
  if (!item) {
    res.status(404);
    throw new Error('Review not found');
  }

  Object.assign(item, update);
  await item.save();

  res.ok(item, 'Review updated successfully');
});

// @desc Delete review (admin)
// @route DELETE /api/reviews/delete
// @access Private (admin)
exports.deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.query;
  const item = await Review.findById(id);
  if (!item) {
    res.status(404);
    throw new Error('Review not found');
  }
  await item.deleteOne();
  res.ok(null, 'Review deleted');
});

// @desc Toggle active (admin)
// @route PUT /api/reviews/:id/active
// @access Private (admin)
exports.toggleActive = asyncHandler(async (req, res) => {
  const id = req.params.id || req.query.id;
  const item = await Review.findById(id);
  if (!item) {
    res.status(404);
    throw new Error('Review not found');
  }
  if (typeof req.body.isActive === 'boolean') {
    item.isActive = req.body.isActive;
  } else {
    item.isActive = !item.isActive;
  }
  await item.save();
  res.ok(item, 'Review status updated');
});

// @desc Reorder reviews (admin) – bulk set displayOrder
// @route PUT /api/reviews/reorder
// @access Private (admin)
exports.reorderReviews = asyncHandler(async (req, res) => {
  const list = Array.isArray(req.body) ? req.body : req.body.list;
  if (!Array.isArray(list) || list.length === 0) {
    res.status(400);
    throw new Error('Provide an array of { id, displayOrder }');
  }

  const bulk = list.map(({ id, displayOrder }) => ({
    updateOne: {
      filter: { _id: id },
      update: { $set: { displayOrder: Number(displayOrder) || 0 } },
    },
  }));

  const result = await Review.bulkWrite(bulk);
  res.ok(result, 'Reviews reordered');
});

// @desc Approve review (admin)
// @route PUT /api/reviews/:id/approve
// @access Private (admin)
exports.approveReview = asyncHandler(async (req, res) => {
  const id = req.params.id || req.query.id;
  const item = await Review.findById(id);
  if (!item) {
    res.status(404);
    throw new Error('Review not found');
  }

  item.isActive = true;
  item.approved_by = (req.user && (req.user._id || req.user.id)) || item.approved_by;
  item.approved_at = new Date();
  await item.save();

  res.ok(item, 'Review approved');
});

// @desc Disapprove review (admin)
// @route PUT /api/reviews/:id/disapprove
// @access Private (admin)
exports.disapproveReview = asyncHandler(async (req, res) => {
  const id = req.params.id || req.query.id;
  const item = await Review.findById(id);
  if (!item) {
    res.status(404);
    throw new Error('Review not found');
  }

  item.isActive = false;
  item.approved_by = null;
  item.approved_at = null;
  await item.save();

  res.ok(item, 'Review disapproved');
});

// @desc Set approval status (admin) – unified approve/disapprove
// @route PUT /api/reviews/:id/approval
// @access Private (admin)
exports.setApprovalStatus = asyncHandler(async (req, res) => {
  const id = req.params.id || req.query.id;
  const body = req.body || {};

  // Accept multiple keys for convenience
  const approvedValue =
    typeof body.approved === 'boolean' ? body.approved :
      typeof body.isApproved === 'boolean' ? body.isApproved :
        typeof body.isActive === 'boolean' ? body.isActive : undefined;

  if (typeof approvedValue !== 'boolean') {
    res.status(400);
    throw new Error('Provide a boolean "approved" (or "isApproved") in body');
  }

  const item = await Review.findById(id);
  if (!item) {
    res.status(404);
    throw new Error('Review not found');
  }

  if (approvedValue) {
    item.isActive = true;
    item.isApproved = approvedValue;
    // Allow explicit values from body, else fallback to authenticated user and current time
    const bodyApprovedBy = body.approved_by || body.approvedBy;
    const bodyApprovedAt = new Date();
    item.approved_by = bodyApprovedBy || (req.user && (req.user._id || req.user.id)) || item.approved_by;
    item.approved_at = bodyApprovedAt ? new Date(bodyApprovedAt) : new Date();
  } else {
    item.isActive = false;
    item.approved_by = null;
    item.approved_at = null;
  }

  await item.save();
  res.ok(item, approvedValue ? 'Review approved' : 'Review disapproved');
});

exports.getReviewsFilter = asyncHandler(async (req, res) => {
  const query = {};

  if (req.query.product && req.query.product != '') {
    query.product_id = new mongoose.Types.ObjectId(req.query.product);
  }
  if (req.query.service && req.query.service != '') {
    query.service_id = new mongoose.Types.ObjectId(req.query.service);
  }
  if (req.query.user && req.query.user != '') {
    query.user_id = new mongoose.Types.ObjectId(req.query.user);
  }
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const item = await Review.aggregate([
    { $match: query },
    { $lookup: { from: 'users', localField: 'user_id', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'customers', localField: 'user.profile', foreignField: '_id', as: 'customer' } },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'services', localField: 'service_id', foreignField: '_id', as: 'service' } },
    { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
    { $lookup: { from: 'products', localField: 'product_id', foreignField: '_id', as: 'product' } },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
    { $sort: { createdAt: -1 } },
    { $skip: skip },
    { $limit: limit },
    { $project: { user: { mobileNo: 1, email: 1, profileImage: 1, firstName: '$customer.firstName', lastName: '$customer.lastName' }, service: { name: 1, title: 1 }, product: { name: 1 }, message: 1, rating: 1, isActive: 1, createdAt: 1 } },
  ])
  if (!item) {
    res.status(404);
    throw new Error('Review not found');
  }
  res.ok(item);
});

