import { runDiagnostics } from '../lib/validators';

describe('validators: diagnostics', () => {
  test('missing filing status produces one Error for 1040.FS', () => {
    const fields: any[] = []; // empty return
    const diags = runDiagnostics(fields);
    const fsErrors = diags.filter(d => d.fieldId === '1040.FS' && d.severity === 'error');
    expect(fsErrors.length).toBe(1);
  });

  test('negative wages returns Error for WagesAmt', () => {
    const fields = [{ fieldId: 'WagesAmt', formId: 'W2', value: -1000 }];
    const diags = runDiagnostics(fields);
    const wageErrors = diags.filter(d => d.fieldId === 'WagesAmt' && d.severity === 'error');
    expect(wageErrors.length).toBeGreaterThan(0);
    expect(wageErrors[0].message).toBe('Value must be positive');
  });
});
