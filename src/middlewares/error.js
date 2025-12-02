const ErrorHander = require("../utils/errorHandler");

module.exports = (err, req, res, next) => {
  const env = process.env.NODE_ENV || 'development';

  // Defaults
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal Server Error";

  // Normalize common errors to standardized ErrorHander with friendly messages
  if (err.name === "CastError") {
    const message = `Resource not found. Invalid identifier.`;
    err = new ErrorHander(message, 404, { code: 'INVALID_ID' });
  }

  if (err.name === "ValidationError") {
    const fieldErrors = Object.values(err.errors).map((v) => v.message);
    err = new ErrorHander('Validation failed', 400, { code: 'VALIDATION_ERROR', errors: fieldErrors });
  }

  if (err.status === 404) {
    const message = `Resource not found.`;
    err = new ErrorHander(message, 404, { code: 'NOT_FOUND', errors: { path: err.path } });
  }

  if (err.status === 400) {
    const message = `Bad request.`;
    err = new ErrorHander(message, 400, { code: 'BAD_REQUEST', errors: { path: err.path } });
  }

  // MongoDB connection error
  if (err.name === "MongoNetworkError" || (err.message && err.message.includes("failed to connect"))) {
    const message = `Failed to connect to the database. Please try again later.`;
    err = new ErrorHander(message, 500, { code: 'DB_CONNECTION_ERROR' });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const fields = Object.keys(err.keyValue);
    const message = `${fields.join(', ')} already exists`;
    err = new ErrorHander(message, 400, { code: 'DUPLICATE_KEY', errors: err.keyValue });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    err = new ErrorHander(`Json Web Token is invalid, try again`, 401, { code: 'JWT_INVALID' });
  }
  if (err.name === "TokenExpiredError") {
    err = new ErrorHander(`Token expired, try again`, 401, { code: 'JWT_EXPIRED' });
  }

  const payload = {
    success: false,
    message: err.message,
    code: err.code,
    errors: err.errors,
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  };

  if (env !== 'production') {
    payload.stack = err.stack;
  }

  res.status(err.statusCode).json(payload);
};
