 const asyncHandler = require('express-async-handler');
const Feedback = require('./feedback.model');
const sendEmail = require('../../services/email.service');

// @desc Create a feedback/contact message (public)
// @route POST /api/feedback/create
// @access Public
exports.createFeedback = asyncHandler(async (req, res) => {
  const { fullName, mobileNumber, email, subject, message, source } = req.body;

  if (!fullName || !mobileNumber || !email || !subject || !message) {
    res.status(400);
    throw new Error('All required fields must be provided');
  }

  const payload = {
    fullName,
    mobileNumber,
    email,
    subject,
    message,
    source: source || 'website',
  };

  const created = await Feedback.create(payload);

  res.created(created, 'Message submitted successfully');
});

// @desc Get all feedbacks (admin)
// @route GET /api/feedback/get-all
// @access Private (admin only)
exports.getAllFeedbacks = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const query = {};

  // filter by read status
  if (req.query.isRead !== undefined && req.query.isRead !== '') {
    query.isRead = req.query.isRead === 'true';
  }

  // date range
  if (req.query.startDate || req.query.endDate) {
    query.createdAt = {};
    if (req.query.startDate) query.createdAt.$gte = new Date(req.query.startDate);
    if (req.query.endDate) query.createdAt.$lte = new Date(req.query.endDate);
  }

  // search
  if (req.query.search && req.query.search.trim() !== '') {
    const s = req.query.search.trim();
    query.$or = [
      { fullName: { $regex: s, $options: 'i' } },
      { email: { $regex: s, $options: 'i' } },
      { subject: { $regex: s, $options: 'i' } },
    ];
  }

  const items = await Feedback.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Feedback.countDocuments(query);

  res.paginated(items, { page, limit, total, pages: Math.ceil(total / limit) }, 'Feedback fetched successfully');
});

// @desc Get single feedback (admin)
// @route GET /api/feedback/get-single
// @access Private (admin only)
exports.getFeedbackById = asyncHandler(async (req, res) => {
  const item = await Feedback.findById(req.query.id);
  if (!item) {
    res.status(404);
    throw new Error('Feedback not found');
  }
  res.ok(item);
});

// @desc Mark as read/unread (admin)
// @route PUT /api/feedback/:id/read
// @access Private (admin only)
exports.toggleRead = asyncHandler(async (req, res) => {
  const item = await Feedback.findById(req.query.id || req.params.id);
  if (!item) {
    res.status(404);
    throw new Error('Feedback not found');
  }
  if (typeof req.body.isRead === 'boolean') {
    item.isRead = req.body.isRead;
  } else {
    item.isRead = !item.isRead;
  }
  await item.save();
  res.ok(item, 'Feedback status updated');
});

// @desc Delete feedback (admin)
// @route DELETE /api/feedback/delete
// @access Private (admin only)
exports.deleteFeedback = asyncHandler(async (req, res) => {
  const item = await Feedback.findById(req.query.id);
  if (!item) {
    res.status(404);
    throw new Error('Feedback not found');
  }
  await item.deleteOne();
  res.ok(null, 'Feedback deleted');
});

// @desc Respond to a feedback via email (admin)
// @route POST /api/feedback/respond
// @access Private (admin only)
exports.respondToFeedback = asyncHandler(async (req, res) => {
  const { id, subject, message, signature, greeting } = req.body;

  if (!id) {
    res.status(400);
    throw new Error('Feedback id (id) is required');
  }
  if (!subject || !message) {
    res.status(400);
    throw new Error('Both subject and message are required');
  }

  const fb = await Feedback.findById(id);
  if (!fb) {
    res.status(404);
    throw new Error('Feedback not found');
  }

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; line-height:1.6">
      <p>${greeting || 'Hello'}${fb.fullName ? ` ${fb.fullName}` : ''},</p>
      <p>${String(message).replace(/\n/g, '<br/>')}</p>
      <p>${signature || 'Regards,<br/>SoulPlan Team'}</p>
      <hr/>
      <p style="color:#888;font-size:12px">In response to your message: <em>${fb.subject}</em></p>
    </div>
  `;

  await sendEmail({ email: fb.email, subject, message: html });

  // Optionally mark as read after responding
  if (!fb.isRead) {
    fb.isRead = true;
    await fb.save();
  }

  res.ok(null, 'Response sent successfully');
});
