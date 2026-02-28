"use client";

import React from "react";
import { useUIMode, UIMode } from "../contexts/UIModeContext";
import { useLocale } from "../contexts/LocaleContext";
import { Locale } from "../lib/i18n/translator";
import clsx from "clsx";

interface UIModeToggleProps {
  className?: string;
  variant?: "tabs" | "buttons" | "icon";
  showLabels?: boolean;
  showLocaleToggle?: boolean;
}

export function UIModeToggle({ 
  className, 
  variant = "tabs",
  showLabels = true,
  showLocaleToggle = true 
}: UIModeToggleProps) {
  const { mode, setMode } = useUIMode();
  const { locale, setLocale, supportedLocales, t } = useLocale();

  const modes: { value: UIMode; label: string; icon: string }[] = [
    { value: "interview", label: t("ui.interview"), icon: "📝" },
    { value: "form", label: t("ui.form"), icon: "📋" },
  ];

  const locales: { value: Locale; label: string; flag: string }[] = [
    { value: "en", label: supportedLocales.en, flag: "🇺🇸" },
    { value: "es", label: supportedLocales.es, flag: "🇪🇸" },
  ];

  // Tab variant (default)
  if (variant === "tabs") {
    return (
      <div className={clsx("flex items-center gap-4", className)}>
        {/* UI Mode Toggle */}
        <div className="flex rounded-lg bg-gray-100 p-1">
          {modes.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={clsx(
                "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                mode === m.value
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              )}
              aria-pressed={mode === m.value}
            >
              <span className="text-base">{m.icon}</span>
              {showLabels && <span>{m.label}</span>}
            </button>
          ))}
        </div>

        {/* Locale Toggle */}
        {showLocaleToggle && (
          <div className="flex rounded-lg bg-gray-100 p-1">
            {locales.map((l) => (
              <button
                key={l.value}
                onClick={() => setLocale(l.value)}
                className={clsx(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all",
                  "focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
                  locale === l.value
                    ? "bg-white text-green-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                )}
                aria-pressed={locale === l.value}
                title={l.label}
              >
                <span className="text-base">{l.flag}</span>
                {showLabels && <span className="uppercase text-xs">{l.value}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Button variant
  if (variant === "buttons") {
    return (
      <div className={clsx("flex items-center gap-4", className)}>
        <div className="flex gap-2">
          {modes.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={clsx(
                "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                mode === m.value
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              )}
              aria-pressed={mode === m.value}
            >
              <span className="text-base">{m.icon}</span>
              {showLabels && <span>{m.label}</span>}
            </button>
          ))}
        </div>

        {showLocaleToggle && (
          <div className="flex gap-2">
            {locales.map((l) => (
              <button
                key={l.value}
                onClick={() => setLocale(l.value)}
                className={clsx(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all",
                  "focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
                  locale === l.value
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                )}
                aria-pressed={locale === l.value}
                title={l.label}
              >
                <span className="text-base">{l.flag}</span>
                {showLabels && <span className="uppercase text-xs">{l.value}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Icon-only variant
  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <div className="flex gap-1">
        {modes.map((m) => (
          <button
            key={m.value}
            onClick={() => setMode(m.value)}
            className={clsx(
              "flex h-10 w-10 items-center justify-center rounded-lg border text-lg transition-all",
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
              mode === m.value
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 bg-white hover:bg-gray-50"
            )}
            aria-pressed={mode === m.value}
            title={`Switch to ${m.label} mode`}
          >
            {m.icon}
          </button>
        ))}
      </div>

      {showLocaleToggle && (
        <div className="flex gap-1">
          {locales.map((l) => (
            <button
              key={l.value}
              onClick={() => setLocale(l.value)}
              className={clsx(
                "flex h-10 w-10 items-center justify-center rounded-lg border text-lg transition-all",
                "focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
                locale === l.value
                  ? "border-green-500 bg-green-50"
                  : "border-gray-300 bg-white hover:bg-gray-50"
              )}
              aria-pressed={locale === l.value}
              title={l.label}
            >
              {l.flag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default UIModeToggle;
