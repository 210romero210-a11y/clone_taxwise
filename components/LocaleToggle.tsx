"use client";

import React from "react";
import { useLocale } from "../contexts/LocaleContext";
import { Locale } from "../lib/i18n/translator";
import clsx from "clsx";

interface LocaleToggleProps {
  className?: string;
  variant?: "dropdown" | "tabs" | "buttons" | "icon";
  showLabels?: boolean;
  size?: "sm" | "md" | "lg";
}

export function LocaleToggle({
  className,
  variant = "dropdown",
  showLabels = true,
  size = "md",
}: LocaleToggleProps) {
  const { locale, setLocale, supportedLocales, t } = useLocale();

  const locales: { value: Locale; label: string; flag: string }[] = [
    { value: "en", label: supportedLocales.en, flag: "🇺🇸" },
    { value: "es", label: supportedLocales.es, flag: "🇪🇸" },
  ];

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-2",
    lg: "text-base px-4 py-2",
  };

  const iconSizeClasses = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
  };

  // Dropdown variant
  if (variant === "dropdown") {
    return (
      <div className={clsx("relative inline-block", className)}>
        <label className="sr-only">{t("locale.selectLanguage")}</label>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className={clsx(
            "appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8",
            "text-sm font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500",
            "cursor-pointer hover:bg-gray-50"
          )}
          aria-label={t("locale.currentLanguage")}
        >
          {locales.map((l) => (
            <option key={l.value} value={l.value}>
              {l.flag} {l.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
          <svg
            className="h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </div>
    );
  }

  // Tab variant
  if (variant === "tabs") {
    return (
      <div className={clsx("flex rounded-lg bg-gray-100 p-1", className)}>
        {locales.map((l) => (
          <button
            key={l.value}
            onClick={() => setLocale(l.value)}
            className={clsx(
              "flex items-center gap-2 rounded-md font-medium transition-all",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              sizeClasses[size],
              locale === l.value
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            )}
            aria-pressed={locale === l.value}
          >
            <span className={iconSizeClasses[size]}>{l.flag}</span>
            {showLabels && <span>{l.label}</span>}
          </button>
        ))}
      </div>
    );
  }

  // Button variant
  if (variant === "buttons") {
    return (
      <div className={clsx("flex gap-2", className)}>
        {locales.map((l) => (
          <button
            key={l.value}
            onClick={() => setLocale(l.value)}
            className={clsx(
              "flex items-center gap-2 rounded-lg border font-medium transition-all",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              sizeClasses[size],
              locale === l.value
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            )}
            aria-pressed={locale === l.value}
          >
            <span className={iconSizeClasses[size]}>{l.flag}</span>
            {showLabels && <span>{l.label}</span>}
          </button>
        ))}
      </div>
    );
  }

  // Icon-only variant (default)
  return (
    <div className={clsx("flex gap-1", className)}>
      {locales.map((l) => (
        <button
          key={l.value}
          onClick={() => setLocale(l.value)}
          className={clsx(
            "flex items-center justify-center rounded-lg border font-medium transition-all",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
            locale === l.value
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-white hover:bg-gray-50",
            size === "sm" && "h-8 w-8",
            size === "md" && "h-10 w-10",
            size === "lg" && "h-12 w-12"
          )}
          aria-pressed={locale === l.value}
          title={`${l.label} (${l.value.toUpperCase()})`}
        >
          <span className={iconSizeClasses[size]}>{l.flag}</span>
        </button>
      ))}
    </div>
  );
}

// Language indicator component - minimal display of current language
export function LanguageIndicator({ className }: { className?: string }) {
  const { locale, supportedLocales } = useLocale();

  const flags: Record<Locale, string> = {
    en: "🇺🇸",
    es: "🇪🇸",
  };

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700",
        className
      )}
      title={supportedLocales[locale]}
    >
      <span>{flags[locale]}</span>
      <span className="uppercase">{locale}</span>
    </span>
  );
}

export default LocaleToggle;
