import { buildCalculatedPatches } from '../convex/internalFunctions';

describe('recalculation: override handling', () => {
  test('overridden fields are skipped when building patches', () => {
    const existingFields = [
      { _id: 'f1', formId: '1040', fieldId: 'calc1', value: 100, overridden: true },
      { _id: 'f2', formId: '1040', fieldId: 'calc2', value: 50, overridden: false }
    ];
    const updatedFields = [
      { formId: '1040', fieldId: 'calc1', value: 200 },
      { formId: '1040', fieldId: 'calc2', value: 60 }
    ];

    const patches = buildCalculatedPatches(existingFields, updatedFields);

    expect(patches.find(p => p._id === 'f1')).toBeUndefined();
    const p2 = patches.find(p => p._id === 'f2');
    expect(p2).toBeDefined();
    expect(p2?.patch.value).toBe(60);
  });
});
