import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('bloodconnect_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('bloodconnect_token');
      const storedUser = localStorage.getItem('bloodconnect_user');

      if (storedToken && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
          // Refresh user data in background
          const response = await authService.getCurrentUser();
          if (response && response.data) {
            setUser(response.data);
            localStorage.setItem('bloodconnect_user', JSON.stringify(response.data));
          }
        } catch (error) {
          console.warn('[AuthContext] Session invalid or expired:', error);
          logout();
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials) => {
    const res = await authService.login(credentials);
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('bloodconnect_token', newToken);
    localStorage.setItem('bloodconnect_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const register = async (userData) => {
    const res = await authService.register(userData);
    const { token: newToken, user: createdUser } = res.data;
    localStorage.setItem('bloodconnect_token', newToken);
    localStorage.setItem('bloodconnect_user', JSON.stringify(createdUser));
    setToken(newToken);
    setUser(createdUser);
    return createdUser;
  };

  const logout = () => {
    localStorage.removeItem('bloodconnect_token');
    localStorage.removeItem('bloodconnect_user');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const response = await authService.getCurrentUser();
      if (response && response.data) {
        setUser(response.data);
        localStorage.setItem('bloodconnect_user', JSON.stringify(response.data));
      }
    } catch (e) {
      console.error('[AuthContext] Failed refreshing user profile:', e);
    }
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    role: user?.role || null,
    loading,
    login,
    register,
    logout,
    refreshUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
