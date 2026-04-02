import React, { createContext, useState, useContext, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { authAPI } from '../services/apiService';
import { showToast } from '../utils/toast.jsx';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded.exp * 1000 > Date.now()) {
          setUser({
            id: decoded.user_id,
            email: decoded.email,
          });
        } else {
          logout();
        }
      } catch (error) {
        logout();
      }
    }
    setLoading(false);
  };

  const login = async (email, password) => {
    try {
      const response = await authAPI.login({ email, password });
      console.log('📥 Login response:', response.data);
      
      
      const { tokens, user: userData } = response.data;
      const { access, refresh } = tokens;
      
     
      localStorage.setItem('accessToken', access);
      localStorage.setItem('refreshToken', refresh);
      
      console.log('✅ Tokens saved to localStorage');
      console.log('Access token:', access ? access.substring(0, 20) + '...' : 'UNDEFINED');
      console.log('Refresh token:', refresh ? refresh.substring(0, 20) + '...' : 'UNDEFINED');
      
      
      setUser({
        id: userData.id,
        email: userData.email,
        name: userData.name,
      });
      
      showToast.success('Welcome back!', 'Login successful');
      
     
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed';
      showToast.error('Login failed', message);
      return { success: false, error: message };
    }
  };

  const register = async (data) => {
    try {
      const response = await authAPI.register(data);
      showToast.success('Account created!', 'Please login with your credentials');
      return { success: true, data: response.data };
    } catch (error) {
      const message = error.response?.data?.error || 'Registration failed';
      showToast.error('Registration failed', message);
      return { success: false, error: message };
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    showToast.info('Logged out', 'See you next time!');
  };

  const value = {
    user,
    login,
    register,
    logout,
    loading,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
