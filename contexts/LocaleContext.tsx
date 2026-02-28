"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Locale, createTranslator, SUPPORTED_LOCALES } from "../lib/i18n/translator";
import { translateDiagnosticMessage } from "../lib/i18n/diagnosticTranslations";
import {
  formatCurrency as formatCurrencyHelper,
  formatDate as formatDateHelper,
  formatNumber as formatNumberHelper,
  formatPercent as formatPercentHelper,
} from "../lib/i18n/translator";

// Storage key for locale persistence
const LOCALE_STORAGE_KEY = "taxwise_locale";

// Context value interface
export interface LocaleContextValue {
  // Locale state
  locale: Locale;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;

  // Translation helpers
  t: (key: string, params?: Record<string, string | number>) => string;

  // Diagnostic translation
  translateDiagnostic: (message: string) => string;

  // Formatting helpers
  formatCurrency: (amount: number, currency?: string) => string;
  formatDate: (
    date: Date | string | number,
    options?: Intl.DateTimeFormatOptions
  ) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatPercent: (value: number, decimals?: number) => string;

  // Supported locales
  supportedLocales: typeof SUPPORTED_LOCALES;
}

// Create context with undefined default
const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

interface LocaleProviderProps {
  children: React.ReactNode;
  defaultLocale?: Locale;
}

export function LocaleProvider({
  children,
  defaultLocale = "en",
}: LocaleProviderProps) {
  // Initialize locale from localStorage or default
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load persisted locale on mount (client-side only)
  useEffect(() => {
    try {
      const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
      if (savedLocale && (savedLocale === "en" || savedLocale === "es")) {
        setLocaleState(savedLocale);
      }
    } catch {
      // localStorage not available (SSR)
    }
    setIsHydrated(true);
  }, []);

  // Persist locale changes
  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    } catch {
      // localStorage not available
    }
  }, []);

  // Toggle between English and Spanish
  const toggleLocale = useCallback(() => {
    setLocale(locale === "en" ? "es" : "en");
  }, [locale, setLocale]);

  // Create translator instance for current locale
  const translator = useMemo(() => createTranslator(locale), [locale]);

  // Translation function
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      return translator(key, params);
    },
    [translator]
  );

  // Diagnostic translation function
  const translateDiagnostic = useCallback(
    (message: string): string => {
      return translateDiagnosticMessage(message, locale);
    },
    [locale]
  );

  // Currency formatting
  const formatCurrencyFn = useCallback(
    (amount: number, currency: string = "USD"): string => {
      return formatCurrencyHelper(amount, locale, currency);
    },
    [locale]
  );

  // Date formatting
  const formatDateFn = useCallback(
    (
      date: Date | string | number,
      options?: Intl.DateTimeFormatOptions
    ): string => {
      return formatDateHelper(date, locale, options);
    },
    [locale]
  );

  // Number formatting
  const formatNumberFn = useCallback(
    (value: number, options?: Intl.NumberFormatOptions): string => {
      return formatNumberHelper(value, locale, options);
    },
    [locale]
  );

  // Percent formatting
  const formatPercentFn = useCallback(
    (value: number, decimals: number = 2): string => {
      return formatPercentHelper(value, locale, decimals);
    },
    [locale]
  );

  const value: LocaleContextValue = {
    locale,
    setLocale,
    toggleLocale,
    t,
    translateDiagnostic,
    formatCurrency: formatCurrencyFn,
    formatDate: formatDateFn,
    formatNumber: formatNumberFn,
    formatPercent: formatPercentFn,
    supportedLocales: SUPPORTED_LOCALES,
  };

  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  );
}

// Hook to use the locale context
export function useLocale() {
  const context = useContext(LocaleContext);
  if (context === undefined) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return context;
}

// Hook to get only the translation function
export function useTranslation() {
  const { t, locale } = useLocale();
  return { t, locale };
}

// Hook to get only formatting functions
export function useFormattedValues() {
  const { formatCurrency, formatDate, formatNumber, formatPercent, locale } =
    useLocale();
  return { formatCurrency, formatDate, formatNumber, formatPercent, locale };
}

export default LocaleContext;
