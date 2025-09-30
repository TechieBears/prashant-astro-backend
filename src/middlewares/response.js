// Standardized success response helpers
module.exports = (req, res, next) => {
  // 200 OK
  res.ok = (data = null, message = 'OK') => {
    return res.status(200).json({ success: true, message, data });
  };

  // 201 Created
  res.created = (data = null, message = 'Created') => {
    return res.status(201).json({ success: true, message, data });
  };

  // 204 No Content
  res.noContent = () => {
    return res.status(204).send();
  };

  // 200 with pagination block
  res.paginated = (items = [], pagination = {}, message = 'OK') => {
    return res.status(200).json({ success: true, message, data: items, pagination });
  };

  // Generic sender with arbitrary status
  res.sendSuccess = (status = 200, data = null, message = 'OK', extra = {}) => {
    return res.status(status).json({ success: true, message, data, ...extra });
  };

  // 400 Bad Request
  res.badRequest = (payload = { message: 'Bad Request' }) => {
    return res.status(400).json({ success: false, ...payload });
  };

  // 404 Not Found
  res.notFound = (payload = { message: 'Not Found' }) => {
    return res.status(404).json({ success: false, ...payload });
  };

  next();
};
