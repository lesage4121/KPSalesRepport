/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Moon, Sun } from "lucide-react";
import { useLanguage } from "./LanguageContext";

export type ThemeMode = "light" | "dark";

const THEME_STORAGE_KEY = "asky_app_theme";

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function applyThemeToDom(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function readInitialTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "light") {
      applyThemeToDom(saved);
      return saved;
    }
  } catch {
    // Ignore storage errors
  }
  applyThemeToDom("light");
  return "light";
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<ThemeMode>(readInitialTheme);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    applyThemeToDom(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}

interface ThemeToggleButtonProps {
  className?: string;
}

export const ThemeToggleButton: React.FC<ThemeToggleButtonProps> = ({
  className = "",
}) => {
  const { isDark, toggleTheme } = useTheme();
  const { pick } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 shadow-xs ${
        isDark
          ? "bg-[#2A180D] border-[#5C351B] text-[#F7BA42] hover:bg-[#3A2112]"
          : "bg-[#FAF7F2] border-[#E6D7C3] text-[#4C2812] hover:bg-[#F3E9D8]"
      } ${className}`}
      aria-label={
        isDark
          ? pick("Passer en thème clair", "Switch to light theme")
          : pick("Passer en thème sombre ASKY", "Switch to ASKY dark theme")
      }
      title={
        isDark
          ? pick("Passer au mode clair", "Switch to light mode")
          : pick("Passer au mode sombre ASKY", "Switch to ASKY dark mode")
      }
    >
      {isDark ? (
        <>
          <Sun className="w-3.5 h-3.5 text-[#F7BA42] shrink-0" />
          <span>{pick("Clair", "Light")}</span>
        </>
      ) : (
        <>
          <Moon className="w-3.5 h-3.5 text-[#8C5214] shrink-0" />
          <span>{pick("Sombre", "Dark")}</span>
        </>
      )}
    </button>
  );
};
