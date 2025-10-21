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
      validator: function(v) {
        return !v || validator.isMobilePhone(v);
      },
      message: 'Please provide a valid phone number'
    }
  },
  profileImage:{
    type: String,
    default: "https://cdn-icons-png.flaticon.com/512/149/149071.png"
  },
  fcmToken:{
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
}, { timestamps: true });

// 🔒 password hashing
userSchema.pre("save", async function(next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// 🔑 compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// 🔑 generate JWT
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

userSchema.methods.getResetPasswordToken = function() {
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
