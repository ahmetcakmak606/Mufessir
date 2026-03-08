'use client';

import React, { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User, authApi, tokenStorage, isAuthenticated } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogleIdToken: (idToken: string) => Promise<void>;
  loginWithAppleIdToken: (idToken: string, name?: string | null) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PROFILE_QUERY_KEY = ['auth', 'me'] as const;

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
  const queryClient = useQueryClient();
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    setBootstrapped(true);
  }, []);

  const profileQuery = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: authApi.getProfile,
    enabled: bootstrapped && isAuthenticated(),
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!profileQuery.error) return;
    tokenStorage.remove();
    queryClient.setQueryData(PROFILE_QUERY_KEY, null);
  }, [profileQuery.error, queryClient]);

  const refetchProfile = async () => {
    await queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
    await profileQuery.refetch();
  };

  const login = async (email: string, password: string) => {
    const { token } = await authApi.login({ email, password });
    tokenStorage.set(token);
    await refetchProfile();
  };

  const loginWithGoogleIdToken = async (idToken: string) => {
    const { token } = await authApi.googleSso({ idToken });
    tokenStorage.set(token);
    await refetchProfile();
  };

  const loginWithAppleIdToken = async (idToken: string, name?: string | null) => {
    const { token } = await authApi.appleSso({ idToken, name: name ?? undefined });
    tokenStorage.set(token);
    await refetchProfile();
  };

  const register = async (email: string, password: string, name?: string) => {
    const { token } = await authApi.register({ email, password, name });
    tokenStorage.set(token);
    await refetchProfile();
  };

  const logout = () => {
    authApi.logout();
    queryClient.setQueryData(PROFILE_QUERY_KEY, null);
    queryClient.removeQueries({ queryKey: PROFILE_QUERY_KEY });
  };

  const refreshUser = async () => {
    await refetchProfile();
  };

  const hasToken = bootstrapped && isAuthenticated();
  const loading = !bootstrapped || (hasToken && profileQuery.isLoading);
  const user = (profileQuery.data as User | null | undefined) ?? null;

  const value = {
    user,
    loading,
    login,
    loginWithGoogleIdToken,
    loginWithAppleIdToken,
    register,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
