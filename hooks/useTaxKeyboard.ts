"use client";

import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useFocusMap } from "./useFocusMap";

export default function useTaxKeyboard(returnId?: string) {
  const { currentFieldId, getFieldState, focusNext } = useFocusMap();
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

      if (key === "Enter") {
        e.preventDefault();
        focusNext(current);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentFieldId, getFieldState, focusNext, updateField, returnId]);
}
