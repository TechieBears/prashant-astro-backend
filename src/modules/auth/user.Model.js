const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const validator = require('validator');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, "Email is required"],
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: [false, "Password is required"],
    minlength: [6, "Password must be at least 6 characters"],
    select: false,
  },
  mobileNo: {
    type: String,
    validate: {
      validator: function (v) {
        return !v || validator.isMobilePhone(v);
      },
      message: 'Please provide a valid phone number'
    }
  },
  profileImage: {
    type: String,
    default: "https://cdn-icons-png.flaticon.com/512/149/149071.png"
  },
  fcmToken: {
    type: String,
    default: null
  },
  role: {
    type: String,
    required: true,
    enum: ["admin", "customer", "employee"],
  },
  // Dynamic reference to actual profile (admin, customer, employee)
  profile: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "role",
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  type: {
    type: String,
    enum: ["google", "normal"],
  },
  currentCallSession: {
    astrologerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    callId: { type: mongoose.Schema.Types.ObjectId, ref: 'Call' },
    isActive: Boolean,
    perMinuteRate: Number,
    startedAt: Date,
  }
}, { timestamps: true });

// 🔒 Pre-save hook to hash password
userSchema.pre("save", async function (next) {
  // Skip if password field is not modified
  if (!this.isModified("password")) return next();

  // For Google users, ensure no password is saved
  if (this.type === "google") {
    this.password = undefined;
    return next();
  }

  try {
    // Hash password only for normal users
    const hash = await bcrypt.hash(this.password, 10);
    this.password = hash;
    next();
  } catch (err) {
    next(err);
  }
});

// 🔑 compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false; // no password set
  return bcrypt.compare(candidatePassword, this.password);
};

// 🔑 generate JWT
userSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

userSchema.methods.getResetPasswordToken = function () {
  const resetToken = crypto.randomBytes(20).toString("hex");

  // Hash the token and store in DB
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Set expiry (10 mins)
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  // Return the plain token (to email user)
  return resetToken;
};

module.exports = mongoose.model("User", userSchema);
