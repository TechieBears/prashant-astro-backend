class ErrorHander extends Error {
  constructor(message, statusCode = 500, options = {}) {
    super(message);
    this.statusCode = statusCode;
    // optional custom error code string (e.g., 'VALIDATION_ERROR')
    this.code = options.code || undefined;
    // optional array/object with field errors or extra info
    this.errors = options.errors || undefined;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ErrorHander;