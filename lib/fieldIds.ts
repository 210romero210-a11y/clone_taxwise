// Utility functions for mapping/normalizing field identifier namespaces

export function toDotKey(fieldId: string) {
  if (!fieldId) return fieldId;
  // If it's already dot-style, return as-is
  if (fieldId.includes('.')) return fieldId;
  // Replace ':' and '_' with '.' as a best-effort mapping
  return fieldId.replace(/[:_]+/g, '.');
}

export function toUnderscoreKey(fieldId: string) {
  if (!fieldId) return fieldId;
  if (fieldId.includes('_')) return fieldId;
  return fieldId.replace(/[.:]+/g, '_');
}

export function toColonKey(formId: string, fieldId: string) {
  if (!formId) return fieldId;
  // Prefer explicit "form:field" shape if not already present
  if (fieldId.includes(':')) return fieldId;
  return `${formId}:${fieldId}`;
}

export function canonicalDot(fieldId: string) {
  if (!fieldId) return fieldId;
  return toDotKey(fieldId).replace(/\.+/g, '.');
}

export function canonicalUnderscore(fieldId: string) {
  if (!fieldId) return fieldId;
  return toUnderscoreKey(fieldId).replace(/_+/g, '_');
}

export function parseDotKey(dotKey: string) {
  // Returns { formId, fieldId } where formId may be '' if no dot present
  if (!dotKey) return { formId: '', fieldId: '' };
  const normalized = canonicalDot(dotKey);
  const idx = normalized.indexOf('.');
  if (idx === -1) {
    return { formId: '', fieldId: normalized };
  }
  const formId = normalized.slice(0, idx);
  const fieldId = normalized.slice(idx + 1);
  return { formId, fieldId };
}

export default {
  toDotKey,
  toUnderscoreKey,
  toColonKey,
  canonicalDot,
  canonicalUnderscore,
  parseDotKey,
};
