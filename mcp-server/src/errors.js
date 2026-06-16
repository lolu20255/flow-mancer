// Lightweight typed error so tool handlers can distinguish caller mistakes
// (bad args, permissions) from unexpected failures.
export class ApiError extends Error {
  constructor(message, code = 'invalid_argument') {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}
