// Convex Internal Function: syncCalculations
// Cascading field updates using a flat Field Map for O(1) lookups
// Flexible TypeScript, IRS MeF XML tag alignment

import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";
import { parseDotKey, canonicalDot } from "../lib/fieldIds";


// Example flat field map: maps source field to array of target fields
export const FIELD_MAP: Record<string, string[]> = {
  // canonical dot-style keys (form.field)
  "SchC.Line31": ["Sch1.Line3"],
  "Sch1.Line3": ["1040.Line8"],
  "SchC.netProfit": ["SchSE.seTax", "1040.totalIncome"],
  // Add more as needed, using IRS MeF tags
};

// IRS MeF tag example: WagesAmt instead of salary

export const syncCalculations = internalMutation({
  args: {
    returnId: v.string(),
    updatedFieldId: v.string(),
    value: v.any(),
  },
  handler: async ({ db }, args) => {
    // Fetch return document
    const returnDoc = await db.query("returns")
      .withIndex("byReturnId", (q: any) => q.eq("returnId", args.returnId))
      .first();
    if (!returnDoc) throw new Error("Return not found");

    // Flat lookup for cascading updates. FIELD_MAP uses canonical dot keys (form.field)
    const cascade = async (fieldId: string, value: any) => {
      const canonical = canonicalDot(fieldId);
      const targets = FIELD_MAP[canonical] || [];
      for (const targetId of targets) {
        const parsed = parseDotKey(targetId);
        // Find the field document by composite keys using index
        const fieldDoc = await db.query("fields")
          .withIndex("byComposite", (q: any) =>
            q.eq("returnId", args.returnId)
             .eq("formId", parsed.formId)
             .eq("fieldId", parsed.fieldId)
          )
          .first();
        if (fieldDoc) {
          await db.patch(fieldDoc._id, { value });
        }
        await cascade(targetId, value);
      }
    };

    // Start cascading from updated field (ensure canonical key)
    await cascade(canonicalDot(args.updatedFieldId), args.value);

    // Optionally recalculate totals (e.g., 1040 total income)
    // ...existing code...

    return { success: true };
  }
});
