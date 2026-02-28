"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

// UI Mode types - supports dual entry interface
export type UIMode = "interview" | "form";

// Active field tracking for Visual Line Guide
export interface ActiveField {
  formId: string;
  fieldId: string;
}

// Context value interface
export interface UIModeContextValue {
  // Mode switching
  mode: UIMode;
  setMode: (mode: UIMode) => void;
  toggleMode: () => void;
  
  // Active field tracking (Visual Line Guide)
  activeField: ActiveField | null;
  setActiveField: (field: ActiveField | null) => void;
  
  // Field focus helpers
  focusField: (formId: string, fieldId: string) => void;
  clearActiveField: () => void;
  
  // Interview mode wizard state
  currentStep: number;
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
}

// Create context with undefined default
const UIModeContext = createContext<UIModeContextValue | undefined>(undefined);

// Storage key for persistence
const MODE_STORAGE_KEY = "taxwise_ui_mode";
const STEP_STORAGE_KEY = "taxwise_current_step";

interface UIModeProviderProps {
  children: React.ReactNode;
  defaultMode?: UIMode;
}

export function UIModeProvider({ 
  children, 
  defaultMode = "form" 
}: UIModeProviderProps) {
  // Initialize mode from localStorage or default
  const [mode, setModeState] = useState<UIMode>(defaultMode);
  const [activeField, setActiveFieldState] = useState<ActiveField | null>(null);
  const [currentStep, setCurrentStepState] = useState<number>(0);

  // Load persisted state on mount (client-side only)
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem(MODE_STORAGE_KEY) as UIMode | null;
      if (savedMode && (savedMode === "interview" || savedMode === "form")) {
        setModeState(savedMode);
      }
      
      const savedStep = localStorage.getItem(STEP_STORAGE_KEY);
      if (savedStep) {
        const stepNum = parseInt(savedStep, 10);
        if (!isNaN(stepNum) && stepNum >= 0) {
          setCurrentStepState(stepNum);
        }
      }
    } catch {
      // localStorage not available (SSR)
    }
  }, []);

  // Persist mode changes
  const setMode = useCallback((newMode: UIMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, newMode);
    } catch {
      // localStorage not available
    }
  }, []);

  // Toggle between interview and form mode
  const toggleMode = useCallback(() => {
    setMode(mode === "interview" ? "form" : "interview");
  }, [mode, setMode]);

  // Persist step changes
  const setCurrentStep = useCallback((step: number) => {
    setCurrentStepState(step);
    try {
      localStorage.setItem(STEP_STORAGE_KEY, String(step));
    } catch {
      // localStorage not available
    }
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep(currentStep + 1);
  }, [currentStep, setCurrentStep]);

  const prevStep = useCallback(() => {
    setCurrentStep(Math.max(0, currentStep - 1));
  }, [currentStep, setCurrentStep]);

  // Set active field and persist in localStorage for Visual Line Guide
  const setActiveField = useCallback((field: ActiveField | null) => {
    setActiveFieldState(field);
  }, []);

  // Helper to focus a specific field
  const focusField = useCallback((formId: string, fieldId: string) => {
    setActiveField({ formId, fieldId });
  }, [setActiveField]);

  // Clear active field
  const clearActiveField = useCallback(() => {
    setActiveField(null);
  }, [setActiveField]);

  const value: UIModeContextValue = {
    mode,
    setMode,
    toggleMode,
    activeField,
    setActiveField,
    focusField,
    clearActiveField,
    currentStep,
    setCurrentStep,
    nextStep,
    prevStep,
  };

  return (
    <UIModeContext.Provider value={value}>
      {children}
    </UIModeContext.Provider>
  );
}

// Hook to use the UI mode context
export function useUIMode() {
  const context = useContext(UIModeContext);
  if (context === undefined) {
    throw new Error("useUIMode must be used within a UIModeProvider");
  }
  return context;
}

// Hook to get only the mode (for simpler usage)
export function useMode() {
  const { mode, setMode, toggleMode } = useUIMode();
  return { mode, setMode, toggleMode };
}

// Hook to get only the active field (for Visual Line Guide)
export function useActiveField() {
  const { activeField, setActiveField, focusField, clearActiveField } = useUIMode();
  return { activeField, setActiveField, focusField, clearActiveField };
}

// Hook to get interview wizard state
export function useInterviewWizard() {
  const { currentStep, setCurrentStep, nextStep, prevStep } = useUIMode();
  return { currentStep, setCurrentStep, nextStep, prevStep };
}

export default UIModeContext;
