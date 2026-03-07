/**
 * Tests for Field Mapping and Document Extraction
 * 
 * Tests the field mapping logic that bridges AI extraction output
 * to canonical tax form field IDs.
 */

import {
  mapExtractedField,
  mapExtractedFields,
  groupByFormId,
  toFieldUpdates,
  validateSSN,
  validateEIN,
  validateCurrency,
  validateExtractedFields,
  DOCUMENT_TYPE_MAPPING,
} from '../lib/fieldMapping';

describe('Field Mapping', () => {
  describe('mapExtractedField', () => {
    it('should map W2.box1 to 1040.totalIncome', () => {
      const result = mapExtractedField('W2.box1', 50000, 0.95, 'W2 Box 1');
      
      expect(result).not.toBeNull();
      expect(result?.formId).toBe('1040');
      expect(result?.fieldId).toBe('1040_totalIncome');
      expect(result?.dotFieldId).toBe('1040.totalIncome');
      expect(result?.value).toBe(50000);
      expect(result?.confidence).toBe(0.95);
    });

    it('should map W2.box2 to federal income tax withheld', () => {
      const result = mapExtractedField('W2.box2', 5000, 0.95, 'W2 Box 2');
      
      expect(result).not.toBeNull();
      expect(result?.formId).toBe('1040');
      expect(result?.fieldId).toBe('1040_federalIncomeTaxWithheld');
    });

    it('should map employer EIN from W2', () => {
      const result = mapExtractedField('W2.employerEIN', '12-3456789', 0.95, 'W2 Box b');
      
      expect(result).not.toBeNull();
      expect(result?.fieldId).toBe('W2_employerEIN');
    });

    it('should return null for unmapped fields', () => {
      const result = mapExtractedField('UNKNOWN.field', 100, 0.9, 'Unknown');
      
      expect(result).toBeNull();
    });

    it('should map 1099-MISC box7 to SchC', () => {
      const result = mapExtractedField('1099_MISC.box7', 15000, 0.9, '1099-MISC Box 7');
      
      expect(result).not.toBeNull();
      expect(result?.formId).toBe('SchC');
      expect(result?.fieldId).toBe('SchC_netEarnings');
    });

    it('should map ID fields to 1040', () => {
      const result = mapExtractedField('ID.firstName', 'John', 0.9, 'ID Document');
      
      expect(result).not.toBeNull();
      expect(result?.formId).toBe('1040');
      expect(result?.fieldId).toBe('1040_firstName');
    });

    it('should map SSN fields to 1040', () => {
      const result = mapExtractedField('SSN.number', '123-45-6789', 0.95, 'SSN Card');
      
      expect(result).not.toBeNull();
      expect(result?.formId).toBe('1040');
      expect(result?.fieldId).toBe('1040_socialSecurityNumber');
    });
  });

  describe('mapExtractedFields', () => {
    it('should map multiple W2 fields', () => {
      const extractedFields = [
        { fieldId: 'W2.box1', value: 50000, confidence: 0.95, source: 'W2 Box 1' },
        { fieldId: 'W2.box2', value: 5000, confidence: 0.95, source: 'W2 Box 2' },
        { fieldId: 'W2.employerName', value: 'Acme Corp', confidence: 0.9, source: 'W2 Box c' },
      ];

      const result = mapExtractedFields(extractedFields, 'W2');

      expect(result.length).toBe(3); // box1, box2, and employerName are all mapped
      expect(result.some(f => f.fieldId === '1040_totalIncome')).toBe(true);
      expect(result.some(f => f.fieldId === '1040_federalIncomeTaxWithheld')).toBe(true);
      expect(result.some(f => f.fieldId === 'W2_employerName')).toBe(true);
    });

    it('should map 1099-DIV fields to SchB', () => {
      const extractedFields = [
        { fieldId: '1099_DIV.box1a', value: 1000, confidence: 0.9, source: '1099-DIV Box 1a' },
        { fieldId: '1099_DIV.box1b', value: 800, confidence: 0.9, source: '1099-DIV Box 1b' },
      ];

      const result = mapExtractedFields(extractedFields, '1099-DIV');

      expect(result.length).toBe(2);
      expect(result.some(f => f.dotFieldId === 'SchB.totalGrossDividends')).toBe(true);
      expect(result.some(f => f.dotFieldId === 'SchB.qualifiedDividends')).toBe(true);
    });
  });

  describe('groupByFormId', () => {
    it('should group fields by form ID', () => {
      const mappedFields = [
        { formId: '1040', fieldId: '1040_totalIncome', dotFieldId: '1040.totalIncome', value: 50000, confidence: 0.95, source: 'W2', documentFieldId: 'W2.box1' },
        { formId: '1040', fieldId: '1040_federalIncomeTaxWithheld', dotFieldId: '1040.federalIncomeTaxWithheld', value: 5000, confidence: 0.95, source: 'W2', documentFieldId: 'W2.box2' },
        { formId: 'SchC', fieldId: 'SchC_netEarnings', dotFieldId: 'SchC.netEarnings', value: 15000, confidence: 0.9, source: '1099', documentFieldId: '1099_MISC.box7' },
      ];

      const result = groupByFormId(mappedFields);

      expect(result['1040'].length).toBe(2);
      expect(result['SchC'].length).toBe(1);
    });
  });

  describe('toFieldUpdates', () => {
    it('should convert mapped fields to update format', () => {
      const mappedFields = [
        { formId: '1040', fieldId: '1040_totalIncome', dotFieldId: '1040.totalIncome', value: 50000, confidence: 0.95, source: 'W2', documentFieldId: 'W2.box1' },
        { formId: '1040', fieldId: '1040_federalIncomeTaxWithheld', dotFieldId: '1040.federalIncomeTaxWithheld', value: 5000, confidence: 0.95, source: 'W2', documentFieldId: 'W2.box2' },
      ];

      const result = toFieldUpdates(mappedFields, 'return123', 'user456');

      expect(result.length).toBe(2);
      expect(result[0].returnId).toBe('return123');
      expect(result[0].formId).toBe('1040');
      expect(result[0].meta.triggerSource).toBe('ai_extraction');
      expect(result[0].meta.isEstimated).toBe(false); // High confidence
    });

    it('should mark low confidence fields as estimated', () => {
      const mappedFields = [
        { formId: '1040', fieldId: '1040_totalIncome', dotFieldId: '1040.totalIncome', value: 50000, confidence: 0.7, source: 'W2', documentFieldId: 'W2.box1' },
      ];

      const result = toFieldUpdates(mappedFields, 'return123', 'user456');

      expect(result[0].meta.isEstimated).toBe(true); // Low confidence
    });
  });

  describe('Validation', () => {
    describe('validateSSN', () => {
      it('should validate proper SSN formats', () => {
        expect(validateSSN('123-45-6789')).toBe(true);
        expect(validateSSN('123456789')).toBe(true);
        expect(validateSSN('123 45 6789')).toBe(true);
      });

      it('should reject invalid SSN formats', () => {
        expect(validateSSN('123-45-678')).toBe(false);
        expect(validateSSN('12345678')).toBe(false);
        expect(validateSSN('abc-de-fghi')).toBe(false);
      });
    });

    describe('validateEIN', () => {
      it('should validate proper EIN formats', () => {
        expect(validateEIN('12-3456789')).toBe(true);
        expect(validateEIN('123456789')).toBe(true);
      });

      it('should reject invalid EIN formats', () => {
        expect(validateEIN('12345678')).toBe(false);
        expect(validateEIN('1234567890')).toBe(false);
      });
    });

    describe('validateCurrency', () => {
      it('should validate currency values', () => {
        expect(validateCurrency(100)).toBe(true);
        expect(validateCurrency(0)).toBe(true);
        expect(validateCurrency(1234567.89)).toBe(true);
      });

      it('should reject invalid currency values', () => {
        expect(validateCurrency(-100)).toBe(false);
        expect(validateCurrency(NaN)).toBe(false);
        expect(validateCurrency(Infinity)).toBe(false);
        expect(validateCurrency('100' as any)).toBe(false);
      });
    });

    describe('validateExtractedFields', () => {
      it('should validate complete W2 extraction', () => {
        const mappedFields = [
          { formId: '1040', fieldId: '1040_totalIncome', dotFieldId: '1040.totalIncome', value: 50000, confidence: 0.95, source: 'W2', documentFieldId: 'W2.box1' },
        ];

        const result = validateExtractedFields(mappedFields, ['1040.totalIncome', 'W2.box1']);

        expect(result.valid).toBe(true);
        expect(result.missingFields).toHaveLength(0);
      });

      it('should report missing required fields', () => {
        const mappedFields = [
          { formId: '1040', fieldId: '1040_totalIncome', dotFieldId: '1040.totalIncome', value: 50000, confidence: 0.95, source: 'W2', documentFieldId: 'W2.box1' },
        ];

        const result = validateExtractedFields(mappedFields, ['1040.totalIncome', 'W2.box1', 'W2.box2']);

        expect(result.valid).toBe(false);
        expect(result.missingFields).toContain('W2.box2');
      });
    });
  });

  describe('DOCUMENT_TYPE_MAPPING', () => {
    it('should have mappings for W2', () => {
      expect(DOCUMENT_TYPE_MAPPING['W2']).toContain('1040');
    });

    it('should have mappings for 1099 forms', () => {
      expect(DOCUMENT_TYPE_MAPPING['1099-MISC']).toContain('1040');
      expect(DOCUMENT_TYPE_MAPPING['1099-MISC']).toContain('SchC');
    });

    it('should map ID to 1040', () => {
      expect(DOCUMENT_TYPE_MAPPING['ID']).toContain('1040');
    });
  });
});
