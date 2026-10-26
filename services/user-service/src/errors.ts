export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: object,
  ) {
    super(message);
    this.name = "AppError";
  }
}
