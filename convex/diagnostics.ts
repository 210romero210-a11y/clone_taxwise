import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { runDiagnostics } from "../lib/validators";
import { FieldDoc } from "./schema";
import { Id } from "./_generated/dataModel";

export const runDiagnosticsForReturn = internalQuery({
  args: { returnId: v.id("returns") },
  handler: async (ctx: any, args: { returnId: Id<"returns"> }) => {
    const { returnId } = args;
    // Load all fields for this return
    const fields: FieldDoc[] = await ctx.db
      .query("fields")
      .withIndex("byComposite", (q: any) => q.eq("returnId", returnId))
      .collect();
    // Run diagnostics
    return runDiagnostics(fields);
  },
});
