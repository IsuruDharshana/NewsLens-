/**
 * Auth context — manages login state, tokens, and user info.
 * Tokens are stored in AsyncStorage for persistence across app restarts.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

interface User {
  user_id: string;
  email: string;
  name: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'newslens_token';
const REFRESH_KEY = 'newslens_refresh';
const USER_KEY = 'newslens_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
    error: null,
  });

  // Load saved token on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        const userStr = await AsyncStorage.getItem(USER_KEY);
        if (token && userStr) {
          const user = JSON.parse(userStr);
          // Set the token on the API client
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
          setState({ user, token, loading: false, error: null });
        } else {
          setState((s) => ({ ...s, loading: false }));
        }
      } catch {
        setState((s) => ({ ...s, loading: false }));
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data } = await api.post('/api/auth/login', { email, password });
      const user: User = {
        user_id: data.user_id,
        email: data.email,
        name: data.name,
      };
      await AsyncStorage.setItem(TOKEN_KEY, data.access_token);
      await AsyncStorage.setItem(REFRESH_KEY, data.refresh_token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
      setState({ user, token: data.access_token, loading: false, error: null });
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Login failed';
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw new Error(msg);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { data } = await api.post('/api/auth/register', { email, password, name });
      const user: User = {
        user_id: data.user_id,
        email: data.email,
        name: data.name,
      };
      await AsyncStorage.setItem(TOKEN_KEY, data.access_token);
      await AsyncStorage.setItem(REFRESH_KEY, data.refresh_token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      api.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
      setState({ user, token: data.access_token, loading: false, error: null });
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Registration failed';
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw new Error(msg);
    }
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(REFRESH_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    delete api.defaults.headers.common['Authorization'];
    setState({ user: null, token: null, loading: false, error: null });
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
