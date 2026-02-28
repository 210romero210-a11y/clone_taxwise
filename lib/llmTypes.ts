import { Id } from "@/convex/_generated/dataModel";

export type FieldValue = number | string | boolean | null;

export type ValidFieldUpdate = Readonly<{
  returnId: Id<"returns">;
  formId: string; // canonical form id, e.g., "1040", "SchC"
  fieldId: string; // canonical field id in dot or underscore per engine mapping
  value: FieldValue;
}>;

export type LlmFieldSuggestion = Readonly<{
  updates: ReadonlyArray<ValidFieldUpdate>;
  rationale?: string;
}>;

export type DiagnosticLevel = "info" | "warn" | "error";

export type ApplyResult = Readonly<{
  applied: ReadonlyArray<ValidFieldUpdate>;
  diagnostics: ReadonlyArray<{ code: string; level: DiagnosticLevel }>;
}>;
