// Authentication utilities for JWT storage and API calls

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'mufessir_auth_token';

export interface User {
  id: string;
  email: string;
  name: string;
  dailyQuota: number;
  quotaResetAt: string;
}

export interface AuthResponse {
  token: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

// Token management
export const tokenStorage = {
  get: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  
  set: (token: string): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TOKEN_KEY, token);
  },
  
  remove: (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(TOKEN_KEY);
  }
};

// API utilities
const apiCall = async (endpoint: string, options: RequestInit = {}) => {
  const token = tokenStorage.get();
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
};

// Authentication API calls
export const authApi = {
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response;
  },

  getProfile: async (): Promise<User> => {
    const response = await apiCall('/auth/me');
    return response;
  },

  logout: () => {
    tokenStorage.remove();
  },

  // Password reset helpers
  requestPasswordReset: async (email: string): Promise<{ ok: boolean }> => {
    return apiCall('/auth/password/reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  confirmPasswordReset: async (email: string, code: string, newPassword: string): Promise<{ ok: boolean }> => {
    return apiCall('/auth/password/reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword }),
    });
  },
};

// JWT token verification
export const isTokenValid = (token: string | null): boolean => {
  if (!token) return false;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Date.now() / 1000;
    return payload.exp > now;
  } catch {
    return false;
  }
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  const token = tokenStorage.get();
  return isTokenValid(token);
}; 