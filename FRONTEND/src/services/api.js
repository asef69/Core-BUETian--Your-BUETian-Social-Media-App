import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';


const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});


api.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    } else if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }

    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('🔑 Adding token to request:', config.url);
    } else {
      console.warn('⚠️ No access token found for request:', config.url);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle Network Errors
    if (!error.response) {
      console.error('❌ Network error:', error.message);
      error.displayMessage = 'Network error. Please check your connection and try again.';
      return Promise.reject(error);
    }

    // Handle 401 Unauthorized - Token expired or invalid
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/users/token/refresh/`, {
            refresh: refreshToken,
          });
          const { access } = response.data;
          localStorage.setItem('accessToken', access);
          
          originalRequest.headers.Authorization = `Bearer ${access}`;
          console.log('🔄 Token refreshed successfully');
          return api(originalRequest);
        } catch (err) {
          console.error('🔐 Token refresh failed:', err.message);
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      } else {
        console.warn('⚠️ No refresh token available');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      console.error('🚫 Access forbidden:', error.response.data);
      error.displayMessage = 'You do not have permission to perform this action.';
    }

    // Handle 404 Not Found
    if (error.response?.status === 404) {
      console.error('🔍 Resource not found:', originalRequest.url);
      error.displayMessage = 'The requested resource was not found.';
    }

    // Handle 500 Server Error
    if (error.response?.status >= 500) {
      console.error('⚠️ Server error:', error.response.status, error.response.data);
      error.displayMessage = 'Server error. Please try again later or contact support.';
    }

    // Handle validation errors (400)
    if (error.response?.status === 400) {
      console.warn('⚠️ Validation error:', error.response.data);
      error.displayMessage = error.response.data?.error || error.response.data?.message || 'Invalid request. Please check your input.';
      error.validationErrors = error.response.data?.details || error.response.data?.errors || null;
    }

    // Extract display message from response
    if (!error.displayMessage) {
      error.displayMessage = 
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.response?.data?.detail ||
        'An error occurred. Please try again.';
    }

    console.error('API Error:', {
      status: error.response?.status,
      message: error.displayMessage,
      data: error.response?.data,
    });

    return Promise.reject(error);
  }
);

export default api;
