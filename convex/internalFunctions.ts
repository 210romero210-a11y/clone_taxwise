/*
  Place Convex internal functions here (server-only). Example exports:

  - runFlowThrough(returnId, event) : applies event-driven calculations
  - applyFieldUpdate(returnId, formId, fieldId, value, meta) : updates field, emits events
*/
import { maybeEncryptValue } from '../lib/encryption';
import { 
  hashEntry, 
  getLatestHash, 
  TriggerSource,
  AUDIT_ACTIONS 
} from '../lib/audit/hashChain';

// Helper to call ctx.db.patch with the explicit table argument when available,
// but fall back to the older two-argument signature used by unit test mocks.
export async function safePatch(db: any, table: string, id: string, patch: any) {
  try {
    return await db.patch(table, id, patch);
  } catch (e) {
    // Fallback for test harnesses or older runtime helpers that expect (id, patch)
    try {
      return await db.patch(id, patch);
    } catch (e2) {
      throw e;
    }
  }
}

export async function runFlowThrough(_returnId: string, _event: any) {
  // placeholder
  return { applied: false, details: 'not implemented' };
}

// Server-side helper to apply a user-driven field update, record an audit entry,
// and return the updated field doc. This is written to be testable with a
// mocked `db` object in Jest (no Convex runtime required for unit tests).
// 
// triggerSource: How the field was updated - "manual" | "ai_extraction" | "import" | "calculation" | "filing"
export async function applyFieldUpdate(
  db: any, 
  actor: { userId: string; name?: string; sessionId?: string; ipAddress?: string },
  returnId: string, 
  formId: string, 
  fieldId: string, 
  value: any, 
  meta?: { 
    isOverride?: boolean; 
    isEstimated?: boolean;
    triggerSource?: TriggerSource;
  }
) {
  // Find the return
  const returnDoc = await db.query('returns').withIndex('byReturnId', (q: any) => q.eq('returnId', returnId)).first();
  if (!returnDoc) throw new Error('Return not found');
  // Enforce locking
  if (returnDoc.isLocked) throw new Error('Return is locked');

  // Find the field document by composite keys
  const fieldDoc = await db.query('fields')
    .withIndex('byComposite', (q: any) => q.eq('returnId', returnId).eq('formId', formId).eq('fieldId', fieldId))
    .first();
  if (!fieldDoc) throw new Error('Field not found');

  const previousValue = fieldDoc.value;
  const timestamp = Date.now();
  const triggerSource = meta?.triggerSource || 'manual';

  // Apply the patch (encrypt PII before storing when applicable)
  const storedValue = maybeEncryptValue(value);
  await safePatch(db, 'fields', fieldDoc._id, {
    value: storedValue,
    lastModifiedBy: actor.name || actor.userId,
    updatedAt: timestamp,
    overridden: meta && typeof meta.isOverride === 'boolean' ? meta.isOverride : fieldDoc.overridden,
    estimated: meta && typeof meta.isEstimated === 'boolean' ? meta.isEstimated : fieldDoc.estimated,
    calculated: false,
  });

  // Get previous hash for chain
  const existingEntries = await db.query('audit')
    .withIndex('byReturnId', (q: any) => q.eq('returnId', returnId))
    .collect();
  const previousHash = await getLatestHash(existingEntries);

  // Compute hash for this entry
  const hashChainEntry = await hashEntry(previousHash, {
    returnId,
    formId,
    fieldId,
    userId: actor.userId,
    action: AUDIT_ACTIONS.FIELD_UPDATE,
    timestamp,
  });

  // Insert audit entry with hash chain
  try {
    const prevStored = maybeEncryptValue(previousValue);
    await db.insert('audit', {
      returnId,
      formId,
      fieldId,
      userId: actor.userId,
      actor: actor.name || '',
      sessionId: actor.sessionId || null,
      ipAddress: actor.ipAddress || null,
      action: AUDIT_ACTIONS.FIELD_UPDATE,
      triggerSource,
      hashChainEntry,
      previousValue: prevStored,
      newValue: storedValue,
      createdAt: timestamp,
    });
  } catch (e) {
    // Don't block the update if audit logging fails, but surface a warning in logs
    // (In production you'd want to handle this differently)
     
    console.warn('Audit insert failed', e);
  }

  // Optionally append an event to the return for an append-only event stream
  try {
    const events = returnDoc.events || [];
    events.push({ type: 'field:update', payload: { formId, fieldId, previousValue, newValue: value }, createdAt: timestamp, actor: actor.userId, triggerSource });
    await safePatch(db, 'returns', returnDoc._id, { events });
  } catch (e) {
    // ignore event append failures for now
  }

  return { updated: true, _id: fieldDoc._id, previousValue, newValue: value };
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
