// middlewares/errorHandler.js

const corsErrorHandler = (err, req, res, next) => {
  if (err.message && (err.message.includes('CORS') || err.message.includes('Origin'))) {
    console.error('❌ CORS Error:', err.message);
    return res.status(403).json({
      error: 'CORS Error',
      message: 'Unauthorized domain',
      code: 'CORS_BLOCKED'
    });
  }
  next(err);
};

const generalErrorHandler = (err, req, res, next) => {
  console.error('❌ Unhandled error:', err);

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({ message: "Route not found" });
};

module.exports = {
  corsErrorHandler,
  generalErrorHandler,
  notFoundHandler
};