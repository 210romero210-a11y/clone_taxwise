// Convex schema (minimal, flexible shapes to iterate quickly)
// This file defines document shapes for Returns, Forms, Fields, and Events.
// Keep IDs and field keys permissive to speed development.

export type FieldValue = string | number | boolean | null | Record<string, any> | any[];

export interface FieldDoc {
  _id?: string;
  fieldId: string; // e.g. "1040:8" or arbitrary developer key
  label?: string;
  type?: string; // e.g. "currency", "number", "text", "date"
  value?: FieldValue;
  calculated?: boolean; // true when derived by engine
  overridden?: boolean; // true when user overrides calculated
  updatedAt?: number;
}

export interface FormDoc {
  _id?: string;
  formId: string; // e.g. "1040", "ScheduleC"
  name?: string;
  // map of fieldId -> FieldDoc (keep map shape to allow dynamic field keys)
  fields?: Record<string, FieldDoc>;
  createdAt?: number;
  updatedAt?: number;
}

export interface ReturnDoc {
  _id?: string;
  returnId: string; // internal return identifier
  taxpayerId?: string;
  year: number;
  forms?: Record<string, FormDoc> | string[]; // either embedded forms or list of form ids
  events?: any[]; // append-only event stream for reactive flow
  createdAt?: number;
  updatedAt?: number;
}

export interface EventDoc {
  _id?: string;
  returnId: string;
  type: string; // e.g. "field:update", "calculation:run"
  payload?: any;
  createdAt?: number;
}

// Collection names used by Convex functions and client code.
export const Collections = {
  Returns: "returns",
  Forms: "forms",
  Fields: "fields",
  Events: "events",
};

// Notes for developers:
// - Use internal Convex functions to perform flow-through calculations.
// - Store authoritative values on `FieldDoc.value`. Use `calculated` and `overridden`
//   flags to indicate provenance. When a user presses F5, set `overridden=true`.
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  numbers: defineTable({
    value: v.number(),
  }),
  fields: defineTable({
    fieldId: v.string(),
    formId: v.string(),
    returnId: v.string(),
    label: v.optional(v.string()),
    type: v.optional(v.string()),
    value: v.optional(v.any()),
    calculated: v.optional(v.boolean()),
    overridden: v.optional(v.boolean()),
    updatedAt: v.optional(v.number()),
    lastModifiedBy: v.optional(v.string()),
  })
    .index("byFieldId", ["fieldId"])
    .index("byFormId", ["formId"])
    .index("byReturnId", ["returnId"])
    .index("byComposite", ["returnId", "formId", "fieldId"]),
    
  returns: defineTable({
    returnId: v.string(),
    taxpayerId: v.optional(v.string()),
    year: v.number(),
    forms: v.optional(v.any()),
    events: v.optional(v.any()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    refund: v.optional(v.any()),
    taxLiability: v.optional(v.any()),
    diagnostics: v.optional(v.any()),
  })
    .index("byReturnId", ["returnId"]),
});
