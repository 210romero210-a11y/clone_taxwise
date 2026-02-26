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
