"use client";

import React from "react";
import DiagnosticList, { Diagnostic as DiagnosticListItem } from "./DiagnosticList";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { useFocusMap } from "../hooks/useFocusMap";
import { useLocale } from "../contexts/LocaleContext";
import { translateDiagnosticMessage } from "../lib/i18n/diagnosticTranslations";
import { LanguageIndicator } from "./LocaleToggle";

// Internal diagnostic type for translation
interface TranslatedDiagnostic {
  fieldId: string;
  severity: "Error" | "Warning";
  message: string;
  form: string;
}

// Helper to normalize severity to capitalized form
function normalizeSeverity(severity: string): "Error" | "Warning" {
  const lower = severity.toLowerCase();
  if (lower === "error") return "Error";
  return "Warning";
}

export default function DiagnosticPanel({ returnId }: { returnId?: string }) {
  const { focusField } = useFocusMap();
  const { locale, t } = useLocale();

  // Only call the query if we have a valid returnId
  const rawDiagnostics = returnId 
    ? useQuery(api.diagnostics.getDiagnosticsForReturn, { returnId: returnId as Id<"returns"> }) ?? []
    : [];

  const handleSelect = (fieldId: string) => {
    focusField(fieldId);
  };

  // Translate diagnostic messages based on current locale
  const translatedDiagnostics = React.useMemo((): TranslatedDiagnostic[] => {
    return (rawDiagnostics as Array<{fieldId: string; severity: string; message: string; form: string}>).map((diag) => ({
      fieldId: diag.fieldId,
      severity: normalizeSeverity(diag.severity),
      message: translateDiagnosticMessage(diag.message, locale),
      form: diag.form,
    }));
  }, [rawDiagnostics, locale]);

  // Count errors and warnings
  const errorCount = translatedDiagnostics.filter(
    (d) => d.severity === "Error"
  ).length;
  const warningCount = translatedDiagnostics.filter(
    (d) => d.severity === "Warning"
  ).length;

  return (
    <aside className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* Header with title and locale indicator */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-800">
          {t("diagnostics.title")}
        </h2>
        <LanguageIndicator />
      </div>

      {/* Error/Warning summary */}
      <div className="flex gap-2 px-3 py-2 border-b border-gray-100">
        {errorCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            {errorCount} {t("diagnostics.errors")}
          </span>
        )}
        {warningCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-1 rounded-full">
            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
            {warningCount} {t("diagnostics.warnings")}
          </span>
        )}
        {errorCount === 0 && warningCount === 0 && (
          <span className="text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
            {t("diagnostics.noDiagnostics")}
          </span>
        )}
      </div>

      {/* Diagnostic list - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <DiagnosticList
          diagnostics={translatedDiagnostics as DiagnosticListItem[]}
          onSelectField={handleSelect}
        />
      </div>
    </aside>
  );
}
