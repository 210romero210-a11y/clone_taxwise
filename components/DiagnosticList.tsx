import React from "react";
import * as ScrollArea from "@radix-ui/react-scroll-area";

export interface Diagnostic {
  fieldId: string;
  severity: "Error" | "Warning";
  message: string;
  form: string;
}

interface DiagnosticListProps {
  diagnostics: Diagnostic[];
  onSelectField?: (fieldId: string) => void;
}

const DiagnosticList: React.FC<DiagnosticListProps> = ({ diagnostics, onSelectField }) => {
  return (
    <aside className="w-80 bg-white border-l border-gray-200 p-2">
      <div className="text-sm font-semibold px-2 py-1">Diagnostics</div>
      <ScrollArea.Root className="h-[80vh] w-full overflow-hidden">
        <ScrollArea.Viewport className="h-full w-full">
          <ul className="space-y-1">
            {diagnostics.map((diag, i) => {
              const sev = String(diag.severity).toLowerCase();
              const isError = sev === "error";
              return (
                <li
                  key={i}
                  className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-gray-100 ${
                    isError
                      ? "text-red-700 border-l-4 border-red-500 bg-red-50"
                      : "text-yellow-700 border-l-4 border-yellow-400 bg-yellow-50"
                  }`}
                  onClick={() => onSelectField?.(diag.fieldId)}
                  tabIndex={0}
                  aria-label={`Diagnostic: ${diag.message}`}
                >
                  <span className="font-bold text-xs w-12">{diag.severity}</span>
                  <span className="flex-1 text-xs truncate">{diag.message}</span>
                  <span className="text-xs text-gray-400">{diag.form}</span>
                </li>
              );
            })}
          </ul>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" className="ScrollAreaScrollbar" />
      </ScrollArea.Root>
    </aside>
  );
};

export default DiagnosticList;
