"use client";

import { useCallback } from "react";
import { useFocusMap } from "./useFocusMap";

/**
 * Hook for navigating to fields from diagnostic clicks.
 * Uses the existing Visual Line Guide logic from useFocusMap.
 */
export function useDiagnosticNavigation() {
  const { focusField, focusNext, currentFieldId } = useFocusMap();

  /**
   * Navigate to a field by its ID (dot notation or simple ID).
   * Supports both "W2.box1" format and simple "fieldId" format.
   */
  const navigateToField = useCallback(
    (fieldId: string) => {
      if (!fieldId) return;

      // If the fieldId contains a dot, try to extract the simple fieldId
      // e.g., "W2.box1" -> try to focus "box1" or "W2.box1" directly
      const normalizedFieldId = fieldId.includes(".")
        ? fieldId.split(".").pop() || fieldId
        : fieldId;

      // Try focusing with the normalized ID first
      focusField(normalizedFieldId);

      // If that didn't work, try the full fieldId
      if (currentFieldId !== normalizedFieldId) {
        focusField(fieldId);
      }
    },
    [focusField, currentFieldId]
  );

  /**
   * Navigate to the next field with an error.
   * Useful for "jump to next error" functionality.
   */
  const navigateToNextError = useCallback(() => {
    // This would typically find the next field with an error diagnostic
    // For now, we just use the focusNext from useFocusMap
    focusNext(currentFieldId);
  }, [focusNext, currentFieldId]);

  /**
   * Get the display name for a field from a diagnostic.
   * Could be enhanced to look up field labels from translations.
   */
  const getFieldDisplayName = useCallback(
    (fieldId: string, locale: "en" | "es" = "en"): string => {
      // If the field contains a dot, format it nicely
      if (fieldId.includes(".")) {
        const parts = fieldId.split(".");
        const formId = parts[0];
        const simpleFieldId = parts.slice(1).join(".");
        // Return a formatted display name
        return `${formId} - ${simpleFieldId}`;
      }
      return fieldId;
    },
    []
  );

  /**
   * Extract form ID from a diagnostic field ID.
   * e.g., "W2.box1" -> "W2"
   */
  const extractFormId = useCallback((fieldId: string): string => {
    if (fieldId.includes(".")) {
      return fieldId.split(".")[0];
    }
    return "";
  }, []);

  /**
   * Extract field ID from a diagnostic field ID.
   * e.g., "W2.box1" -> "box1"
   */
  const extractFieldId = useCallback((fieldId: string): string => {
    if (fieldId.includes(".")) {
      return fieldId.split(".").slice(1).join(".");
    }
    return fieldId;
  }, []);

  return {
    navigateToField,
    navigateToNextError,
    getFieldDisplayName,
    extractFormId,
    extractFieldId,
    currentFocusedField: currentFieldId,
  };
}

export default useDiagnosticNavigation;
