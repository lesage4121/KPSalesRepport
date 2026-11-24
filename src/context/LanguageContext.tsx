/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Languages } from "lucide-react";

export type Language = "fr" | "en";

const STORAGE_KEY = "asky_app_language";

interface LanguageContextType {
  language: Language;
  isEn: boolean;
  locale: "fr-FR" | "en-US";
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  pick: <T>(fr: T, en: T) => T;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function readInitialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "fr") return saved;
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return "fr";
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(readInitialLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "fr" ? "en" : "fr");
  }, [language, setLanguage]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);

  const value = useMemo<LanguageContextType>(
    () => ({
      language,
      isEn: language === "en",
      locale: language === "en" ? "en-US" : "fr-FR",
      setLanguage,
      toggleLanguage,
      pick: <T,>(fr: T, en: T) => (language === "en" ? en : fr),
    }),
    [language, setLanguage, toggleLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}

interface LanguageToggleButtonProps {
  className?: string;
}

export const LanguageToggleButton: React.FC<LanguageToggleButtonProps> = ({
  className = "",
}) => {
  const { language, setLanguage, pick } = useLanguage();

  return (
    <div
      className={`inline-flex items-center gap-1 bg-[#FAF7F2] dark:bg-[#2A180D] border border-[#E6D7C3] dark:border-[#5C351B] rounded-xl p-1 shadow-xs ${className}`}
      role="group"
      aria-label={pick("Changer la langue", "Switch language")}
      title={pick("Basculer Français / Anglais", "Switch French / English")}
    >
      <Languages className="w-3.5 h-3.5 text-[#8C5214] dark:text-[#E89C1D] ml-1.5 mr-0.5 shrink-0" />
      <button
        type="button"
        onClick={() => setLanguage("fr")}
        className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
          language === "fr"
            ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] shadow-xs"
            : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42]"
        }`}
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={`px-2 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
          language === "en"
            ? "bg-[#4C2812] dark:bg-[#E89C1D] text-[#F7BA42] dark:text-[#1F1209] shadow-xs"
            : "text-[#6E472B] dark:text-[#DECAB1] hover:text-[#321B0A] dark:hover:text-[#F7BA42]"
        }`}
      >
        EN
      </button>
    </div>
  );
};
