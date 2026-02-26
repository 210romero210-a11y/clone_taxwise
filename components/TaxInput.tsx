import React, { useState } from "react";
import { useOptimistic } from "react";
import { LucideAlertCircle } from "lucide-react";
import clsx from "clsx";

export interface TaxInputProps {
  value: any;
  error?: string;
  diagnostics?: Array<{ fieldId: string; message: string; severity: "error" | "warning" }>;
  lastModifiedBy?: string;
  timestamp?: number;
  onChange: (value: any) => void;
  label?: string;
}

const TaxInput: React.FC<TaxInputProps> = ({
  value,
  error,
  diagnostics = [],
  lastModifiedBy,
  timestamp,
  onChange,
  label,
}) => {
  // Optimistic UI: useOptimistic for instant feedback
  const [optimisticValue, setOptimisticValue] = useOptimistic(value);

  // Error/diagnostic handling
  const hasError = diagnostics.some((d) => d.severity === "error");
  const errorMsg = diagnostics.find((d) => d.severity === "error")?.message || error;

  // Audit trail formatting
  const auditTrail =
    lastModifiedBy && timestamp
      ? `Last modified by ${lastModifiedBy} at ${new Date(timestamp).toLocaleString()}`
      : undefined;

  return (
    <div className="mb-2">
      <label className="block text-xs font-medium mb-1">{label}</label>
      <div className="relative">
        <input
          className={clsx(
            "w-full px-2 py-1 rounded border text-sm transition",
            hasError
              ? "border-red-500 bg-red-50"
              : "border-gray-300 focus:border-blue-500 bg-white"
          )}
          value={optimisticValue}
          onChange={(e) => {
            setOptimisticValue(e.target.value);
            onChange(e.target.value);
          }}
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
