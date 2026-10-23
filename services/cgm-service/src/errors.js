class AppError extends Error {
  /**
   * @param {string} message
   * @param {string} code
   * @param {object} [details]
   */
  constructor(message, code, details) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

module.exports = { AppError };
