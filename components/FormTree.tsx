"use client";

import React, { useEffect, useState, useCallback } from "react";

// Minimal FormTree component using Tailwind CSS and Radix-style primitives.
// This component is compact / high-density for tax workflows.

export type FieldState = "normal" | "calculated" | "override";

export interface FieldNode {
  fieldId: string;
  label?: string;
  value?: any;
  state?: FieldState;
  diagnostics?: Array<{ message: string; severity: "error" | "warning" }>;
  lastModifiedBy?: string;
  timestamp?: number;
}

export interface FormNode {
  formId: string;
  name?: string;
  fields?: FieldNode[];
}

export interface FormTreeProps {
  forms: FormNode[];
  onToggleOverride?: (formId: string, fieldId: string, override: boolean) => void;
}

export const FormTree: React.FC<FormTreeProps> = ({ forms = [], onToggleOverride }) => {
  const [focused, setFocused] = useState<{ formId: string; fieldId: string } | null>(null);
  const [localStates, setLocalStates] = useState<Record<string, FieldState>>({});

  useEffect(() => {
    // Initialize local states from props
    const init: Record<string, FieldState> = {};
    forms.forEach((f) => {
      f.fields?.forEach((fld) => {
        init[`${f.formId}:${fld.fieldId}`] = fld.state ?? "normal";
      });
    });
    setLocalStates(init);
  }, [forms]);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "F5") {
        e.preventDefault();
        if (!focused) return;
        const key = `${focused.formId}:${focused.fieldId}`;
        setLocalStates((s) => {
          const prev = s[key] ?? "normal";
          const next = prev === "override" ? "normal" : "override";
          if (onToggleOverride) onToggleOverride(focused.formId, focused.fieldId, next === "override");
          return { ...s, [key]: next };
        });
      }
    },
    [focused, onToggleOverride]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  return (
    <aside className="w-80 bg-gray-50 border-r border-gray-200 p-2">
      <div className="text-sm font-semibold px-2 py-1">Forms Tree</div>
      <div className="space-y-1 overflow-auto max-h-[80vh]">
        {forms.map((form) => (
          <div key={form.formId} className="border-b border-gray-100 py-1 px-2">
            <div className="text-xs font-medium text-gray-700">{form.name ?? form.formId}</div>
            <div className="mt-1 grid gap-1 text-xs">
              {form.fields?.map((fld) => {
                const key = `${form.formId}:${fld.fieldId}`;
                const state = localStates[key] ?? fld.state ?? "normal";
                const hasError = fld.diagnostics?.some(d => d.severity === "error");
                const errorMsg = fld.diagnostics?.find(d => d.severity === "error")?.message;
                const auditTrail =
                  fld.lastModifiedBy && fld.timestamp
                    ? `Last modified by ${fld.lastModifiedBy} at ${new Date(fld.timestamp).toLocaleString()}`
                    : undefined;
                return (
                  <div
                    key={key}
                    tabIndex={0}
                    onFocus={() => setFocused({ formId: form.formId, fieldId: fld.fieldId })}
                    className={
                      `flex items-center justify-between gap-2 px-1 py-0.5 hover:bg-gray-100 rounded ${hasError ? 'border border-red-500 bg-red-50' : ''}`
                    }
                  >
                    <div className="flex-1 truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-gray-600 truncate">{fld.label ?? fld.fieldId}</span>
                        <span className="text-[11px] text-gray-400">{String(fld.value ?? "")}</span>
                        {hasError && <span className="text-red-500"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/></svg></span>}
                      </div>
                      {errorMsg && <div className="text-xs text-red-600 mt-0.5">{errorMsg}</div>}
                      {auditTrail && <div className="text-[11px] text-gray-400 mt-0.5">{auditTrail}</div>}
                    </div>
                    <div className="ml-2 text-[11px]">
                      {state === "normal" && <span className="text-gray-500">—</span>}
                      {state === "calculated" && <span className="text-blue-600">Calc</span>}
                      {state === "override" && <span className="text-yellow-700">OVR</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default FormTree;
