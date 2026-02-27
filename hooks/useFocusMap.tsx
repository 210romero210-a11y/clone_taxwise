"use client";

import React, { createContext, useContext, useRef, useState, useCallback } from "react";

type FieldEntry = {
  ref: React.RefObject<HTMLElement>;
  formId?: string;
  getState?: () => any;
};

type FocusMapContextType = {
  registerField: (fieldId: string, entry: FieldEntry) => void;
  unregisterField: (fieldId: string) => void;
  focusField: (fieldId: string) => void;
  focusNext: (currentFieldId?: string) => void;
  getFieldState: (fieldId: string) => any;
  currentFieldId?: string;
  setCurrentField: (fieldId?: string) => void;
};

const FocusMapContext = createContext<FocusMapContextType | null>(null);

export function FocusMapProvider({ children }: { children: React.ReactNode }) {
  const registryRef = useRef<Map<string, FieldEntry>>(new Map());
  const orderRef = useRef<string[]>([]);
  const [currentFieldId, setCurrentField] = useState<string | undefined>(undefined);

  const registerField = useCallback((fieldId: string, entry: FieldEntry) => {
    if (!registryRef.current.has(fieldId)) {
      orderRef.current.push(fieldId);
    }
    registryRef.current.set(fieldId, entry);
  }, []);

  const unregisterField = useCallback((fieldId: string) => {
    registryRef.current.delete(fieldId);
    orderRef.current = orderRef.current.filter((id) => id !== fieldId);
  }, []);

  const focusField = useCallback((fieldId: string) => {
    const entry = registryRef.current.get(fieldId);
    if (entry && entry.ref?.current) {
      try {
        entry.ref.current.focus();
        entry.ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (e) {
        // ignore scrolling errors in tests
      }
      setCurrentField(fieldId);
    }
  }, []);

  const focusNext = useCallback(
    (currentFieldId?: string) => {
      const order = orderRef.current;
      if (order.length === 0) return;
      const idx = currentFieldId ? order.indexOf(currentFieldId) : -1;
      const next = order[(idx + 1) % order.length];
      focusField(next);
    },
    [focusField]
  );

  const getFieldState = useCallback((fieldId: string) => {
    return registryRef.current.get(fieldId)?.getState?.();
  }, []);

  const value: FocusMapContextType = {
    registerField,
    unregisterField,
    focusField,
    focusNext,
    getFieldState,
    currentFieldId,
    setCurrentField: setCurrentField,
  };

  return <FocusMapContext.Provider value={value}>{children}</FocusMapContext.Provider>;
}

export function useFocusMap() {
  const ctx = useContext(FocusMapContext);
  if (!ctx) throw new Error("useFocusMap must be used within FocusMapProvider");
  return ctx;
}
