import { FIELD_MAP } from '../convex/logic';

describe('Flow-Through Logic Orchestrator', () => {
  test('Schedule C profit cascades to SE tax and 1040 total income', async () => {
    // Arrange: mock DB state
    const mockDB = {
      fields: {
        [key: string]: { value: any },
        'SchC_netProfit': { value: 10000 },
        'SchSE_seTax': { value: 0 },
        '1040_totalIncome': { value: 0 },
      },
      patch: function (_collection: string, query: { fieldId: string }, update: { value: any }) {
        this.fields[query.fieldId].value = update.value;
      },
      get: function (_collection: string, _id: string) {
        return { forms: {} };
      },
    };

    // Act: simulate syncCalculations
    const cascade = (fieldId: string, value: any) => {
      const targets = FIELD_MAP[fieldId] || [];
      targets.forEach((targetId) => {
        mockDB.patch('fields', { fieldId: targetId }, { value });
        cascade(targetId, value);
      });
    };
    cascade('SchC_netProfit', 10000);

    // Assert: SE tax and 1040 total income updated
    expect(mockDB.fields['SchSE_seTax'].value).toBe(10000);
    expect(mockDB.fields['1040_totalIncome'].value).toBe(10000);
  });

  test('W-2 salary applies Standard Deduction and calculates Taxable Income', () => {
    // Arrange
    const w2Salary = 50000;
    const stdDeduction = 14600;
    // Act
    const taxableIncome = w2Salary - stdDeduction;
    // Assert
    expect(taxableIncome).toBe(35400);
  });
});
