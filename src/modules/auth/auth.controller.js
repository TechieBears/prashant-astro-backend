const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const User = require('./user.Model');
  const UserToken = require('../userToken/userToken.model');
const ErrorHander = require('../../utils/errorHandler');

const sendUser = (user) => ({
  _id: user._id,
  firstName: user.profile.firstName,
  lastName: user.profile.lastName,
  profileImage: user.profileImage,
  mobileNo: user.mobileNo || null,
  email: user.email,
  // here if employeeType is astrologer then role is astrologer else role is employee
  role: user.profile.employeeType === "astrologer" ? "astrologer" : user.role,
  // role: ,
  skills: user.profile.skills,
  languages: user.profile.languages,
  experience: user.profile.experience,
  startTime: user.profile.startTime,
  endTime: user.profile.endTime,
  days: user.profile.days,
  preBooking: user.profile.preBooking,
  gender: user.profile.gender,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  title: user.profile.title,
  referralCode: user.profile.referralCode || null,
});

// @desc    Login
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password, fcmToken } = req.body;

  console.log("FCM TOKEN", fcmToken);

  if (!email || !password) return next(new ErrorHander("Please provide email and password", 400));

  const user = await User.findOne({ email }).select('+password').populate('profile');
  if (!user) return next(new ErrorHander("Invalid email or password", 401));

  const isMatch = await user.comparePassword(password);
  if (!isMatch) return next(new ErrorHander("Invalid email or password", 401));
  
  if (!user.isActive) return next(new ErrorHander("Invalid email or password", 401));

  const token = user.generateAuthToken();

  if (fcmToken) {
    await user.updateOne({ fcmToken });
  }

  // set data in userToken collection
  let userToken = await UserToken.findOne({ userId: user._id });
  if (userToken) {
    userToken.webToken = token;
    userToken.mobileToken = null,
    await userToken.save();
  } else {
    userToken = new UserToken({
      userId: user._id,
      webToken: token,
      mobileToken: null,
    });
    await userToken.save();
  }

  res.cookie("token", token).ok({ token, user: sendUser(user) }, "Logged in successfully");

});

// @desc    Logout (clears cookie and returns success)
// @route   POST /api/auth/logout
// @access  Public (stateless JWT)
exports.logout = asyncHandler(async (req, res) => {
  // set userToken webToken to null
  const userId = req.body.userId;
  await UserToken.findOneAndUpdate({ userId: userId }, { webToken: null });

  const cookieName = process.env.JWT_COOKIE_NAME || 'token';
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  
  res.ok(null, 'Logged out successfully');
});
