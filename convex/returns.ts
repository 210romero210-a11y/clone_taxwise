import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { calculateFederalTax } from "../lib/engine";
import { runFlowThrough, applyFieldUpdate, safePatch } from "./internalFunctions";

// Public query: get a single return by ID
export const getReturn = query({
  args: { returnId: v.string() },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");
    const returnDoc = await db
      .query("returns")
      .withIndex("byReturnId", (q) => q.eq("returnId", args.returnId))
      .first();
    if (!returnDoc) return null;
    // Verify user owns this return
    if (returnDoc.taxpayerId && returnDoc.taxpayerId !== user.subject) {
      throw new Error("Unauthorized");
    }
    return returnDoc;
  },
});

// Public query: get running totals aggregate for sub-100ms Refund Monitor
export const getAggregate = query({
  args: { returnId: v.string() },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");
    const returnDoc = await db
      .query("returns")
      .withIndex("byReturnId", (q) => q.eq("returnId", args.returnId))
      .first();
    if (!returnDoc) return null;
    // Return cached aggregate if available, otherwise compute from return
    const aggregate = await db
      .query("aggregates")
      .withIndex("byReturnId", (q) => q.eq("returnId", args.returnId))
      .first();
    if (aggregate) return aggregate;
    // Fallback: return basic totals from return doc
    return {
      returnId: args.returnId,
      refund: returnDoc.refund ?? 0,
      taxLiability: returnDoc.taxLiability ?? 0,
      lastUpdated: Date.now(),
    };
  },
});

// Public query: list all returns (with forms and fields) for the authenticated user
export const listUserReturns = query({
  args: {},
  handler: async ({ db, auth }) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");
    // Find all returns for this user
    const returns = await db
      .query("returns")
      .withIndex("byTaxpayerId", (q) => q.eq("taxpayerId", user.subject))
      .collect();
    // For each return, fetch forms and fields
    const results = [];
    for (const ret of returns) {
      // If forms are embedded, just return them
      if (ret.forms && typeof ret.forms === "object" && !Array.isArray(ret.forms)) {
        results.push({ ...ret, forms: ret.forms });
        continue;
      }
      // Otherwise, fetch forms and fields from collections (if you use separate tables)
      // (This is a placeholder for future expansion)
      results.push({ ...ret });
    }
    return results;
  },
});
export const updateField = mutation(
  {
    args: {
      returnId: v.string(),
      formId: v.string(),
      fieldId: v.string(),
      value: v.any(),
      lastModifiedBy: v.string(),
      // Optional metadata for override/estimated flags
      meta: v.optional(v.any()),
      // Optional session context / client IP
      sessionId: v.optional(v.string()),
      ipAddress: v.optional(v.string()),
    },
    handler: async ({ db, auth }, args) => {
      const { returnId, formId, fieldId, value, lastModifiedBy, meta, sessionId, ipAddress } = args as any;
      // Access control: only allow if user is authenticated
      const user = await auth.getUserIdentity();
      if (!user) throw new Error("Unauthorized");

      // Session validation: require an active server-side session with MFA verified and recent activity
      const sessions = await db.query('sessions').withIndex('byUserId', (q: any) => q.eq('userId', user.subject)).collect();
      const now = Date.now();
      const active = (sessions || []).find((s: any) => s.mfaVerified && (s.lastActivity || s.createdAt || 0) > now - 30 * 60 * 1000 && (!sessionId || s.sessionId === sessionId));
      if (!active) throw new Error('Active MFA-verified session required');

      // Compose actor object for audit
      const actor = { userId: user.subject, name: lastModifiedBy || user.subject, sessionId: active.sessionId, ipAddress };

      // Use server-side helper to apply the field update and record audit
      await applyFieldUpdate(db, actor, returnId, formId, fieldId, value, meta);

      // Trigger recalculation; server-side logic will skip fields with overridden=true
      await recalculateReturnLogic(db, returnId);
    }
  }
);

export const recalculateReturn = mutation(
  {
    args: { returnId: v.string() },
    handler: async ({ db }, args) => {
      await recalculateReturnLogic(db, args.returnId);
    }
    }
);

export const setReturnLock = mutation({
  args: { returnId: v.string(), locked: v.boolean() },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error('Unauthorized');
    const ret = await db.query('returns').withIndex('byReturnId', (q: any) => q.eq('returnId', args.returnId)).first();
    if (!ret) throw new Error('Return not found');
    await db.patch('returns', ret._id, { isLocked: !!args.locked, lockedAt: args.locked ? Date.now() : null, lockedBy: user.subject });
    return { ok: true };
  }
});

// Shared recalculation logic
async function recalculateReturnLogic(db: { query: Function; patch: Function }, returnId: string) {
  // Find the return document by returnId using index
  const returnDoc = await db.query("returns")
    .withIndex("byReturnId", (q: any) => q.eq("returnId", returnId))
    .first();
  if (!returnDoc) throw new Error("Return not found");

  const forms: Record<string, Record<string, any>> = {};
  for (const formId of Object.keys(returnDoc.forms || {})) {
    forms[formId] = {};
    for (const fieldId of Object.keys(returnDoc.forms[formId].fields || {})) {
      forms[formId][fieldId] = returnDoc.forms[formId].fields[fieldId];
    }
  }

  const result = calculateFederalTax({ year: returnDoc.year, forms });

  for (const field of result.updatedFields) {
    // Find the field document by composite keys using index
    const fieldDoc = await db.query("fields")
      .withIndex("byComposite", (q: any) =>
        q.eq("returnId", returnId)
         .eq("formId", field.formId)
         .eq("fieldId", field.fieldId)
      )
      .first();
    if (fieldDoc) {
      // Skip fields the user has explicitly overridden in the UI
      if (fieldDoc.overridden) {
        continue;
      }
      await safePatch(db, 'fields', fieldDoc._id, {
        value: field.value,
        calculated: true,
        updatedAt: Date.now()
      });
    }
  }

  await safePatch(db, 'returns', returnDoc._id, {
    refund: result.refund,
    taxLiability: result.taxLiability,
    diagnostics: result.diagnostics
  });
}