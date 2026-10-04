import { env } from '../config/env.js';

export const errorHandler = (err, req, res, next) => {
  if (req.log) {
    req.log.error(err);
  } else {
    console.error(err);
  }

  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    error: err.name || 'InternalServerError',
    message: statusCode === 500 && env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred.' 
      : err.message,
    ...(err.code && statusCode < 500 && { code: err.code }),
    ...(err.details && statusCode < 500 && { details: err.details }),
    ...(err.currentOddsCenti && { currentOddsCenti: err.currentOddsCenti }),
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
