// Suite of IRS-compliant tax rule validators for diagnostics
// Each rule returns: { fieldId, severity, message, form }

export type Diagnostic = {
  fieldId: string;
  severity: 'error' | 'warning';
  message: string;
  form: string;
};

// Flexible field type (Convex FieldDoc or any mapping)
export type FieldDoc = Record<string, any>;

import { canonicalDot } from './fieldIds';

function normalizedId(f: FieldDoc) {
  const raw = f.fieldId ?? (f.formId ? `${f.formId}.${f.fieldId}` : '');
  return canonicalDot(String(raw));
}

// Example: Validate SSN format (XXX-XX-XXXX)
function ssnRule(fields: FieldDoc[]): Diagnostic[] {
  return fields
    .filter(f => normalizedId(f).toLowerCase().includes('ssn'))
    .filter(f => f.value && !/^\d{3}-\d{2}-\d{4}$/.test(String(f.value)))
    .map(f => ({
      fieldId: normalizedId(f),
      severity: 'error',
      message: 'Invalid SSN format (expected XXX-XX-XXXX)',
      form: f.formId || '',
    }));
}

// Validate EIN format (XX-XXXXXXX)
function einRule(fields: FieldDoc[]): Diagnostic[] {
  return fields
    .filter(f => normalizedId(f).toLowerCase().includes('ein'))
    .filter(f => f.value && !/^\d{2}-\d{7}$/.test(String(f.value)))
    .map(f => ({
      fieldId: normalizedId(f),
      severity: 'error',
      message: 'Invalid EIN format (expected XX-XXXXXXX)',
      form: f.formId || '',
    }));
}

// Example: Positive number check (e.g., WagesAmt)
function positiveNumberRule(fields: FieldDoc[]): Diagnostic[] {
  return fields
    .filter(f => /amt|amount|wages/i.test(normalizedId(f)))
    .filter(f => typeof f.value === 'number' && f.value < 0)
    .map(f => ({
      fieldId: normalizedId(f),
      severity: 'error',
      message: 'Value must be positive',
      form: f.formId || '',
    }));
}

// Example: Filing Status required
function filingStatusRule(fields: FieldDoc[]): Diagnostic[] {
  const fs = fields.find(f => normalizedId(f) === '1040.FS');
  if (!fs || !fs.value) {
    return [{
      fieldId: '1040.FS',
      severity: 'error',
      message: 'Filing Status is required',
      form: fs?.formId || '1040',
    }];
  }
  return [];
}

// Dependent/Child Tax Credit logic: if CTC is claimed, ensure dependent ages qualify
function dependentAgeRule(fields: FieldDoc[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const ctcClaim = fields.find(f => {
    const fid = normalizedId(f).replace(/\./g, '').toLowerCase();
    return (/ctc|childtaxcredit/i.test(fid) || /childtaxcredit/i.test(fid)) && (f.value === true || f.value === 'yes' || f.value === '1' || f.value === 1);
  });
  if (!ctcClaim) return diagnostics;

  // Find dependent age/dob fields (use canonical dot keys)
  const depAgeFields = fields.filter(f => {
    const fid = normalizedId(f);
    return /dependent.*age|age.*dependent|dependent\d+\.age|dob/i.test(fid) || (/dependent/i.test(fid) && /age|dob/i.test(fid));
  });
  for (const f of depAgeFields) {
    let age: number | null = null;
    if (typeof f.value === 'number') age = f.value;
    else if (typeof f.value === 'string') {
      const n = parseInt(f.value, 10);
      if (!isNaN(n)) age = n;
      else {
        const d = new Date(f.value);
        if (!isNaN(d.getTime())) {
          const today = new Date();
          age = today.getFullYear() - d.getFullYear();
        }
      }
    }
    if (age !== null && age >= 18) {
      diagnostics.push({
        fieldId: normalizedId(f),
        severity: 'error',
        message: 'Dependent appears too old for Child Tax Credit',
        form: f.formId || '',
      });
    }
  }
  return diagnostics;
}

// Add more rules as needed (EIN, dependent logic, etc)

const rules = [ssnRule, einRule, positiveNumberRule, filingStatusRule, dependentAgeRule];

export function runDiagnostics(fields: FieldDoc[]): Diagnostic[] {
  return rules.flatMap(rule => rule(fields));
}
