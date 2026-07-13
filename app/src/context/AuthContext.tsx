// context/AuthContext.tsx
// Provides authentication state and actions across the entire app.
// Stores the JWT token and user object in localStorage so the session
// persists across page refreshes.

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { authService } from '../services/api';
import type {
  AuthState,
  LoginCredentials,
  RegisterCredentials,
  User,
} from '../types/index';

// ─────────────────────────────────────────────────────────────
// Context Shape
// ─────────────────────────────────────────────────────────────

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// localStorage keys
const TOKEN_KEY = 'volta_token';
const USER_KEY = 'volta_user';

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true, // true on mount while we check localStorage
  });

  // On mount — rehydrate from localStorage
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const userRaw = localStorage.getItem(USER_KEY);

    if (token && userRaw) {
      try {
        const user: User = JSON.parse(userRaw);
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch {
        // Corrupted localStorage — clear and start fresh
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setState((s) => ({ ...s, isLoading: false }));
      }
    } else {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const response = await authService.login(credentials);

    const { token } = response.data;

    // Fetch the full user profile using the new token
    localStorage.setItem(TOKEN_KEY, token);
    const profileResponse = await authService.getProfile();
    const user = profileResponse.data;

    localStorage.setItem(USER_KEY, JSON.stringify(user));

    setState({
      user,
      token,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const register = useCallback(async (credentials: RegisterCredentials) => {
    // Register then immediately log in
    await authService.register(credentials);
    await login({ email: credentials.email, password: credentials.password });
  }, [login]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const response = await authService.getProfile();
      const user = response.data;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      setState((s) => ({ ...s, user }));
    } catch {
      // Token likely expired — the Axios interceptor handles the redirect
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, logout, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}