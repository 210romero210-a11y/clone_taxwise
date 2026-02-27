/*
  Place Convex internal functions here (server-only). Example exports:

  - runFlowThrough(returnId, event) : applies event-driven calculations
  - applyFieldUpdate(returnId, formId, fieldId, value, meta) : updates field, emits events
*/

export async function runFlowThrough(_returnId: string, _event: any) {
  // placeholder
  return { applied: false, details: 'not implemented' };
}

export async function applyFieldUpdate(_returnId: string, _formId: string, _fieldId: string, _value: any, _meta?: any) {
  // placeholder
  return { updated: false, details: 'not implemented' };
}

// Helper: Given existing field documents and a list of updatedFields from the
// calculation engine, return the list of patches that should be applied.
// This function is pure and testable without Convex runtime.
export function buildCalculatedPatches(
  existingFields: Array<Record<string, any>>,
  updatedFields: Array<{ formId: string; fieldId: string; value: any }>
) {
  const patches: Array<{ _id?: string; formId: string; fieldId: string; patch: any }> = [];
  for (const updated of updatedFields) {
    const fieldDoc = existingFields.find(
      (f) => f.formId === updated.formId && f.fieldId === updated.fieldId
    );
    if (!fieldDoc) continue; // nothing to patch if no existing field
    // respect user override
    if (fieldDoc.overridden) continue;
    patches.push({
      _id: fieldDoc._id,
      formId: updated.formId,
      fieldId: updated.fieldId,
      patch: { value: updated.value, calculated: true, updatedAt: Date.now() },
    });
  }
  return patches;
}
