/**
 * Field Mapping Utilities for AI Document Extraction
 * 
 * Maps extracted document fields to canonical tax form field IDs.
 * This bridges the gap between AI extraction (W2.box1) and the 
 * tax engine (1040.totalIncome).
 */

import { canonicalDot, toUnderscoreKey } from './fieldIds';

// ============================================
// Document Type to Tax Form Mapping
// ============================================

/**
 * Maps document type to the tax forms it feeds into
 */
export const DOCUMENT_TYPE_MAPPING: Record<string, string[]> = {
  'W2': ['1040', 'Sch1', 'SchSE'],
  '1099-MISC': ['1040', 'SchC', 'Sch1'],
  '1099-NEC': ['1040', 'SchC', 'SchSE'],
  '1099-DIV': ['1040', 'SchB'],
  '1099-INT': ['1040', 'SchB'],
  '1099-K': ['1040', 'SchC'],
  'ID': ['1040'],
  'SSN': ['1040'],
};

// ============================================
// W-2 to 1040 Field Mappings
// ============================================

/**
 * Maps W-2 fields to 1040 fields
 * Based on IRS Form 1040 instructions
 */
export const W2_TO_1040_MAPPING: Record<string, { targetField: string; transform?: (v: number) => number }> = {
  // Box 1 -> Line 1z (Wages)
  'W2.box1': { targetField: '1040.totalIncome' },
  
  // Box 2 -> Line 25a (Federal Income Tax Withheld)
  'W2.box2': { targetField: '1040.federalIncomeTaxWithheld' },
  
  // Box 3 -> Used for Social Security calculation
  'W2.box3': { targetField: 'W2.socialSecurityWages' },
  
  // Box 4 -> Used for Social Security calculation
  'W2.box4': { targetField: 'W2.socialSecurityTax' },
  
  // Box 5 -> Used for Medicare calculation
  'W2.box5': { targetField: 'W2.medicareWages' },
  
  // Box 6 -> Used for Medicare calculation
  'W2.box6': { targetField: 'W2.medicareTax' },
  
  // Box 10 -> Line 26 (Dependent care benefits)
  'W2.box10': { targetField: '1040.dependentCareBenefits' },
  
  // Box 11 -> Line 13 (Nonqualified plans)
  'W2.box11': { targetField: '1040.nonqualifiedPlans' },
  
  // Box 12 codes -> Various 1040 lines
  // Box 12a -> Line 13 if code DD (dependent care)
  // Box 12b -> Line 13 if code E (deferred comp)
  // Box 12c -> Line 13 if code F (fringe benefits)
  // Box 12d -> Line 13 if code G (HSAs)
  
  // Box 13 -> Line 13 (Statutory employee, etc.)
  'W2.box13': { targetField: '1040.otherIncome' },
  
  // State wages/tax mappings are commented out - state returns not yet implemented
  // TODO: Implement state return support when STATE schema is defined
  // 'W2.stateWages': { targetField: 'STATE.stateWages', formId: 'STATE' },
  // 'W2.stateTax': { targetField: 'STATE.stateTax', formId: 'STATE' },
};

// ============================================
// 1099 to Tax Form Field Mappings
// ============================================

/**
 * Maps 1099-MISC fields to tax form fields
 */
export const FORM_1099_MISC_MAPPING: Record<string, { targetField: string; formId: string }> = {
  '1099_MISC.box1': { targetField: 'SchC.rentReceived', formId: 'SchC' },
  '1099_MISC.box2': { targetField: 'SchC.royalties', formId: 'SchC' },
  '1099_MISC.box3': { targetField: '1040.otherIncome', formId: '1040' },
  '1099_MISC.box4': { targetField: '1040.federalIncomeTaxWithheld', formId: '1040' },
  '1099_MISC.box5': { targetField: 'SchC.fishingBoatProceeds', formId: 'SchC' },
  '1099_MISC.box6': { targetField: 'SchC.medicalPayments', formId: 'SchC' },
  '1099_MISC.box7': { targetField: 'SchC.netEarnings', formId: 'SchC' },
  '1099_MISC.box14': { targetField: 'SchC.otherExpenses', formId: 'SchC' },
};

/**
 * Maps 1099-NEC fields to tax form fields
 */
export const FORM_1099_NEC_MAPPING: Record<string, { targetField: string; formId: string }> = {
  '1099_NEC.box1': { targetField: 'SchC.netEarnings', formId: 'SchC' },
  '1099_NEC.box2': { targetField: '1040.federalIncomeTaxWithheld', formId: '1040' },
};

/**
 * Maps 1099-DIV fields to tax form fields
 */
export const FORM_1099_DIV_MAPPING: Record<string, { targetField: string; formId: string }> = {
  '1099_DIV.box1a': { targetField: 'SchB.totalGrossDividends', formId: 'SchB' },
  '1099_DIV.box1b': { targetField: 'SchB.qualifiedDividends', formId: 'SchB' },
  '1099_DIV.box2a': { targetField: 'SchB.totalOrdinaryDividends', formId: 'SchB' },
  '1099_DIV.box3': { targetField: 'SchB.collectiveDistributions', formId: 'SchB' },
  '1099_DIV.box4': { targetField: 'SchB.investmentExpenses', formId: 'SchB' },
  '1099_DIV.box5': { targetField: 'SchB.foreignTaxPaid', formId: 'SchB' },
  '1099_DIV.box6': { targetField: 'SchB.foreignCountry', formId: 'SchB' },
  '1099_DIV.box7': { targetField: 'SchB.taxExemptInterest', formId: 'SchB' },
  '1099_DIV.box8': { targetField: 'SchB.taxExemptDiv', formId: 'SchB' },
  '1099_DIV.box10': { targetField: 'SchB.stateTaxWithheld', formId: 'SchB' },
};

/**
 * Maps 1099-INT fields to tax form fields
 */
export const FORM_1099_INT_MAPPING: Record<string, { targetField: string; formId: string }> = {
  '1099_INT.box1': { targetField: 'SchB.interestIncome', formId: 'SchB' },
  '1099_INT.box2': { targetField: 'SchB.earlyWithdrawalPenalty', formId: 'SchB' },
  '1099_INT.box3': { targetField: 'SchB.interestInUS', formId: 'SchB' },
  '1099_INT.box4': { targetField: 'SchB.federalIncomeTaxWithheld', formId: 'SchB' },
  '1099_INT.box5': { targetField: 'SchB.investmentExpenses', formId: 'SchB' },
  '1099_INT.box6': { targetField: 'SchB.foreignTaxPaid', formId: 'SchB' },
  '1099_INT.box8': { targetField: 'SchB.taxExemptInterest', formId: 'SchB' },
};

// ============================================
// ID Document to 1040 Field Mappings
// ============================================

/**
 * Maps ID extraction fields to 1040 personal information
 */
export const ID_TO_1040_MAPPING: Record<string, { targetField: string }> = {
  'ID.firstName': { targetField: '1040.firstName' },
  'ID.lastName': { targetField: '1040.lastName' },
  'ID.dateOfBirth': { targetField: '1040.dateOfBirth' },
  'ID.address': { targetField: '1040.homeAddress' },
  'ID.licenseNumber': { targetField: '1040.driversLicenseNumber' },
};

// ============================================
// SSN to Tax Form Field Mappings
// ============================================

/**
 * Maps SSN card extraction to tax form fields
 * Use getSSNTo1040Mapping() for context-aware mapping, or use this default for primary taxpayer
 */
export const SSN_TO_1040_MAPPING: Record<string, { targetField: string }> = {
  'SSN.number': { targetField: '1040.socialSecurityNumber' },
  'SSN.name': { targetField: '1040.firstName' },
  'SSN.dateOfBirth': { targetField: '1040.dateOfBirth' },
};

/**
 * Get context-aware SSN mapping
 * @param taxpayerContext - 'primary' | 'spouse' to specify which taxpayer this SSN belongs to
 */
export function getSSNTo1040Mapping(taxpayerContext: 'primary' | 'spouse' = 'primary'): Record<string, { targetField: string }> {
  if (taxpayerContext === 'spouse') {
    return {
      'SSN.number': { targetField: '1040.spouseSSN' },
      'SSN.name': { targetField: '1040.spouseFirstName' },
      'SSN.dateOfBirth': { targetField: '1040.spouseDateOfBirth' },
    };
  }
  // Primary taxpayer (same as default SSN_TO_1040_MAPPING)
  return {
    'SSN.number': { targetField: '1040.socialSecurityNumber' },
    'SSN.name': { targetField: '1040.firstName' },
    'SSN.dateOfBirth': { targetField: '1040.dateOfBirth' },
  };
}

// ============================================
// Core Mapping Functions
// ============================================

/**
 * Result of mapping an extracted field to tax form fields
 */
export interface MappedField {
  formId: string;
  fieldId: string;       // Underscore format for FIELD_MAP
  dotFieldId: string;    // Dot format for engine
  value: any;
  confidence: number;
  source: string;
  documentFieldId: string;
}

/**
 * Map a single extracted field to its corresponding tax form field(s)
 */
export function mapExtractedField(
  fieldId: string,
  value: any,
  confidence: number,
  source: string
): MappedField | null {
  // Try to find a mapping based on the field ID prefix
  const mapping = findMapping(fieldId);
  
  if (!mapping) {
    return null;
  }

  // Convert field ID formats
  const dotFieldId = canonicalDot(mapping.targetField);
  const underscoreFieldId = toUnderscoreKey(mapping.targetField);

  return {
    formId: mapping.formId,
    fieldId: underscoreFieldId,
    dotFieldId,
    value,
    confidence,
    source,
    documentFieldId: fieldId,
  };
}

/**
 * Find the appropriate mapping for a field ID
 */
function findMapping(fieldId: string): { targetField: string; formId: string } | null {
  const prefix = fieldId.split('.')[0];
  
  // Handle W-2 fields
  if (prefix === 'W2') {
    // Skip state fields for now - state returns not yet implemented
    if (fieldId === 'W2.stateWages' || fieldId === 'W2.stateTax') {
      return null;
    }
    
    const mapping = W2_TO_1040_MAPPING[fieldId];
    if (mapping) {
      // W-2 always maps to 1040 for federal return
      return { targetField: mapping.targetField, formId: '1040' };
    }
    return null;
  }
  
  // Handle 1099 fields
  if (prefix.startsWith('1099')) {
    const formType = prefix.replace('-', '_');
    if (formType === '1099_MISC') return FORM_1099_MISC_MAPPING[fieldId] || null;
    if (formType === '1099_NEC') return FORM_1099_NEC_MAPPING[fieldId] || null;
    if (formType === '1099_DIV') return FORM_1099_DIV_MAPPING[fieldId] || null;
    if (formType === '1099_INT') return FORM_1099_INT_MAPPING[fieldId] || null;
  }
  
  // Handle ID fields
  if (prefix === 'ID') {
    const mapping = ID_TO_1040_MAPPING[fieldId];
    if (mapping) {
      return { targetField: mapping.targetField, formId: '1040' };
    }
    return null;
  }
  
  // Handle SSN fields
  if (prefix === 'SSN') {
    const mapping = SSN_TO_1040_MAPPING[fieldId];
    if (mapping) {
      return { targetField: mapping.targetField, formId: '1040' };
    }
    return null;
  }
  
  return null;
}

/**
 * Map all extracted fields from a document to tax form fields
 */
export function mapExtractedFields(
  extractedFields: Array<{ fieldId: string; value: any; confidence: number; source: string }>,
  documentType: string
): MappedField[] {
  const mappedFields: MappedField[] = [];
  
  for (const field of extractedFields) {
    const mapped = mapExtractedField(field.fieldId, field.value, field.confidence, field.source);
    if (mapped) {
      mappedFields.push(mapped);
    }
  }
  
  return mappedFields;
}

/**
 * Group mapped fields by form ID for efficient updates
 */
export function groupByFormId(mappedFields: MappedField[]): Record<string, MappedField[]> {
  const grouped: Record<string, MappedField[]> = {};
  
  for (const field of mappedFields) {
    if (!grouped[field.formId]) {
      grouped[field.formId] = [];
    }
    grouped[field.formId].push(field);
  }
  
  return grouped;
}

/**
 * Convert mapped fields to updateField mutation format
 */
export function toFieldUpdates(
  mappedFields: MappedField[],
  returnId: string,
  userId: string
): Array<{
  returnId: string;
  formId: string;
  fieldId: string;
  value: any;
  lastModifiedBy: string;
  meta: { triggerSource: string; isEstimated: boolean; confidence: number };
}> {
  return mappedFields.map(field => ({
    returnId,
    formId: field.formId,
    fieldId: field.fieldId,
    value: field.value,
    lastModifiedBy: userId,
    meta: {
      triggerSource: 'ai_extraction' as const,
      isEstimated: field.confidence < 0.8, // Mark as estimated if confidence is low
      confidence: field.confidence,
    },
  }));
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate an SSN format
 */
export function validateSSN(ssn: string): boolean {
  // Basic SSN validation: XXX-XX-XXXX or XXXXXXXXX
  const cleaned = ssn.replace(/[-\s]/g, '');
  return /^\d{9}$/.test(cleaned);
}

/**
 * Validate an EIN format
 */
export function validateEIN(ein: string): boolean {
  // EIN format: XX-XXXXXXX
  const cleaned = ein.replace(/[-\s]/g, '');
  return /^\d{9}$/.test(cleaned);
}

/**
 * Validate a currency value
 */
export function validateCurrency(value: any): boolean {
  if (typeof value !== 'number') return false;
  return !isNaN(value) && isFinite(value) && value >= 0;
}

/**
 * Validate extracted fields meet minimum requirements
 */
export function validateExtractedFields(
  mappedFields: MappedField[],
  requiredFields: string[]
): { valid: boolean; missingFields: string[]; errors: string[] } {
  const errors: string[] = [];
  const presentFields = new Set(mappedFields.map(f => f.dotFieldId));
  const missingFields: string[] = [];
  
  for (const required of requiredFields) {
    if (!presentFields.has(required)) {
      missingFields.push(required);
      errors.push(`Missing required field: ${required}`);
    }
  }
  
  // Check for invalid values
  for (const field of mappedFields) {
    // Validate SSN format - only for fields that specifically contain 'SSN' and 'number' in a specific pattern
    const isSSNField = 
      (field.fieldId === '1040_socialSecurityNumber' || 
       field.fieldId === '1040_spouseSSN' ||
       field.documentFieldId === 'SSN.number' ||
       field.documentFieldId === 'W2.employeeSSN');
    
    if (isSSNField && typeof field.value === 'string') {
      if (!validateSSN(field.value)) {
        errors.push(`Invalid SSN format in ${field.fieldId}: ${field.value}`);
      }
    }
    
    // Validate EIN format
    const isEINField = 
      field.fieldId.includes('employerEIN') ||
      field.documentFieldId?.includes('employerEIN');
    
    if (isEINField && typeof field.value === 'string') {
      if (!validateEIN(field.value)) {
        errors.push(`Invalid EIN format in ${field.fieldId}: ${field.value}`);
      }
    }
    
    // Validate currency values (but not names or addresses)
    const isTextField = field.fieldId.includes('Name') || 
                       field.fieldId.includes('Address') ||
                       field.fieldId.includes('city') ||
                       field.fieldId.includes('state');
    
    if (!isTextField && !validateCurrency(field.value)) {
      errors.push(`Invalid currency value for ${field.fieldId}: ${field.value}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    missingFields,
    errors,
  };
}

// ============================================
// Default Exports
// ============================================

export default {
  DOCUMENT_TYPE_MAPPING,
  W2_TO_1040_MAPPING,
  FORM_1099_MISC_MAPPING,
  FORM_1099_NEC_MAPPING,
  FORM_1099_DIV_MAPPING,
  FORM_1099_INT_MAPPING,
  ID_TO_1040_MAPPING,
  SSN_TO_1040_MAPPING,
  getSSNTo1040Mapping,
  mapExtractedField,
  mapExtractedFields,
  groupByFormId,
  toFieldUpdates,
  validateSSN,
  validateEIN,
  validateCurrency,
  validateExtractedFields,
};
