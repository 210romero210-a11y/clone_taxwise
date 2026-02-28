"use client";

import React, { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { LucideAlertCircle, LucideCheckCircle, LucideAlertTriangle, LucideInfo } from "lucide-react";
import clsx from "clsx";

interface Diagnostic {
  fieldId: string;
  formId?: string;
  message: string;
  severity: "error" | "warning" | "info";
}

interface ValidationPanelProps {
  returnId?: string;
  onFieldClick?: (formId: string, fieldId: string) => void;
  className?: string;
}

export function ValidationPanel({
  returnId,
  onFieldClick,
  className,
}: ValidationPanelProps) {
  // Fetch diagnostics from return doc
  const returnDoc = useQuery(
    api.returns.getReturn,
    returnId ? { returnId } : { returnId: "" }
  );

  // Extract diagnostics from return
  const diagnostics = useMemo((): Diagnostic[] => {
    if (!returnDoc?.diagnostics) return [];
    return returnDoc.diagnostics.map((d: any) => ({
      fieldId: d.fieldId || "",
      formId: d.fieldId?.split(".")[0] || "",
      message: d.message || "",
      severity: d.severity || "info",
    }));
  }, [returnDoc?.diagnostics]);

  // Count by severity
  const counts = useMemo(() => {
    return {
      error: diagnostics.filter(d => d.severity === "error").length,
      warning: diagnostics.filter(d => d.severity === "warning").length,
      info: diagnostics.filter(d => d.severity === "info").length,
    };
  }, [diagnostics]);

  // Group diagnostics by form
  const groupedDiagnostics = useMemo(() => {
    const groups: Record<string, Diagnostic[]> = {};
    diagnostics.forEach(d => {
      const formId = d.formId || "other";
      if (!groups[formId]) groups[formId] = [];
      groups[formId].push(d);
    });
    return groups;
  }, [diagnostics]);

  // Render severity icon
  const renderSeverityIcon = (severity: Diagnostic["severity"]) => {
    switch (severity) {
      case "error":
        return <LucideAlertCircle className="w-4 h-4 text-red-500" />;
      case "warning":
        return <LucideAlertTriangle className="w-4 h-4 text-yellow-500" />;
      case "info":
        return <LucideInfo className="w-4 h-4 text-blue-500" />;
    }
  };

  // Get severity styling
  const getSeverityStyles = (severity: Diagnostic["severity"]) => {
    switch (severity) {
      case "error":
        return "bg-red-50 border-red-200 hover:bg-red-100";
      case "warning":
        return "bg-yellow-50 border-yellow-200 hover:bg-yellow-100";
      case "info":
        return "bg-blue-50 border-blue-200 hover:bg-blue-100";
    }
  };

  // Handle diagnostic click
  const handleDiagnosticClick = (diagnostic: Diagnostic) => {
    onFieldClick?.(diagnostic.formId || "", diagnostic.fieldId);
  };

  // No diagnostics state
  if (diagnostics.length === 0) {
    return (
      <div className={clsx("p-4", className)}>
        <div className="flex items-center gap-2 text-green-600 mb-2">
          <LucideCheckCircle className="w-5 h-5" />
          <span className="font-medium">All Clear</span>
        </div>
        <p className="text-sm text-gray-500">
          No validation issues found. Your tax return looks good!
        </p>
      </div>
    );
  }

  return (
    <div className={clsx("p-4 overflow-auto", className)}>
      {/* Header with counts */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          Validation Results
        </h3>
        <div className="flex gap-3 text-xs">
          {counts.error > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <LucideAlertCircle className="w-3 h-3" />
              {counts.error} error{counts.error !== 1 ? "s" : ""}
            </span>
          )}
          {counts.warning > 0 && (
            <span className="flex items-center gap-1 text-yellow-600">
              <LucideAlertTriangle className="w-3 h-3" />
              {counts.warning} warning{counts.warning !== 1 ? "s" : ""}
            </span>
          )}
          {counts.info > 0 && (
            <span className="flex items-center gap-1 text-blue-600">
              <LucideInfo className="w-3 h-3" />
              {counts.info} info
            </span>
          )}
        </div>
      </div>

      {/* Diagnostic list grouped by form */}
      <div className="space-y-3">
        {Object.entries(groupedDiagnostics).map(([formId, items]) => (
          <div key={formId}>
            <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">
              {formId}
            </h4>
            <div className="space-y-2">
              {items.map((diagnostic, idx) => (
                <button
                  key={`${diagnostic.fieldId}-${idx}`}
                  onClick={() => handleDiagnosticClick(diagnostic)}
                  className={clsx(
                    "w-full text-left p-2 rounded border text-sm transition-colors",
                    getSeverityStyles(diagnostic.severity)
                  )}
                >
                  <div className="flex items-start gap-2">
                    {renderSeverityIcon(diagnostic.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {diagnostic.fieldId}
                      </div>
                      <div className="text-gray-600 text-xs">
                        {diagnostic.message}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Compact version for sidebar
export function ValidationBadge({ returnId }: { returnId?: string }) {
  const returnDoc = useQuery(
    api.returns.getReturn,
    returnId ? { returnId } : { returnId: "" }
  );

  const errorCount = returnDoc?.diagnostics?.filter(
    (d: any) => d.severity === "error"
  ).length || 0;

  const warningCount = returnDoc?.diagnostics?.filter(
    (d: any) => d.severity === "warning"
  ).length || 0;

  if (errorCount === 0 && warningCount === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-green-600">
        <LucideCheckCircle className="w-4 h-4" />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      {errorCount > 0 && (
        <span className="text-red-600">
          <LucideAlertCircle className="w-4 h-4" />
        </span>
      )}
      {warningCount > 0 && (
        <span className="text-yellow-600">
          <LucideAlertTriangle className="w-4 h-4" />
        </span>
      )}
    </span>
  );
}

export default ValidationPanel;
