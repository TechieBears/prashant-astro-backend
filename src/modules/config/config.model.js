const mongoose = require('mongoose');

const configSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, 'Config key is required'],
      trim: true,
      unique: true,
      index: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed, // store arbitrary object
      default: {},
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'admin',
      required: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'admin',
      required: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    id: false,
  }
);

configSchema.index({ key: 1 }, { unique: true });
configSchema.index({ isActive: 1 });

const Config = mongoose.model('Config', configSchema);
module.exports = Config;
