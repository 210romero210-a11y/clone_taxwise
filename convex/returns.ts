import { query } from "./_generated/server";
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
// Convex mutation: updateField and trigger recalculateReturn
import { calculateFederalTax } from "../lib/engine";
// No need for internalMutation import
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { runFlowThrough } from "./internalFunctions";

export const updateField = mutation(
  {
    args: {
      returnId: v.string(),
      formId: v.string(),
      fieldId: v.string(),
      value: v.any(),
      lastModifiedBy: v.string(),
    },
    handler: async ({ db, auth }, args) => {
      const { returnId, formId, fieldId, value, lastModifiedBy } = args;
      // Access control: only allow if user is authenticated
      const user = await auth.getUserIdentity();
      if (!user) throw new Error("Unauthorized");
      const timestamp = Date.now();
      // Find the field document by composite keys using index
      const fieldDoc = await db.query("fields")
        .withIndex("byComposite", (q) =>
          q.eq("returnId", returnId)
           .eq("formId", formId)
           .eq("fieldId", fieldId)
        )
        .first();
      if (!fieldDoc) throw new Error("Field not found");
      await db.patch(fieldDoc._id, {
        value,
        lastModifiedBy,
        updatedAt: timestamp
      });
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
      await db.patch(fieldDoc._id, {
        value: field.value,
        updatedAt: Date.now()
      });
    }
  }

  await db.patch(returnDoc._id, {
    refund: result.refund,
    taxLiability: result.taxLiability,
    diagnostics: result.diagnostics
  });
}