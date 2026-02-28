/**
 * MeF (Modernized e-File) Business Rules Validator
 * Validates tax returns against IRS business rules before transmission
 * Based on IRS Publication 4163 and 4164
 */

import {
  ReturnData,
  ReturnHeader,
  TaxForm,
  Taxpayer,
  MeFError,
  ValidationResult,
  FilingStatus,
} from './mefTypes';
import { ERROR_CODES } from './mefTypes';

// ============================================================================
// Main Validation Entry Point
// ============================================================================

/**
 * Validate a complete return for MeF filing
 * @param returnData - The return data to validate
 * @returns ValidationResult with any errors found
 */
export function validateForFiling(returnData: ReturnData): ValidationResult {
  const errors: MeFError[] = [];

  // Validate return header
  errors.push(...validateReturnHeader(returnData.returnHeader));

  // Validate forms
  for (const form of returnData.forms) {
    errors.push(...validateForm(form));
  }

  // Run business rules
  errors.push(...validateBusinessRules(returnData));

  return {
    isValid: errors.filter(e => e.severity === 'error').length === 0,
    errors,
    validatedAt: new Date(),
  };
}

/**
 * Validate a submission bundle
 */
export function validateSubmission(bundle: {
  returns: ReturnData[];
}): ValidationResult {
  const allErrors: MeFError[] = [];

  for (const returnData of bundle.returns) {
    allErrors.push(...validateForFiling(returnData).errors);
  }

  return {
    isValid: allErrors.filter(e => e.severity === 'error').length === 0,
    errors: allErrors,
    validatedAt: new Date(),
  };
}

// ============================================================================
// Header Validation
// ============================================================================

function validateReturnHeader(header: ReturnHeader): MeFError[] {
  const errors: MeFError[] = [];

  // Validate tax year
  const currentYear = new Date().getFullYear();
  const taxYear = parseInt(header.taxYear, 10);
  if (isNaN(taxYear) || taxYear < 2020 || taxYear > currentYear + 1) {
    errors.push({
      code: ERROR_CODES.SCHEMA_INVALID_VALUE,
      message: `Invalid Tax Year: ${header.taxYear}. Must be between 2020 and ${currentYear + 1}`,
      severity: 'error',
      formId: 'ReturnHeader',
      fieldId: 'TaxYear',
      actionable: true,
      suggestedFix: `Provide a valid tax year between 2020 and ${currentYear + 1}`,
    });
  }

  // Validate filing status
  errors.push(...validateFilingStatus(header.filingStatus));

  // Validate originator (EFIN)
  errors.push(...validateOriginator(header.originator));

  // Validate software info
  errors.push(...validateSoftware(header.software));

  // Validate primary taxpayer
  errors.push(...validateTaxpayer(header.taxpayer, 'Primary'));

  // Validate spouse if present
  if (header.spouse) {
    errors.push(...validateTaxpayer(header.spouse, 'Spouse'));
  }

  // Validate PIN
  errors.push(...validatePIN(header.pin));

  return errors;
}

function validateFilingStatus(status: FilingStatus): MeFError[] {
  const errors: MeFError[] = [];
  const validStatuses: FilingStatus[] = [
    'Single',
    'MarriedFilingJointly',
    'MarriedFilingSeparately',
    'HeadOfHousehold',
    'QualifyingWidower',
  ];

  if (!validStatuses.includes(status)) {
    errors.push({
      code: ERROR_CODES.INVALID_FILING_STATUS,
      message: `Invalid filing status: ${status}`,
      severity: 'error',
      formId: 'ReturnHeader',
      fieldId: 'FilingStatus',
      actionable: true,
      suggestedFix: 'Provide a valid filing status: Single, MarriedFilingJointly, MarriedFilingSeparately, HeadOfHousehold, or QualifyingWidower',
    });
  }

  return errors;
}

function validateOriginator(originator: ReturnHeader['originator']): MeFError[] {
  const errors: MeFError[] = [];

  // Validate EFIN format (9 digits)
  if (!originator.efin || !/^\d{9}$/.test(originator.efin)) {
    errors.push({
      code: ERROR_CODES.INVALID_EFIN,
      message: 'EFIN must be exactly 9 digits',
      severity: 'error',
      formId: 'ReturnHeader',
      fieldId: 'EFIN',
      actionable: true,
      suggestedFix: 'Provide a valid 9-digit EFIN',
    });
  }

  // Validate EFIN type
  if (originator.efinType !== 'SO' && originator.efinType !== 'SP') {
    errors.push({
      code: ERROR_CODES.SCHEMA_INVALID_VALUE,
      message: 'EFINType must be "SO" or "SP"',
      severity: 'error',
      formId: 'ReturnHeader',
      fieldId: 'EFINType',
      actionable: true,
      suggestedFix: 'Set EFINType to "SO" (Self-Owner) or "SP" (Satellite Location)',
    });
  }

  return errors;
}

function validateSoftware(software: ReturnHeader['software']): MeFError[] {
  const errors: MeFError[] = [];

  if (!software.softwareId || software.softwareId.length < 5) {
    errors.push({
      code: ERROR_CODES.SCHEMA_MISSING_REQUIRED,
      message: 'SoftwareId is required and must be at least 5 characters',
      severity: 'error',
      formId: 'ReturnHeader',
      fieldId: 'SoftwareId',
      actionable: true,
      suggestedFix: 'Provide a valid SoftwareId assigned by the IRS',
    });
  }

  if (!software.version) {
    errors.push({
      code: ERROR_CODES.SCHEMA_MISSING_REQUIRED,
      message: 'SoftwareVersion is required',
      severity: 'error',
      formId: 'ReturnHeader',
      fieldId: 'SoftwareVersion',
      actionable: true,
      suggestedFix: 'Provide the software version number',
    });
  }

  return errors;
}

function validateTaxpayer(taxpayer: Taxpayer, type: 'Primary' | 'Spouse'): MeFError[] {
  const errors: MeFError[] = [];
  const fieldPrefix = type === 'Primary' ? 'Primary' : 'Spouse';

  // Validate SSN format (XXX-XX-XXXX)
  if (!taxpayer.ssn || !/^\d{3}-\d{2}-\d{4}$/.test(taxpayer.ssn)) {
    errors.push({
      code: ERROR_CODES.SSN_FORMAT_INVALID,
      message: `${type} Taxpayer SSN must be in format XXX-XX-XXXX`,
      severity: 'error',
      formId: 'ReturnHeader',
      fieldId: `${fieldPrefix}SSN`,
      actionable: true,
      suggestedFix: 'Provide SSN in format: XXX-XX-XXXX',
    });
  }

  // Validate first name
  if (!taxpayer.firstName || taxpayer.firstName.trim().length === 0) {
    errors.push({
      code: ERROR_CODES.MISSING_REQUIRED_FIELD,
      message: `${type} Taxpayer First Name is required`,
      severity: 'error',
      formId: 'ReturnHeader',
      fieldId: `${fieldPrefix}FirstName`,
      actionable: true,
      suggestedFix: 'Provide the taxpayer\'s first name',
    });
  }

  // Validate last name
  if (!taxpayer.lastName || taxpayer.lastName.trim().length === 0) {
    errors.push({
      code: ERROR_CODES.MISSING_REQUIRED_FIELD,
      message: `${type} Taxpayer Last Name is required`,
      severity: 'error',
      formId: 'ReturnHeader',
      fieldId: `${fieldPrefix}LastName`,
      actionable: true,
      suggestedFix: 'Provide the taxpayer\'s last name',
    });
  }

  // Validate address
  errors.push(...validateAddress(taxpayer.address, type));

  return errors;
}

function validateAddress(address: Taxpayer['address'], type: string): MeFError[] {
  const errors: MeFError[] = [];
  const fieldPrefix = type === 'Primary' ? 'Primary' : 'Spouse';

  if (!address.addressLine1 || address.addressLine1.trim().length === 0) {
    errors.push({
      code: ERROR_CODES.MISSING_REQUIRED_FIELD,
      message: `${type} Address Line 1 is required`,
      severity: 'error',
      formId: 'ReturnHeader',
      fieldId: `${fieldPrefix}AddressLine1`,
      actionable: true,
      suggestedFix: 'Provide street address',
    });
  }

  if (!address.city || address.city.trim().length === 0) {
    errors.push({
      code: ERROR_CODES.MISSING_REQUIRED_FIELD,
      message: `${type} City is required`,
      severity: 'error',
      formId: 'ReturnHeader',
      fieldId: `${fieldPrefix}City`,
      actionable: true,
      suggestedFix: 'Provide city',
    });
  }

  if (!address.state || address.state.length !== 2) {
    errors.push({
      code: ERROR_CODES.MISSING_REQUIRED_FIELD,
      message: `${type} State must be a 2-letter abbreviation`,
      severity: 'error',
      formId: 'ReturnHeader',
      fieldId: `${fieldPrefix}State`,
      actionable: true,
      suggestedFix: 'Provide 2-letter state abbreviation (e.g., CA, NY)',
    });
  }

  // Validate ZIP code
  if (!address.zipCode || !/^\d{5}(-\d{4})?$/.test(address.zipCode)) {
    errors.push({
      code: ERROR_CODES.SCHEMA_INVALID_VALUE,
      message: `${type} ZIP Code must be 5 or 9 digits (XXXXX or XXXXX-XXXX)`,
      severity: 'error',
      formId: 'ReturnHeader',
      fieldId: `${fieldPrefix}ZIPCode`,
      actionable: true,
      suggestedFix: 'Provide ZIP code in format XXXXX or XXXXX-XXXX',
    });
  }

  return errors;
}

function validatePIN(pin: ReturnHeader['pin']): MeFError[] {
  const errors: MeFError[] = [];

  if (!pin.pinType) {
    errors.push({
      code: ERROR_CODES.MISSING_REQUIRED_FIELD,
      message: 'PIN Type is required',
      severity: 'error',
      formId: 'ReturnHeader',
      fieldId: 'PINType',
      actionable: true,
      suggestedFix: 'Set PINType to "Self-Select" or "Practitioner"',
    });
  }

  // Validate Primary PIN (5 digits for self-select)
  if (pin.pinType === 'Self-Select') {
    if (!pin.primaryPin || !/^\d{5}$/.test(pin.primaryPin)) {
      errors.push({
        code: ERROR_CODES.INVALID_PIN,
        message: 'Primary PIN must be exactly 5 digits',
        severity: 'error',
        formId: 'ReturnHeader',
        fieldId: 'PrimaryPIN',
        actionable: true,
        suggestedFix: 'Provide a 5-digit PIN',
      });
    }

    // Check spouse PIN for MFJ
    if (pin.spousePin && !/^\d{5}$/.test(pin.spousePin)) {
      errors.push({
        code: ERROR_CODES.INVALID_PIN,
        message: 'Spouse PIN must be exactly 5 digits',
        severity: 'error',
        formId: 'ReturnHeader',
        fieldId: 'SpousePIN',
        actionable: true,
        suggestedFix: 'Provide a 5-digit PIN for spouse',
      });
    }
  }

  return errors;
}

// ============================================================================
// Form Validation
// ============================================================================

function validateForm(form: TaxForm): MeFError[] {
  const errors: MeFError[] = [];

  // Form ID must exist
  if (!form.formId) {
    errors.push({
      code: ERROR_CODES.MISSING_REQUIRED_FIELD,
      message: 'Form ID is required',
      severity: 'error',
      formId: form.formId,
      fieldId: 'FormId',
      actionable: true,
      suggestedFix: 'Provide a valid form identifier',
    });
  }

  // Validate each field
  for (const field of form.fields) {
    errors.push(...validateFormField(field, form.formId));
  }

  // Validate supporting forms
  if (form.supportingForms) {
    for (const supportingForm of form.supportingForms) {
      errors.push(...validateForm(supportingForm));
    }
  }

  return errors;
}

function validateFormField(
  field: { fieldId: string; value: unknown },
  formId: string
): MeFError[] {
  const errors: MeFError[] = [];

  // Field ID is required
  if (!field.fieldId || field.fieldId.trim().length === 0) {
    errors.push({
      code: ERROR_CODES.MISSING_REQUIRED_FIELD,
      message: 'Field ID is required',
      severity: 'error',
      formId,
      fieldId: '',
      actionable: true,
      suggestedFix: 'Provide a valid field identifier',
    });
  }

  // Check for special fields that need validation
  const fieldIdLower = field.fieldId.toLowerCase();

  // SSN validation
  if (fieldIdLower.includes('ssn') && field.value) {
    const ssn = String(field.value);
    if (!/^\d{3}-\d{2}-\d{4}$/.test(ssn) && !/^\d{9}$/.test(ssn)) {
      errors.push({
        code: ERROR_CODES.SSN_FORMAT_INVALID,
        message: `Invalid SSN format: ${ssn}`,
        severity: 'error',
        formId,
        fieldId: field.fieldId,
        actionable: true,
        suggestedFix: 'Provide SSN in format XXX-XX-XXXX',
      });
    }
  }

  // EIN validation
  if (fieldIdLower.includes('ein') && field.value) {
    const ein = String(field.value);
    if (!/^\d{2}-\d{7}$/.test(ein) && !/^\d{9}$/.test(ein)) {
      errors.push({
        code: ERROR_CODES.EIN_FORMAT_INVALID,
        message: `Invalid EIN format: ${ein}`,
        severity: 'error',
        formId,
        fieldId: field.fieldId,
        actionable: true,
        suggestedFix: 'Provide EIN in format XX-XXXXXXX',
      });
    }
  }

  // Currency/amount validation
  if (fieldIdLower.includes('amount') || fieldIdLower.includes('amt')) {
    if (field.value !== null && field.value !== undefined && field.value !== '') {
      const num = typeof field.value === 'number' ? field.value : parseFloat(String(field.value));
      if (isNaN(num)) {
        errors.push({
          code: ERROR_CODES.SCHEMA_INVALID_VALUE,
          message: `Invalid numeric value for ${field.fieldId}`,
          severity: 'error',
          formId,
          fieldId: field.fieldId,
          actionable: true,
          suggestedFix: 'Provide a valid number',
        });
      }
    }
  }

  return errors;
}

// ============================================================================
// Business Rules Validation
// ============================================================================

function validateBusinessRules(returnData: ReturnData): MeFError[] {
  const errors: MeFError[] = [];

  // Get key fields for business rule validation
  const forms = returnData.forms;
  const form1040 = forms.find(f => f.formId === '1040');

  if (form1040) {
    // Check for required 1040 fields
    errors.push(...validate1040RequiredFields(form1040));
  }

  // Check for Schedule C if business income reported
  const hasScheduleC = forms.some(f => f.formId === 'ScheduleC');
  if (hasScheduleC) {
    errors.push(...validateScheduleC(forms.find(f => f.formId === 'ScheduleC')!));
  }

  // Validate withholding matches forms submitted
  errors.push(...validateWithholdingConsistency(forms));

  return errors;
}

function validate1040RequiredFields(form1040: TaxForm): MeFError[] {
  const errors: MeFError[] = [];
  const requiredFields = ['FilingStatus', 'SSN', 'LastName'];

  for (const requiredField of requiredFields) {
    const hasField = form1040.fields.some(
      f => f.fieldId.toLowerCase() === requiredField.toLowerCase()
    );
    if (!hasField) {
      errors.push({
        code: ERROR_CODES.MISSING_REQUIRED_FIELD,
        message: `Form 1040 is missing required field: ${requiredField}`,
        severity: 'error',
        formId: '1040',
        fieldId: requiredField,
        actionable: true,
        suggestedFix: `Add field ${requiredField} to Form 1040`,
      });
    }
  }

  return errors;
}

function validateScheduleC(scheduleC: TaxForm): MeFError[] {
  const errors: MeFError[] = [];

  // Check for business name if net profit exists
  const netProfitField = scheduleC.fields.find(
    f => f.fieldId.toLowerCase().includes('netprofit') || f.fieldId.toLowerCase() === 'line31'
  );

  if (netProfitField && netProfitField.value) {
    const profit = typeof netProfitField.value === 'number' 
      ? netProfitField.value 
      : parseFloat(String(netProfitField.value));

    if (profit > 0) {
      // Need business name
      const hasBusinessName = scheduleC.fields.some(
        f => f.fieldId.toLowerCase().includes('businessname') || f.fieldId === 'Line2'
      );
      if (!hasBusinessName) {
        errors.push({
          code: ERROR_CODES.MISSING_REQUIRED_FIELD,
          message: 'Schedule C requires business name when net profit is positive',
          severity: 'error',
          formId: 'ScheduleC',
          fieldId: 'BusinessName',
          actionable: true,
          suggestedFix: 'Add business name to Schedule C',
        });
      }
    }
  }

  return errors;
}

function validateWithholdingConsistency(forms: TaxForm[]): MeFError[] {
  const errors: MeFError[] = [];

  // Get total withholding from W2 forms
  let totalWithholding = 0;
  const w2Forms = forms.filter(f => f.formId === 'FormW2');

  for (const w2 of w2Forms) {
    const federalWithholding = w2.fields.find(
      f => f.fieldId.toLowerCase() === 'federalwithholding' || f.fieldId.toLowerCase() === 'box2'
    );
    if (federalWithholding?.value) {
      const amount = typeof federalWithholding.value === 'number'
        ? federalWithholding.value
        : parseFloat(String(federalWithholding.value));
      if (!isNaN(amount)) {
        totalWithholding += amount;
      }
    }
  }

  // Check that withholding appears on 1040
  const form1040 = forms.find(f => f.formId === '1040');
  if (form1040 && totalWithholding > 0) {
    const hasWithholdingOn1040 = form1040.fields.some(
      f => f.fieldId.toLowerCase().includes('withholding') || f.fieldId.toLowerCase().includes('line25')
    );
    if (!hasWithholdingOn1040) {
      errors.push({
        code: ERROR_CODES.BUSINESS_RULE_FAILED,
        message: 'Total withholding from W2 forms must be reported on Form 1040',
        severity: 'error',
        formId: '1040',
        fieldId: 'Withholding',
        actionable: true,
        suggestedFix: 'Add total withholding to Form 1040 Line 25',
      });
    }
  }

  return errors;
}

// ============================================================================
// Schema Validation (XSD equivalent)
// ============================================================================

/**
 * Validate XML schema compliance
 * This is a simplified validation - real implementation would use XSD parser
 */
export function validateSchema(returnData: ReturnData): MeFError[] {
  const errors: MeFError[] = [];

  // Check root elements exist
  if (!returnData.returnHeader) {
    errors.push({
      code: ERROR_CODES.SCHEMA_MISSING_REQUIRED,
      message: 'ReturnHeader is required',
      severity: 'error',
      formId: '',
      fieldId: '',
      actionable: true,
    });
  }

  if (!returnData.forms || returnData.forms.length === 0) {
    errors.push({
      code: ERROR_CODES.SCHEMA_MISSING_REQUIRED,
      message: 'At least one form is required',
      severity: 'error',
      formId: '',
      fieldId: '',
      actionable: true,
    });
  }

  return errors;
}
