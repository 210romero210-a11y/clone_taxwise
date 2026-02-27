import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";
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

// Public query wrapper so the client can fetch diagnostics for a return
export const getDiagnosticsForReturn = query({
  args: { returnId: v.id("returns") },
  handler: async ({ db }: any, args: { returnId: Id<"returns"> }) => {
    const { returnId } = args;
    const fields: FieldDoc[] = await db
      .query("fields")
      .withIndex("byComposite", (q: any) => q.eq("returnId", returnId))
      .collect();
    return runDiagnostics(fields);
  },
});
