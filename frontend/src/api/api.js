import axios from 'axios';
import { jwtDecode } from 'jwt-decode';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Attach the access token to every request automatically
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('accessToken');
  if (token) {
    try {
      const decoded = jwtDecode(token);
      const now = Math.floor(Date.now() / 1000);

      // Skip attaching expired tokens so the client can refresh or log in again.
      if (decoded?.exp && decoded.exp <= now) {
        sessionStorage.removeItem('accessToken');
        return config;
      }
    } catch {
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      return config;
    }

    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalise error responses so callers always receive a consistent shape
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // The server responded with a non-2xx status
      const { status, data } = error.response;

      // Build a normalised error object that callers can rely on
      const normalised = {
        status,
        message: data?.message || extractErrorMessage(status),
        details: data?.details || [],
      };

      return Promise.reject(normalised);
    }

    if (error.request) {
      // Request was sent but no response received (network/timeout)
      return Promise.reject({
        status: 0,
        message: 'Unable to reach the server. Please check your connection.',
        details: [],
      });
    }

    // Something went wrong while setting up the request
    return Promise.reject({
      status: -1,
      message: error.message || 'An unexpected error occurred.',
      details: [],
    });
  }
);

/**
 * Maps common HTTP status codes to user-friendly messages.
 * @param {number} status
 * @returns {string}
 */
function extractErrorMessage(status) {
  const messages = {
    400: 'Bad request. Please check your input.',
    401: 'You are not authenticated. Please log in.',
    403: 'You do not have permission to perform this action.',
    404: 'The requested resource was not found.',
    409: 'A conflict occurred. The resource may already exist.',
    422: 'Validation failed. Please review the highlighted fields.',
    429: 'Too many requests. Please wait a moment before trying again.',
    500: 'An internal server error occurred. Please try again later.',
    502: 'Server is temporarily unavailable. Please try again later.',
    503: 'Service unavailable. Please try again later.',
  };
  return messages[status] || 'An unexpected error occurred.';
}

export { API_BASE_URL };
export default api;

