import { canonicalDot, parseDotKey } from '../lib/fieldIds';

describe('fieldIds canonicalization helpers', () => {
  test('canonicalDot normalizes underscore and colon to dot', () => {
    expect(canonicalDot('1040_FS')).toBe('1040.FS');
    expect(canonicalDot('1040:FS')).toBe('1040.FS');
    expect(canonicalDot('SchC_netProfit')).toBe('SchC.netProfit');
    expect(canonicalDot('SchC.netProfit')).toBe('SchC.netProfit');
  });

  test('parseDotKey splits form and field', () => {
    expect(parseDotKey('1040.FS')).toEqual({ formId: '1040', fieldId: 'FS' });
    expect(parseDotKey('SchC.netProfit')).toEqual({ formId: 'SchC', fieldId: 'netProfit' });
    expect(parseDotKey('justAField')).toEqual({ formId: '', fieldId: 'justAField' });
  });
});
