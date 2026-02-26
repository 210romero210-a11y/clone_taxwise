import { calculateFederalTax } from '../lib/engine';

describe('Tax Calculation Engine', () => {
  test('Standard Deduction vs Itemized Deduction switching', () => {
    // Arrange
    const returnDataStd = {
      year: 2025,
      forms: {
        'W2': { box1: { formId: 'W2', fieldId: 'box1', value: 20000 } },
        '1040': { itemizedDeduction: { formId: '1040', fieldId: 'itemizedDeduction', value: 12000 } }
      }
    };
    const returnDataItemized = {
      year: 2025,
      forms: {
        'W2': { box1: { formId: 'W2', fieldId: 'box1', value: 20000 } },
        '1040': { itemizedDeduction: { formId: '1040', fieldId: 'itemizedDeduction', value: 16000 } }
      }
    };
    // Act
    const stdResult = calculateFederalTax(returnDataStd);
    const itemizedResult = calculateFederalTax(returnDataItemized);
    // Assert
    expect(stdResult.taxLiability).toBeGreaterThan(0);
    expect(itemizedResult.taxLiability).toBeLessThan(stdResult.taxLiability);
  });

  test('Self-Employment tax triggers based on Schedule C profit', () => {
    // Arrange
    const returnData = {
      year: 2025,
      forms: {
        'SchC': { netProfit: { formId: 'SchC', fieldId: 'netProfit', value: 10000 } },
        'W2': { box1: { formId: 'W2', fieldId: 'box1', value: 0 } }
      }
    };
    // Act
    const result = calculateFederalTax(returnData);
    // Assert
    expect(result.updatedFields.some(f => f.formId === 'SchSE' && f.fieldId === 'seTax')).toBe(true);
    expect(result.taxLiability).toBeGreaterThan(0);
  });

  test('Child Tax Credit eligibility logic based on AGI', () => {
    // Arrange
    const eligibleReturn = {
      year: 2025,
      forms: {
        'W2': { box1: { formId: 'W2', fieldId: 'box1', value: 50000 } },
        'SchC': { netProfit: { formId: 'SchC', fieldId: 'netProfit', value: 0 } }
      }
    };
    const ineligibleReturn = {
      year: 2025,
      forms: {
        'W2': { box1: { formId: 'W2', fieldId: 'box1', value: 210000 } },
        'SchC': { netProfit: { formId: 'SchC', fieldId: 'netProfit', value: 0 } }
      }
    };
    // Act
    const eligibleResult = calculateFederalTax(eligibleReturn);
    const ineligibleResult = calculateFederalTax(ineligibleReturn);
    // Assert
    expect(eligibleResult.diagnostics.some(d => d.fieldId === '1040.line19')).toBe(false);
    expect(ineligibleResult.diagnostics.some(d => d.fieldId === '1040.line19')).toBe(true);
  });

  test('W-2 salary update increases 1040 tax liability', () => {
    // Arrange
    const lowSalaryReturn = {
      year: 2025,
      forms: {
        'W2': { box1: { formId: 'W2', fieldId: 'box1', value: 10000 } },
        'SchC': { netProfit: { formId: 'SchC', fieldId: 'netProfit', value: 0 } }
      }
    };
    const highSalaryReturn = {
      year: 2025,
      forms: {
        'W2': { box1: { formId: 'W2', fieldId: 'box1', value: 50000 } },
        'SchC': { netProfit: { formId: 'SchC', fieldId: 'netProfit', value: 0 } }
      }
    };
    // Act
    const lowResult = calculateFederalTax(lowSalaryReturn);
    const highResult = calculateFederalTax(highSalaryReturn);
    // Assert
    expect(highResult.taxLiability).toBeGreaterThan(lowResult.taxLiability);
  });
});
