export function notFound(request, response) {
  response.status(404).json({
    success: false,
    message: 'Route not found'
  });
}

export function errorHandler(error, request, response, next) {
  const statusCode = response.statusCode && response.statusCode !== 200 ? response.statusCode : 500;

  console.error({
    message: error.message,
    method: request.method,
    url: request.originalUrl,
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
  });

  response.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Internal server error' : error.message
  });
}
