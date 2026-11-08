import type { QrisErrorCode } from './types.js';

/**
 * Error thrown by `parse`, `build` and `toDynamic`.
 * `code` is machine-readable; `message` is human-readable.
 */
export class QrisError extends Error {
  readonly code: QrisErrorCode;

  constructor(code: QrisErrorCode, message: string) {
    super(message);
    this.name = 'QrisError';
    this.code = code;
  }
}
