import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
});

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
  err => Promise.reject(err)
);

export default api;
