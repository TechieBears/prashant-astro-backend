const asyncHandler = require('express-async-handler');
const ErrorHander = require('../../utils/errorHandler');
const Banner = require('./banner.model');
const { 
  uploadImageToCloudinary, 
  deleteImageFromCloudinary, 
  updateImageInCloudinary,
  getThumbnailUrl 
} = require('../../services/cloudinary.service');

// @desc    Create a new banner
// @route   POST /api/banners
// @access  Private/Admin
exports.createBanner = asyncHandler(async (req, res) => {
    const { 
        title, 
        description, 
        type, 
        position, 
        startDate, 
        endDate, 
        button,
        image
    } = req.body;

    // Parse button if it's string
    let parsedButton = [];
    if (button) {
        try {
            parsedButton = typeof button === "string" ? JSON.parse(button) : button;
        } catch (err) {
            return res.status(400).json({ message: "Invalid button format" });
        }
    }

    // Check if banner already exists with same title
    const existing = await Banner.findOne({ title: new RegExp(`^${title}$`, 'i') });
    if (existing) {
        throw new ErrorHander(`Banner with title '${title}' already exists`, 400);
    }

    // Create banner
    const banner = await Banner.create({
        title,
        description,
        image: image || null,
        type,
        button: parsedButton,
        position: position || 0,
        startDate,
        endDate,
        createdBy: req.user._id
    });

    res.created(banner, 'Banner created successfully');
});

// @desc    Get all active banners
// @route   GET /api/banners/active
// @access  Public
exports.getActiveBanners = asyncHandler(async (req, res) => {
    const { type } = req.query;
    if(!type) return res.status(400).json({ message: "Type query parameter is required" });
    const banners = await Banner.find({ 
        type: type, 
        isActive: true, 
        isDeleted: false 
    }).select("-__v");
    res.ok(banners);
});

// @desc    Get all banners
// @route   GET /api/banners
// @access  Private/Admin
exports.getAllBanners = asyncHandler(async (req, res) => { 
    const { page = 1, limit = 10 } = req.query;

    const filters = { isDeleted: false };
    if (req.query.name) filters.title = { $regex: req.query.name, $options: 'i' };

    const banners = await Banner.find({ isDeleted: false }).skip((page - 1) * limit).limit(limit).select("-__v").sort({ position: 1, createdAt: -1 });
    const total = await Banner.countDocuments({ isDeleted: false });

    res.paginated(banners, {page, limit, total, totalPages: Math.ceil(total / limit)}, "Banners fetched successfully");
});

// @desc    Get a single banner
// @route   GET /api/banners/:id
// @access  Public
exports.getBanner = asyncHandler(async (req, res, next) => {
    if(!req.query.id) return next(new ErrorHander("Please provide banner id", 400));
    const banner = await Banner.findOne({ _id: req.query.id, isDeleted: false }).select("-__v");
    if (!banner) throw new ErrorHander("Banner not found", 404);
    res.ok(banner);
});

// @desc    Update a banner
// @route   PUT /api/banners/:id
// @access  Private/Admin
exports.updateBanner = asyncHandler(async (req, res, next) => {
    if(!req.query.id) return next(new ErrorHander("Please provide banner id", 400));
    const banner = await Banner.findById(req.query.id);
    if (!banner || banner.isDeleted) {
        throw new ErrorHander('Banner not found', 404);
    }

    const { title, description, image, type, position, startDate, endDate, isActive, button } = req.body;

    if (title) banner.title = title;
    if (description) banner.description = description;
    if (image) banner.image = image;
    if (type) banner.type = type;
    if (position !== undefined) banner.position = position;
    if (startDate) banner.startDate = startDate;
    if (endDate) banner.endDate = endDate;
    if (isActive !== undefined) banner.isActive = isActive;
    if (button) banner.button = button;

    // Track updater
    banner.updatedBy = req.user._id;
    await banner.save();
    res.ok(banner, 'Banner updated successfully');
});

// @desc    Update isActive status of a banner
// @route   PUT /api/banners/:id/status
// @access  Private/Admin
exports.updateStatusBanner = asyncHandler(async (req, res, next) => {
    if(!req.query.id) return next(new ErrorHander("Please provide banner id", 400));
    const banner = await Banner.findById(req.query.id);
    if (!banner) {
        throw new ErrorHander('Banner not found', 404);
    }
    banner.isActive = banner.isActive === true ? false : true;
    await banner.save();
    res.ok(banner, 'Banner status updated successfully');
});

// @desc    Delete a banner (soft delete)
// @route   DELETE /api/banners/:id
// @access  Private/Admin
exports.deleteBanner = asyncHandler(async (req, res, next) => {
    if(!req.query.id) return next(new ErrorHander("Please provide banner id", 400)); 
    const banner = await Banner.findById(req.query.id);
    if (!banner || banner.isDeleted) {
        throw new ErrorHander('Banner not found', 404);
    }
    banner.isDeleted = true;
    banner.updatedBy = req.user._id;
    await banner.save();

    if (banner.image?.imageId) {
        await deleteImageFromCloudinary(banner.image.imageId);
    }
    res.ok(null, 'Banner deleted successfully');
});