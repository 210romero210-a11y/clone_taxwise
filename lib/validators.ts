// Suite of IRS-compliant tax rule validators for diagnostics
// Each rule returns: { fieldId, severity, message, form }

export type Diagnostic = {
  fieldId: string;
  severity: 'Error' | 'Warning';
  message: string;
  form: string;
};

// Flexible field type (Convex FieldDoc or any mapping)
export type FieldDoc = Record<string, any>;

// Example: Validate SSN format (XXX-XX-XXXX)
function ssnRule(fields: FieldDoc[]): Diagnostic[] {
  return fields
    .filter(f => f.fieldId?.toLowerCase().includes('ssn'))
    .filter(f => f.value && !/^\d{3}-\d{2}-\d{4}$/.test(f.value))
    .map(f => ({
      fieldId: f.fieldId,
      severity: 'Error',
      message: 'Invalid SSN format (expected XXX-XX-XXXX)',
      form: f.formId || '',
    }));
}

// Example: Positive number check (e.g., WagesAmt)
function positiveNumberRule(fields: FieldDoc[]): Diagnostic[] {
  return fields
    .filter(f => /amt|amount|wages/i.test(f.fieldId))
    .filter(f => typeof f.value === 'number' && f.value < 0)
    .map(f => ({
      fieldId: f.fieldId,
      severity: 'Error',
      message: 'Value must be positive',
      form: f.formId || '',
    }));
}

// Example: Filing Status required
function filingStatusRule(fields: FieldDoc[]): Diagnostic[] {
  const fs = fields.find(f => f.fieldId === '1040_FS');
  if (!fs || !fs.value) {
    return [{
      fieldId: '1040_FS',
      severity: 'Error',
      message: 'Filing Status is required',
      form: fs?.formId || '1040',
    }];
  }
  return [];
}

// Add more rules as needed (EIN, dependent logic, etc)

const rules = [ssnRule, positiveNumberRule, filingStatusRule];

export function runDiagnostics(fields: FieldDoc[]): Diagnostic[] {
  return rules.flatMap(rule => rule(fields));
}
