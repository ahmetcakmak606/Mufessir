'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, authApi, tokenStorage, isAuthenticated } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      if (isAuthenticated()) {
        const userData = await authApi.getProfile();
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to fetch user:', error);
      // If token is invalid, remove it
      tokenStorage.remove();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const { token } = await authApi.login({ email, password });
      tokenStorage.set(token);
      await fetchUser();
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (email: string, password: string, name?: string) => {
    try {
      const { token } = await authApi.register({ email, password, name });
      tokenStorage.set(token);
      await fetchUser();
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const logout = () => {
    authApi.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}; 