// context/ThemeContext.tsx
// Provides dark/light theme state across the app. Persists the user's
// choice in localStorage and applies it via a data-theme attribute on
// <html>, which index.css reads to swap CSS variable values.

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { Theme, ThemeContextType } from '../types/index';

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_KEY = 'volta_theme';
const DEFAULT_THEME: Theme = 'light';

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Read saved preference on first render to avoid a flash of the
    // wrong theme before useEffect runs.
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    return saved === 'dark' || saved === 'light' ? saved : DEFAULT_THEME;
  });

  // Apply the theme to <html data-theme="..."> whenever it changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, toggleTheme, isDark: theme === 'dark' }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return context;
}
