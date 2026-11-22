import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');

export const api = axios.create({ baseURL: API_URL, timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && useAuthStore.getState().token) useAuthStore.getState().logout();
    return Promise.reject(err);
  },
);

/** Pulls a human readable message out of our API error shape. */
export function errorMessage(err, fallback = 'Something went wrong') {
  const e = err?.response?.data?.error;
  if (e?.details && Array.isArray(e.details) && e.details.length) {
    return `${e.message}: ${e.details.map((d) => d.message).slice(0, 3).join(', ')}`;
  }
  if (e?.message) return e.message;
  if (err?.code === 'ECONNABORTED') return 'Server is waking up, please try again in a few seconds';
  if (err?.message === 'Network Error') return 'Cannot reach the server';
  return fallback;
}

export const unwrap = (res) => res.data.data;
