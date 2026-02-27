import { mutation } from './_generated/server';
import { v } from 'convex/values';
import { safePatch } from './internalFunctions';

// Import prior-year JSON into the current return's fields. Flexible mapping:
// if priorData contains keys matching form.field or form_field or form:field,
// apply them; also try matching by label.
export const importPriorYearData = mutation({
  args: { returnId: v.string(), priorData: v.any() },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    const { returnId, priorData } = args as any;
    const now = Date.now();

    const fields = await db.query('fields').withIndex('byReturnId', (q: any) => q.eq('returnId', returnId)).collect();

    const updates: any[] = [];
    for (const f of fields) {
      // try keys
      const candidates = [
        `${f.formId}.${f.fieldId}`,
        `${f.formId}_${f.fieldId}`,
        `${f.formId}:${f.fieldId}`,
        String(f.fieldId),
        String(f.label || '')
      ];
      let applied = false;
      for (const c of candidates) {
        if (!c) continue;
        const key = String(c);
        if (priorData[key] !== undefined) {
          const prev = f.value;
          await safePatch(db, 'fields', f._id, { value: priorData[key], updatedAt: now });
          await db.insert('audit', { returnId, formId: f.formId, fieldId: f.fieldId, userId: user.subject, action: 'import:priorYear', previousValue: prev, newValue: priorData[key], createdAt: now });
          updates.push({ _id: f._id, old: prev, new: priorData[key] });
          applied = true;
          break;
        }
      }
      // additional heuristic: if priorData has top-level taxpayer fields
      if (!applied && priorData.taxpayerName && /name/i.test(String(f.fieldId) + String(f.label || ''))) {
        const prev = f.value;
        await safePatch(db, 'fields', f._id, { value: priorData.taxpayerName, updatedAt: now });
        await db.insert('audit', { returnId, formId: f.formId, fieldId: f.fieldId, userId: user.subject, action: 'import:priorYear', previousValue: prev, newValue: priorData.taxpayerName, createdAt: now });
        updates.push({ _id: f._id, old: prev, new: priorData.taxpayerName });
      }
    }

    return { applied: updates.length, details: updates.slice(0, 20) };
  }
});
