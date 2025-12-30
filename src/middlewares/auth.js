const asyncHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const User = require('../modules/auth/user.Model');
const ErrorHander = require('../utils/errorHandler');

// Protect routes - verify JWT token and attach user to req
const protect = asyncHandler(async (req, res, next) => {
  let token;
  let tokenSource = '';

  // Check Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
    tokenSource = 'header';
  }

  // Check cookies
  const cookieName = process.env.JWT_COOKIE_NAME || 'token';
  if (!token && req.cookies && req.cookies[cookieName]) {
    token = req.cookies[cookieName];
    tokenSource = 'cookie';
  }

  // 🚨 No token
  if (!token) {
    throw new ErrorHander('Please login to access this resource', 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate('profile');

    if (!user) {
      throw new ErrorHander('User account not found, please login again', 401);
    }

    if (!user.isActive) {
      throw new ErrorHander('Your account is disabled, please contact support', 403);
    }

    req.user = user;
    req.tokenSource = tokenSource;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ErrorHander('Token expired, please login again', 401);
    } else if (err.name === 'JsonWebTokenError') {
      throw new ErrorHander('Invalid token, please login again', 401);
    } else {
      throw new ErrorHander('Authentication failed, please login again', 401);
    }
  }
});

// Authorize specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized');
    }

    if (!roles.includes(req.user.role)) {
      res.status(403);
      throw new Error(
        `User role ${req.user.role} is not authorized to access this route`
      );
    }

    next();
  };
};

module.exports = {
  protect,
  authorize,
};