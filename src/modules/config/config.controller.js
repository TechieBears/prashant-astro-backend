const asyncHandler = require('express-async-handler');
const Errorhander = require('../../utils/errorHandler');
const Config = require('./config.model');
const { configDotenv } = require('dotenv');

// @desc Get config by key (public)
// @route GET /api/config/public/get?key=...
// @access Public
exports.getByKeyPublic = asyncHandler(async (req, res, next) => {
  try {
    const { key } = req.query;
    if (!key || key.trim() === '') {
      return res.badRequest({ message: 'key is required' });
    }

    const cfg = await Config.findOne({ key, isActive: true });
    if (!cfg) {
      return res.notFound({ message: 'Config not found' });
    }

    return res.ok({ key: cfg.key, data: cfg.data }, 'Config fetched successfully');
  } catch (error) {
    next(new Errorhander(error.message, 500));
  }
});

// @desc Create or update config by key (admin)
// @route POST /api/config/create-or-update
// @access Private (admin/employee)
exports.upsertAdmin = asyncHandler(async (req, res, next) => {
  try {
    const { key, data, isActive } = req.body;
    if (!key || key.trim() === '') {
      return res.badRequest({ message: 'key is required' });
    }

    const update = {
      key,
      ...(data !== undefined ? { data } : {}),
      ...(typeof isActive === 'boolean' ? { isActive } : {}),
      updatedBy: req.user?._id || req.user?.id || undefined,
    };

    const cfg = await Config.findOneAndUpdate(
      { key },
      {
        $set: update,
        $setOnInsert: {
          createdBy: req.user?._id || req.user?.id || undefined,
        },
      },
      { new: true, upsert: true }
    );

    return res.ok(cfg, 'Config saved');
  } catch (error) {
    next(new Errorhander(error.message, 500));
  }
});


exports.updateKey = asyncHandler(async (req, res, next) => {
  try {
    const { pass } = req.query;
    const key = "homepage_settings"
    if (pass !== 'techiEBears') {
      return res.badRequest({ message: 'Cant update' });
    }
    const cfg = await Config.findOne({ key });
    await Config.findOneAndUpdate({ key }, { $set: { "data.coming_soon": !cfg.data.coming_soon } });
    return res.ok({ message: 'Config updated' });
  } catch (error) {
    next(new Errorhander(error.message, 500));
  }
});