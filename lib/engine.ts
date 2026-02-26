// Tax calculation engine for 2025 IRS rules
// Handles flow-through logic and dependency graph

export interface FieldUpdateMeta {
  lastModifiedBy: string;
  timestamp: number;
}

export interface FormField {
  formId: string;
  fieldId: string;
  value: any;
  meta?: FieldUpdateMeta;
}

export interface ReturnData {
  year: number;
  forms: Record<string, Record<string, FormField>>;
}

export interface CalculationResult {
  refund: number;
  taxLiability: number;
  diagnostics: Array<{ fieldId: string; message: string; severity: 'error' | 'warning' }>;
  updatedFields: FormField[];
}

// Dependency graph: maps field changes to affected fields
export const DEPENDENCY_GRAPH: Record<string, string[]> = {
  'W2.box1': ['1040.line1z'],
  'SchC.netProfit': ['1040.line3', 'SchSE.seTax'],
  // Add more as needed
};

export function calculateFederalTax(returnData: ReturnData): CalculationResult {
  // Example: very simplified logic
  const diagnostics: CalculationResult['diagnostics'] = [];
  let refund = 0;
  let taxLiability = 0;
  const updatedFields: FormField[] = [];

  // Standard deduction logic
  const stdDeduction = 14600; // Single, 2025
  const itemizedDeduction = returnData.forms['1040']?.['itemizedDeduction']?.value || 0;
  const deduction = Math.max(stdDeduction, itemizedDeduction);
  const w2Salary = returnData.forms['W2']?.['box1']?.value || 0;
  const schCProfit = returnData.forms['SchC']?.['netProfit']?.value || 0;
  const agi = w2Salary + schCProfit;

  // Child Tax Credit eligibility
  const ctcEligible = agi < 200000;
  if (!ctcEligible) {
    diagnostics.push({ fieldId: '1040.line19', message: 'AGI too high for CTC', severity: 'warning' });
  }

  // Self-employment tax
  let seTax = 0;
  if (schCProfit > 0) {
    seTax = schCProfit * 0.153;
    updatedFields.push({ formId: 'SchSE', fieldId: 'seTax', value: seTax });
  }

  // Main 1040 lines
  updatedFields.push({ formId: '1040', fieldId: 'line1z', value: w2Salary });
  updatedFields.push({ formId: '1040', fieldId: 'line3', value: schCProfit });

  // Tax liability (simplified)
  taxLiability = Math.max(agi - deduction, 0) * 0.22 + seTax;
  refund = Math.max(0, 2000 - taxLiability); // Assume $2000 withholding for demo

  // Diagnostics: missing EIN
  if (!returnData.forms['W2']?.['EIN']?.value) {
    diagnostics.push({ fieldId: 'W2.EIN', message: 'Missing EIN', severity: 'error' });
  }

  return { refund, taxLiability, diagnostics, updatedFields };
}
