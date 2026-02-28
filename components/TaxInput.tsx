"use client";

import React, { useEffect, useRef, useState } from "react";
import { useOptimistic } from "react";
import { LucideAlertCircle } from "lucide-react";
import clsx from "clsx";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useFocusMap } from "../hooks/useFocusMap";

export interface TaxInputProps {
  returnId?: string;
  formId?: string;
  fieldId: string;
  value: any;
  calculated?: boolean;
  overridden?: boolean;
  estimated?: boolean;
  error?: string;
  diagnostics?: Array<{ fieldId: string; message: string; severity: "error" | "warning" }>;
  lastModifiedBy?: string;
  timestamp?: number;
  onChange?: (value: any) => void;
  onFocus?: () => void;
  label?: string;
}

const TaxInput: React.FC<TaxInputProps> = ({
  returnId,
  formId,
  fieldId,
  value,
  calculated = false,
  overridden = false,
  estimated = false,
  error,
  diagnostics = [],
  lastModifiedBy,
  timestamp,
  onChange,
  onFocus,
  label,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  // Optimistic UI: useOptimistic for instant feedback
  const [optimisticValue, setOptimisticValue] = useOptimistic(value);
  const [localOverride, setLocalOverride] = useState<boolean>(!!overridden);
  const [localEstimated, setLocalEstimated] = useState<boolean>(!!estimated);

  const { registerField, unregisterField, setCurrentField, focusNext, getFieldState } = useFocusMap();

  const updateField = useMutation(api.returns.updateField);

  useEffect(() => {
    registerField(fieldId, {
      ref: inputRef as React.RefObject<HTMLElement>,
      formId,
      getState: () => ({ value: optimisticValue, overridden: localOverride, estimated: localEstimated, formId }),
    });
    return () => unregisterField(fieldId);
  }, [fieldId, formId, optimisticValue, localOverride, localEstimated, registerField, unregisterField]);

  useEffect(() => setLocalOverride(!!overridden), [overridden]);
  useEffect(() => setLocalEstimated(!!estimated), [estimated]);

  // Error/diagnostic handling
  const hasError = diagnostics.some((d) => d.severity === "error");
  const errorMsg = diagnostics.find((d) => d.severity === "error")?.message || error;

  // Audit trail formatting
  const auditTrail =
    lastModifiedBy && timestamp ? `Last modified by ${lastModifiedBy} at ${new Date(timestamp).toLocaleString()}` : undefined;

  const isReadOnly = calculated && !localOverride;

  const toggleOverride = async () => {
    const newOverride = !localOverride;
    setLocalOverride(newOverride);
    // optimistic UI applied immediately
    try {
      await updateField({
        returnId: returnId ?? "",
        formId: formId ?? "",
        fieldId,
        value: optimisticValue,
        lastModifiedBy: "ui",
        meta: { isOverride: newOverride },
      });
    } catch (e) {
      // ignore; optimistic UI will be corrected on sync
    }
  };

  const toggleEstimated = async () => {
    const newEst = !localEstimated;
    setLocalEstimated(newEst);
    try {
      await updateField({
        returnId: returnId ?? "",
        formId: formId ?? "",
        fieldId,
        value: optimisticValue,
        lastModifiedBy: "ui",
        meta: { isEstimated: newEst },
      });
    } catch (e) {}
  };

  const handleBlur = async () => {
    if (onChange) onChange(optimisticValue);
    try {
      await updateField({
        returnId: returnId ?? "",
        formId: formId ?? "",
        fieldId,
        value: optimisticValue,
        lastModifiedBy: "ui",
      });
    } catch (e) {}
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      // Ctrl+Enter = override
      e.preventDefault();
      void toggleOverride();
    } else if (e.key === "Enter") {
      e.preventDefault();
      focusNext(fieldId);
    }
  };

  const bgClass = hasError
    ? "bg-red-50 border-red-300"
    : localOverride
    ? "bg-pink-50 border-pink-300"
    : localEstimated
    ? "bg-yellow-50 border-yellow-300"
    : calculated
    ? "bg-blue-50 border-blue-200"
    : "bg-white border-gray-300";

  return (
    <div className="mb-2">
      <label className="block text-xs font-medium mb-1">{label}</label>
      <div className="relative">
        <input
          ref={inputRef}
          data-fieldid={fieldId}
          className={clsx("w-full px-2 py-1 rounded border text-sm transition", bgClass)}
          value={optimisticValue ?? ""}
          onFocus={() => {
            setCurrentField(fieldId);
            onFocus?.();
          }}
          onChange={(e) => {
            setOptimisticValue(e.target.value);
            if (onChange) onChange(e.target.value);
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={isReadOnly}
        />
        {hasError && (
          <span className="absolute right-2 top-1 text-red-500">
            <LucideAlertCircle size={16} />
          </span>
        )}
      </div>
      {errorMsg && <div className="text-xs text-red-600 mt-1">{errorMsg}</div>}
      {auditTrail && <div className="text-[11px] text-gray-400 mt-1">{auditTrail}</div>}
    </div>
  );
};

export default TaxInput;
