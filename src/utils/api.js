import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
});

export const getApiErrorMessage = (err, fallback = 'Request failed') => {
  const message =
    err?.response?.data?.detail ||
    err?.response?.data?.hint ||
    err?.response?.data?.error ||
    err?.message ||
    fallback;

  if (typeof message === 'string') {
    const lower = message.toLowerCase();
    if (lower.includes('key.usages') || lower.includes('usages does not permit')) {
      return 'Encryption key setup failed in the browser. Refresh the page and try again.';
    }
  }

  return message;
};

// Attach JWT + guest token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('nf_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  const guestToken = localStorage.getItem('nf_guest');
  if (guestToken) config.headers['x-guest-token'] = guestToken;
  return config;
});

// Handle guest token from response headers
api.interceptors.response.use(
  res => {
    const newToken = res.headers['x-guest-token'];
    if (newToken) localStorage.setItem('nf_guest', newToken);
    return res;
  },
  err => {
    if (!err.response && err.code === 'ECONNABORTED') {
      err.message = 'Request timed out. Please try again.';
    }
    return Promise.reject(err);
  }
);

export default api;
