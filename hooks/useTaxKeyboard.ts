"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useFocusMap } from "./useFocusMap";

export default function useTaxKeyboard(returnId?: string) {
  const { currentFieldId, getFieldState, focusNext, focusField, findNextRequired } = useFocusMap();
  const updateField = useMutation(api.returns.updateField);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const key = e.key;
      const current = currentFieldId;
      if (!current && key !== "Enter") return;

      if (key === "F8") {
        e.preventDefault();
        const state = getFieldState(current!);
        const formId = state?.formId ?? state?.form ?? "";
        const value = state?.value ?? null;
        const overridden = !!state?.overridden;
        if (!returnId) return;
        updateField({
          returnId,
          formId,
          fieldId: current!,
          value,
          lastModifiedBy: "ui",
          meta: { isOverride: !overridden },
        });
      }

      if (key === "F3") {
        e.preventDefault();
        const state = getFieldState(current!);
        const formId = state?.formId ?? state?.form ?? "";
        const value = state?.value ?? null;
        const estimated = !!state?.estimated;
        if (!returnId) return;
        updateField({
          returnId,
          formId,
          fieldId: current!,
          value,
          lastModifiedBy: "ui",
          meta: { isEstimated: !estimated },
        });
      }

      if (key === "F5") {
        e.preventDefault();
        // open internal calculator UI — consumers can listen for this event
        window.dispatchEvent(new CustomEvent('openInternalCalculator', { detail: { fieldId: current } }));
      }

      if (key === "F9") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('linkField', { detail: { fieldId: current } }));
      }

      // Ctrl+Enter: manual override (alternate to F8)
      if ((key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        const state = getFieldState(current!);
        const formId = state?.formId ?? state?.form ?? "";
        const value = state?.value ?? null;
        const overridden = !!state?.overridden;
        if (!returnId) return;
        updateField({ returnId, formId, fieldId: current!, value, lastModifiedBy: 'ui', meta: { isOverride: !overridden } });
      }

      if (key === 'Enter') {
        e.preventDefault();
        focusNext(current);
      }

      // Ctrl+E: jump to next required field
      if ((key === 'e' || key === 'E') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const next = findNextRequired ? findNextRequired(current) : undefined;
        if (next) focusField(next);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentFieldId, getFieldState, focusNext, updateField, returnId]);
}
