"use client";

import React from "react";
import DiagnosticList, { Diagnostic } from "./DiagnosticList";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useFocusMap } from "../hooks/useFocusMap";

export default function DiagnosticPanel({ returnId }: { returnId?: string }) {
  const diagnostics = useQuery(api.diagnostics.getDiagnosticsForReturn, { returnId }) ?? [];
  const { focusField } = useFocusMap();

  const handleSelect = (fieldId: string) => {
    focusField(fieldId);
  };

  return <DiagnosticList diagnostics={diagnostics as Diagnostic[]} onSelectField={handleSelect} />;
}
