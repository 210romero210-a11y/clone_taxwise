"use client";

import React, { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useUIMode } from "../contexts/UIModeContext";
import TaxInput from "./TaxInput";

// Wizard step definition
export interface WizardStep {
  id: string;
  title: string;
  description: string;
  formId: string;
  fieldIds: string[];
}

// Default tax interview steps (IRS Form 1040 focused)
export const DEFAULT_WIZARD_STEPS: WizardStep[] = [
  {
    id: "personal",
    title: "Personal Information",
    description: "Name, filing status, and dependent information",
    formId: "1040",
    fieldIds: ["firstName", "lastName", "ssn", "filingStatus"],
  },
  {
    id: "income",
    title: "Income",
    description: "Wages, salaries, tips, and other income",
    formId: "W2",
    fieldIds: ["box1", "box2", "box3", "box4", "box5", "box6"],
  },
  {
    id: "business",
    title: "Business Income",
    description: "Self-employment income and expenses (Schedule C)",
    formId: "SchC",
    fieldIds: ["line1", "line2", "line3", "line4", "line5", "line6", "line7", "line31"],
  },
  {
    id: "deductions",
    title: "Deductions",
    description: "Standard or itemized deductions",
    formId: "1040",
    fieldIds: ["standardDeduction", "itemizedDeduction", "line1z"],
  },
  {
    id: "credits",
    title: "Tax Credits",
    description: "Child tax credit, education credits, and other credits",
    formId: "1040",
    fieldIds: ["line19", "line20", "line21", "line22"],
  },
  {
    id: "payments",
    title: "Payments",
    description: "Federal income tax withheld and estimated payments",
    formId: "W2",
    fieldIds: ["box17", "box18", "box19", "box20"],
  },
];

interface InterviewModeWizardProps {
  returnId?: string;
  steps?: WizardStep[];
  onComplete?: () => void;
}

export function InterviewModeWizard({
  returnId,
  steps = DEFAULT_WIZARD_STEPS,
  onComplete,
}: InterviewModeWizardProps) {
  const { currentStep, setCurrentStep, nextStep, prevStep, focusField } = useUIMode();
  
  // Fetch return data from Convex - same query as FormMode for sync
  const returnDoc = useQuery(
    api.returns.getReturn,
    returnId ? { returnId } : { returnId: "" }
  );

  // Get current step
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;
  const progress = ((currentStep + 1) / steps.length) * 100;

  // Extract field values from returnDoc
  const getFieldValue = (formId: string, fieldId: string): any => {
    if (!returnDoc?.forms) return undefined;
    const form = returnDoc.forms[formId];
    if (!form?.fields) return undefined;
    return form.fields[fieldId]?.value;
  };

  // Get field metadata
  const getFieldMeta = (formId: string, fieldId: string) => {
    if (!returnDoc?.forms) return {};
    const form = returnDoc.forms[formId];
    if (!form?.fields) return {};
    return form.fields[fieldId] || {};
  };

  // Handle field focus - sync with Form Mode
  const handleFieldFocus = (formId: string, fieldId: string) => {
    focusField(formId, fieldId);
  };

  // Handle next step
  const handleNext = () => {
    if (isLastStep) {
      onComplete?.();
    } else {
      nextStep();
    }
  };

  // Handle previous step
  const handlePrev = () => {
    prevStep();
  };

  // Render step indicator
  const renderStepIndicator = () => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          Step {currentStep + 1} of {steps.length}
        </span>
        <span className="text-sm text-gray-500">{step.title}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );

  // Render navigation buttons
  const renderNavigation = () => (
    <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-200">
      <button
        onClick={handlePrev}
        disabled={isFirstStep}
        className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors
          ${isFirstStep 
            ? "border-gray-200 text-gray-300 cursor-not-allowed" 
            : "border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
      >
        ← Previous
      </button>
      
      <div className="flex gap-2">
        {/* Step dots */}
        {steps.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => setCurrentStep(idx)}
            className={`w-2 h-2 rounded-full transition-colors ${
              idx === currentStep 
                ? "bg-blue-600" 
                : idx < currentStep 
                  ? "bg-green-500" 
                  : "bg-gray-300"
            }`}
            title={s.title}
          />
        ))}
      </div>

      <button
        onClick={handleNext}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        {isLastStep ? "Complete →" : "Next →"}
      </button>
    </div>
  );

  // Render current step content
  const renderStepContent = () => {
    if (!step) return null;

    return (
      <div className="space-y-4">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{step.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{step.description}</p>
        </div>

        <div className="grid gap-4">
          {step.fieldIds.map((fieldId) => {
            const meta = getFieldMeta(step.formId, fieldId);
            const value = getFieldValue(step.formId, fieldId);
            
            return (
              <TaxInput
                key={`${step.formId}-${fieldId}`}
                returnId={returnId}
                formId={step.formId}
                fieldId={fieldId}
                value={value}
                label={meta?.label || fieldId}
                calculated={meta?.calculated}
                overridden={meta?.overridden}
                estimated={meta?.estimated}
                error={meta?.error}
                onFocus={() => handleFieldFocus(step.formId, fieldId)}
              />
            );
          })}
        </div>
      </div>
    );
  };

  // Render step list sidebar
  const renderStepList = () => (
    <div className="w-64 bg-gray-50 border-r border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Interview Steps</h3>
      <nav className="space-y-2">
        {steps.map((s, idx) => (
          <button
            key={s.id}
            onClick={() => setCurrentStep(idx)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
              idx === currentStep
                ? "bg-blue-100 text-blue-800 font-medium"
                : idx < currentStep
                  ? "text-gray-600 hover:bg-gray-100"
                  : "text-gray-400 hover:bg-gray-100"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                idx < currentStep 
                  ? "bg-green-500 text-white" 
                  : idx === currentStep
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-500"
              }`}>
                {idx < currentStep ? "✓" : idx + 1}
              </span>
              <span className="truncate">{s.title}</span>
            </div>
          </button>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="flex h-full">
      {/* Step list sidebar */}
      {renderStepList()}
      
      {/* Main content */}
      <div className="flex-1 p-6 overflow-auto">
        {renderStepIndicator()}
        {renderStepContent()}
        {renderNavigation()}
      </div>
    </div>
  );
}

export default InterviewModeWizard;
