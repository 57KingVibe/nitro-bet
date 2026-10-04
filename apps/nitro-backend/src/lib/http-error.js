// An error that carries an HTTP status. errorHandler turns it into a JSON response.
export class HttpError extends Error {
  constructor(statusCode, message, code, details) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
