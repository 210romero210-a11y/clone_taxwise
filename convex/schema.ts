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
  Filings: "filings",
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
    isLocked: v.optional(v.boolean()),
    lockedAt: v.optional(v.number()),
    lockedBy: v.optional(v.string()),
  })
    .index("byReturnId", ["returnId"])
    .index("byTaxpayerId", ["taxpayerId"]),
  // Audit trail table for WISP / Publication 1345 compliance
  audit: defineTable({
    returnId: v.optional(v.string()),
    formId: v.optional(v.string()),
    fieldId: v.optional(v.string()),
    userId: v.optional(v.string()),
    actor: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    action: v.optional(v.string()),
    // IRS Publication 1345: trigger source for field changes
    triggerSource: v.optional(v.string()), // "manual" | "ai_extraction" | "import" | "calculation" | "filing"
    // Hash chain for tamper evidence (IRS Publication 1345)
    hashChainEntry: v.optional(v.string()), // SHA-256 hash of previous entry
    previousValue: v.optional(v.any()),
    newValue: v.optional(v.any()),
    // 7-year retention support
    createdAt: v.optional(v.number()),
    archivedAt: v.optional(v.number()), // Marked for archival after 7 years
  })
    .index("byReturnId", ["returnId"])
    .index("byUserId", ["userId"])
    .index("byAction", ["action"])
    .index("byCreatedAt", ["createdAt"])
    .index("byReturnIdAndCreatedAt", ["returnId", "createdAt"]),
  // Sessions table for server-side session management and MFA tracking
  // Extended with IRS Publication 1345 compliant fields
  sessions: defineTable({
    sessionId: v.string(),
    userId: v.string(),
    mfaVerified: v.optional(v.boolean()),
    lastActivity: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    // IRS Publication 1345 enhanced fields
    role: v.optional(v.string()), // 'taxpayer' | 'preparer' | 'admin'
    ipAddress: v.optional(v.string()), // Bound IP for session security
    reauthRequired: v.optional(v.boolean()), // 12-hour re-auth for preparers
    reauthAt: v.optional(v.number()), // Timestamp when re-auth is required
    status: v.optional(v.string()), // 'active' | 'expired' | 'reauth_required' | 'terminated'
    tokenHash: v.optional(v.string()), // Hash of session token for validation
  }).index("bySessionId", ["sessionId"]).index("byUserId", ["userId"]),
  // Files table to store generated PDFs (base64) and attachments
  files: defineTable({
    returnId: v.optional(v.string()),
    filename: v.string(),
    mimeType: v.optional(v.string()),
    dataBase64: v.optional(v.string()),
    storageId: v.optional(v.string()),
    metadata: v.optional(v.any()),
    createdAt: v.optional(v.number()),
  }).index("byReturnId", ["returnId"]),
  
  // Aggregates table for running totals (sub-100ms Refund Monitor updates)
  aggregates: defineTable({
    returnId: v.string(),
    totalIncome: v.optional(v.number()),
    totalDeductions: v.optional(v.number()),
    totalPayments: v.optional(v.number()),
    totalCredits: v.optional(v.number()),
    taxLiability: v.optional(v.number()),
    refund: v.optional(v.number()),
    lastUpdated: v.optional(v.number()),
  }).index("byReturnId", ["returnId"]),

  // MeF Filing table for IRS electronic filing
  filings: defineTable({
    filingId: v.string(),
    returnId: v.string(),
    submissionId: v.optional(v.string()),
    taxYear: v.number(),
    // Filing status: pending, prepared, transmitted, accepted, rejected, error
    status: v.string(),
    // Whether this is a test filing (for MeF test environment)
    testMode: v.optional(v.boolean()),
    // IRS Acceptance/Receipt number
    acknowledgmentNumber: v.optional(v.string()),
    // Timestamp when submitted to IRS
    submittedAt: v.optional(v.number()),
    // Timestamp when status last changed
    statusChangedAt: v.optional(v.number()),
    // IRS response message
    irsMessage: v.optional(v.string()),
    // List of errors if rejected (serialized JSON)
    errors: v.optional(v.any()),
    // XML payload sent to IRS
    xmlPayload: v.optional(v.string()),
    // XML response received from IRS
    xmlResponse: v.optional(v.string()),
    // Number of retry attempts
    retryCount: v.optional(v.number()),
    // Created timestamp
    createdAt: v.optional(v.number()),
    // Updated timestamp
    updatedAt: v.optional(v.number()),
  }).index("byFilingId", ["filingId"]).index("byReturnId", ["returnId"]).index("byStatus", ["status"]).index("byCreatedAt", ["createdAt"]),
});
