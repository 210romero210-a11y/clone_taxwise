"use client";

import React, { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useUIMode, ActiveField } from "../contexts/UIModeContext";
import TaxInput from "./TaxInput";
import clsx from "clsx";

// Form layout definition for grid
export interface FormLayout {
  formId: string;
  formName: string;
  rows: FormRow[];
}

export interface FormRow {
  rowId: string;
  label: string;
  fields: FormCell[];
}

export interface FormCell {
  fieldId: string;
  colSpan?: number;
}

// Default form layouts (IRS 1040 focused)
export const DEFAULT_FORM_LAYOUTS: FormLayout[] = [
  {
    formId: "1040",
    formName: "Form 1040 - U.S. Individual Income Tax Return",
    rows: [
      {
        rowId: "header",
        label: "Filing Status",
        fields: [
          { fieldId: "filingStatus", colSpan: 2 },
        ],
      },
      {
        rowId: "income",
        label: "Income",
        fields: [
          { fieldId: "line1z", colSpan: 1 }, // Wages
          { fieldId: "line2", colSpan: 1 },  // Tax exempt interest
          { fieldId: "line3", colSpan: 1 },  // Dividends
          { fieldId: "line6", colSpan: 1 },  // Other income
        ],
      },
      {
        rowId: "agi",
        label: "Adjusted Gross Income",
        fields: [
          { fieldId: "line11", colSpan: 2 },
        ],
      },
      {
        rowId: "deductions",
        label: "Deductions",
        fields: [
          { fieldId: "standardDeduction", colSpan: 1 },
          { fieldId: "itemizedDeduction", colSpan: 1 },
        ],
      },
      {
        rowId: "tax",
        label: "Tax and Credits",
        fields: [
          { fieldId: "line16", colSpan: 1 },
          { fieldId: "line19", colSpan: 1 }, // Child tax credit
          { fieldId: "line20", colSpan: 1 },
          { fieldId: "line21", colSpan: 1 },
        ],
      },
      {
        rowId: "payments",
        label: "Payments",
        fields: [
          { fieldId: "line25a", colSpan: 1 },
          { fieldId: "line25b", colSpan: 1 },
          { fieldId: "line26", colSpan: 1 },
          { fieldId: "line31", colSpan: 1 },
        ],
      },
      {
        rowId: "refund",
        label: "Refund",
        fields: [
          { fieldId: "line34a", colSpan: 2 },
        ],
      },
    ],
  },
  {
    formId: "W2",
    formName: "Form W-2 - Wage and Tax Statement",
    rows: [
      {
        rowId: "employer",
        label: "Employer",
        fields: [
          { fieldId: "EIN", colSpan: 1 },
          { fieldId: "employerName", colSpan: 1 },
        ],
      },
      {
        rowId: "wages",
        label: "Wages",
        fields: [
          { fieldId: "box1", colSpan: 1 }, // Wages
          { fieldId: "box2", colSpan: 1 }, // Federal tax withheld
        ],
      },
      {
        rowId: "social",
        label: "Social Security & Medicare",
        fields: [
          { fieldId: "box3", colSpan: 1 },
          { fieldId: "box4", colSpan: 1 },
          { fieldId: "box5", colSpan: 1 },
          { fieldId: "box6", colSpan: 1 },
        ],
      },
      {
        rowId: "state",
        label: "State Tax",
        fields: [
          { fieldId: "box17", colSpan: 1 },
          { fieldId: "box18", colSpan: 1 },
          { fieldId: "box19", colSpan: 1 },
          { fieldId: "box20", colSpan: 1 },
        ],
      },
    ],
  },
  {
    formId: "SchC",
    formName: "Schedule C - Profit or Loss From Business",
    rows: [
      {
        rowId: "income",
        label: "Income",
        fields: [
          { fieldId: "line1", colSpan: 1 },
          { fieldId: "line2", colSpan: 1 },
          { fieldId: "line3", colSpan: 1 },
          { fieldId: "line4", colSpan: 1 },
        ],
      },
      {
        rowId: "expenses",
        label: "Expenses",
        fields: [
          { fieldId: "line5", colSpan: 1 },
          { fieldId: "line6", colSpan: 1 },
          { fieldId: "line7", colSpan: 1 },
          { fieldId: "line8", colSpan: 1 },
        ],
      },
      {
        rowId: "net",
        label: "Net Profit",
        fields: [
          { fieldId: "line31", colSpan: 2 },
        ],
      },
    ],
  },
];

interface FormModeGridProps {
  returnId?: string;
  layouts?: FormLayout[];
}

export function FormModeGrid({
  returnId,
  layouts = DEFAULT_FORM_LAYOUTS,
}: FormModeGridProps) {
  const { activeField, focusField, clearActiveField } = useUIMode();

  // Fetch return data from Convex - same query as InterviewMode for sync
  const returnDoc = useQuery(
    api.returns.getReturn,
    returnId ? { returnId } : { returnId: "" }
  );

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

  // Check if a field is currently active (for Visual Line Guide)
  const isFieldActive = (formId: string, fieldId: string): boolean => {
    return activeField?.formId === formId && activeField?.fieldId === fieldId;
  };

  // Check if a row contains the active field (for Visual Line Guide)
  const isRowActive = (formId: string, fields: FormCell[]): boolean => {
    return fields.some(f => activeField?.formId === formId && activeField?.fieldId === f.fieldId);
  };

  // Handle field focus - sync with Interview Mode
  const handleFieldFocus = (formId: string, fieldId: string) => {
    focusField(formId, fieldId);
  };

  // Render a single cell
  const renderCell = (formId: string, cell: FormCell, meta: any, value: any) => {
    const isActive = isFieldActive(formId, cell.fieldId);
    
    return (
      <div
        key={`${formId}-${cell.fieldId}`}
        className={clsx(
          "transition-all duration-150",
          isActive && "ring-2 ring-blue-500 ring-offset-1 z-10"
        )}
      >
        <TaxInput
          returnId={returnId}
          formId={formId}
          fieldId={cell.fieldId}
          value={value}
          label={meta?.label || cell.fieldId}
          calculated={meta?.calculated}
          overridden={meta?.overridden}
          estimated={meta?.estimated}
          error={meta?.error}
          onFocus={() => handleFieldFocus(formId, cell.fieldId)}
        />
      </div>
    );
  };

  // Render a row
  const renderRow = (formId: string, row: FormRow) => {
    const isActive = isRowActive(formId, row.fields);
    
    return (
      <div
        key={`${formId}-${row.rowId}`}
        className={clsx(
          "grid grid-cols-3 gap-4 p-3 border-b transition-colors",
          isActive && "bg-yellow-50 border-l-4 border-l-yellow-400"
        )}
        data-formid={formId}
        data-rowid={row.rowId}
      >
        <div className="col-span-1 flex items-center">
          <span className="text-sm font-medium text-gray-700">{row.label}</span>
        </div>
        <div className="col-span-2 grid grid-cols-2 gap-4">
          {row.fields.map((cell) => {
            const meta = getFieldMeta(formId, cell.fieldId);
            const value = getFieldValue(formId, cell.fieldId);
            return renderCell(formId, cell, meta, value);
          })}
        </div>
      </div>
    );
  };

  // Render a form section
  const renderForm = (layout: FormLayout) => {
    return (
      <div key={layout.formId} className="border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="bg-gray-100 px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-800">{layout.formName}</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {layout.rows.map((row) => renderRow(layout.formId, row))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 p-6 overflow-auto bg-white">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Tax Forms</h2>
          <p className="text-sm text-gray-500">
            Enter values directly into form fields. Click on a field to see it highlighted in Interview mode.
          </p>
        </div>

        {/* Forms grid */}
        {layouts.map((layout) => renderForm(layout))}
      </div>
    </div>
  );
}

export default FormModeGrid;
