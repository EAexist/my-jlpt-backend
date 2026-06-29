import { API_ERROR_CODES, ApiError } from './api-constants';

export type { ApiError };

export const API_ERRORS = {
  VALIDATION_FAILED: {
    code: API_ERROR_CODES.VALIDATION_FAILED,
    detail: 'Validation failed',
  },
  UNAUTHORIZED: {
    code: API_ERROR_CODES.UNAUTHORIZED,
    detail: 'Session missing or invalid token signature',
  },
  FORBIDDEN: {
    code: API_ERROR_CODES.FORBIDDEN,
    detail: 'Resource belongs to another user',
  },
  NOT_FOUND: { code: API_ERROR_CODES.NOT_FOUND, detail: 'Resource not found' },
};
