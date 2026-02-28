# TaxWise Clone: Metadata-Driven Form Engine Implementation Plan

## Executive Summary

This plan implements a **Metadata-Driven Form Engine** that replaces hard-coded form logic with a flexible, JSON-schema-based system supporting Individual (1040), Business (1065/1120S), and Specialty (990/706/709) tax entities. The architecture builds on existing Convex infrastructure while introducing entity-specific lifecycle handlers and K-1 pass-through syncing.

---

## 1. Alignment with Existing Architecture

### 1.1 What Already Exists

| Component | Location | Purpose |
|-----------|----------|---------|
| `fields` table | [`convex/schema.ts:71-86`](convex/schema.ts:71) | Flat field storage with `byComposite` index (returnId, formId, fieldId) |
| `returns` table | [`convex/schema.ts:88-104`](convex/schema.ts:88) | Return document with forms, events, status |
| `FIELD_MAP` | [`convex/logic.ts:12-18`](convex/logic.ts:12) | Underscore keys for cascading updates |
| `DEPENDENCY_GRAPH` | [`lib/engine.ts:29-33`](lib/engine.ts:29) | Dot keys for field dependencies |
| Bilingual i18n | [`lib/i18n/diagnosticTranslations.ts`](lib/i18n/diagnosticTranslations.ts) | English/Spanish diagnostic messages |
| `overridden` flag | [`convex/schema.ts:79`](convex/schema.ts:79) | F5 toggle support for user-locked fields |

### 1.2 Key Architectural Principles (Preserved)

- **Two Field-ID Namespaces**: [`convex/logic.ts`](convex/logic.ts) uses underscore keys (`"SchC_netProfit"`); [`lib/engine.ts`](lib/engine.ts) uses dot keys (`"SchC.netProfit"`)
- **Fields Table as Source of Truth**: Query via `byComposite` index—never scan full table
- **`overridden` Flag Must Be Honored**: Server-side recalculation skips user-locked fields
- **Internal Functions Are Plain Async**: [`convex/internalFunctions.ts`](convex/internalFunctions.ts) exports are testable without Convex runtime

---

## 2. New Schema Extensions

### 2.1 `formDefinitions` Table (Metadata Store)

Add to [`convex/schema.ts`](convex/schema.ts):

```typescript
// Tax field definition within a form
export interface TaxFieldDefinition {
  fieldId: string;           // e.g., "line1z"
  label: string;             // e.g., "Wages, salaries, tips"
  labelEs?: string;          // Spanish label
  type: "currency" | "number" | "text" | "boolean" | "date";
  isCalculated: boolean;     // If true, becomes a "Blue Field"
  formula?: string;         // Logic for engine (e.g., "sum(1a:1h)")
  isRequired: boolean;      // Triggers "Red Exclamation" if empty
  irsLineReference?: string; // For "Visual Line Guide" PDF overlay
  category: "income" | "deduction" | "credit" | "info";
  validationRules?: string[]; // References to rule IDs
}

// Form section grouping
export interface TaxFormSection {
  sectionTitle: string;
  sectionTitleEs?: string;
  fields: TaxFieldDefinition[];
}

// Top-level form definition
export interface TaxFormDefinition {
  formCode: string;          // e.g., "1040", "1120S", "990"
  year: number;             // Tax year (2025, 2026, etc.)
  entityType: "Individual" | "Business" | "Specialty";
  formTitle: string;        // e.g., "U.S. Individual Income Tax Return"
  formTitleEs?: string;     // Spanish title
  sections: TaxFormSection[];
  validationRules: TaxValidationRule[];
  dependencies?: Record<string, string[]>; // Field-level dependencies (dot keys)
}

// Validation rule definition
export interface TaxValidationRule {
  ruleId: string;
  errorMessageEn: string;
  errorMessageEs: string;
  severity: "error" | "warning";
  condition?: string;       // JSON-encoded condition expression
}
```

**Convex Table Definition:**

```typescript
formDefinitions: defineTable({
  formCode: v.string(),
  year: v.number(),
  entityType: v.string(),
  formTitle: v.string(),
  formTitleEs: v.optional(v.string()),
  sections: v.any(),        // TaxFormSection[]
  validationRules: v.any(), // TaxValidationRule[]
  dependencies: v.optional(v.any()),
  createdAt: v.optional(v.number()),
  updatedAt: v.optional(v.number()),
})
  .index("byFormCode", ["formCode", "year"])
  .index("byEntityType", ["entityType", "year"]),
```

### 2.2 Extended `returns` Table

Add entity-specific fields to existing [`returns`](convex/schema.ts:88) table:

```typescript
returns: defineTable({
  // ... existing fields ...
  
  // NEW: Entity type for lifecycle routing
  entityType: v.optional(v.string()), // "Individual" | "Business" | "Specialty"
  
  // NEW: Extended lifecycle status
  status: v.optional(v.string()),     // "Draft" | "Review" | "Ready" | "Transmitted" | "Accepted" | "Rejected"
  
  // NEW: Language preference for diagnostics
  language: v.optional(v.string()),   // "en" | "es"
  
  // NEW: Business-specific: partner/owner links
  partners: v.optional(v.any()),     // Array of { partnerId, ownershipPercent, k1Generated }
  
  // NEW: Parent return for K-1 recipients ( Individual receiving K-1 )
  k1Sources: v.optional(v.any()),     // Array of { sourceReturnId, partnerId }
}),
```

### 2.3 `k1Mappings` Table (K-1 Pass-Through Bridge)

```typescript
k1Mappings: defineTable({
  sourceReturnId: v.string(),    // The 1065/1120S return generating K-1
  sourceFormCode: v.string(),   // "1065" or "1120S"
  partnerReturnId: v.string(),  // The Individual 1040 return receiving K-1
  partnerId: v.string(),        // Partner/owner identifier
  taxYear: v.number(),
  syncStatus: v.string(),        // "pending" | "synced" | "error"
  syncedAt: v.optional(v.number()),
  k1Data: v.any(),              // The actual K-1 field values
  createdAt: v.optional(v.number()),
})
  .index("bySourceReturn", ["sourceReturnId"])
  .index("byPartnerReturn", ["partnerReturnId"]),
```

---

## 3. Entity-Specific Logic Handlers

### 3.1 Individual Entity Handler (`lib/entityHandlers/individual.ts`)

**Responsibilities:**
- Route 1040/SR/NR calculations through [`lib/engine.ts`](lib/engine.ts)
- Manage Schedule A-D dependencies (see [`lib/engine.ts:44`](lib/engine.ts:44) for deduction logic)
- Handle W2/1099 aggregation to 1040 Line 1z
- Sync SchC net profit to 1040 Schedule 1

**Key Functions:**

```typescript
// Initialize Individual return with default forms
export async function initializeIndividualReturn(
  db: any,
  returnId: string,
  taxpayerId: string,
  year: number
): Promise<void>;

// Run Individual-specific validation
export function validateIndividualReturn(
  fields: FieldDoc[],
  formDefinition: TaxFormDefinition
): Diagnostic[];
```

### 3.2 Business Entity Handler (`lib/entityHandlers/business.ts`)

**Responsibilities:**
- Calculate balance sheet totals (Assets = Liabilities + Equity)
- Generate Schedule K-1 for each partner
- Handle 1065 (Partnership) vs 1120S (S-Corporation) distinctions
- Compute distributive share based on ownership percentage

**Key Functions:**

```typescript
// Generate K-1 data for all partners
export async function generateK1Data(
  db: any,
  returnId: string,
  formDefinition: TaxFormDefinition
): Promise<K1Data[]>;

// Calculate distributive share per partner
export function calculateDistributiveShare(
  partnershipIncome: number,
  ownershipPercent: number,
  entityType: "1065" | "1120S"
): number;
```

### 3.3 Specialty Entity Handler (`lib/entityHandlers/specialty.ts`)

**Responsibilities:**
- 990: Validate public support test (>$35,000 threshold)
- 706: Handle step-up in basis calculations
- 709: Compute gift tax exclusion and generation-skipping transfers

**Key Functions:**

```typescript
// Validate 990 public support test
export function validate990PublicSupport(
  totalContributions: number,
  totalSupport: number
): Diagnostic;

// Validate 706/709 threshold calculations
export function validateEstateGiftThresholds(
  totalTransfers: number,
  year: number
): Diagnostic[];
```

### 3.4 Entity Router (`lib/entityHandlers/index.ts`)

```typescript
import { individual } from "./individual";
import { business } from "./business";
import { specialty } from "./specialty";

export type EntityHandler = {
  initialize: (db: any, returnId: string, taxpayerId: string, year: number) => Promise<void>;
  validate: (fields: any[], formDef: any) => Diagnostic[];
  calculate: (returnData: ReturnData) => CalculationResult;
  getK1Handler?: (db: any, returnId: string) => Promise<K1Data[]>;
};

export const ENTITY_HANDLERS: Record<string, EntityHandler> = {
  Individual: individual,
  Business: business,
  Specialty: specialty,
};

export function getEntityHandler(entityType: string): EntityHandler {
  return ENTITY_HANDLERS[entityType] || individual;
}
```

---

## 4. K-1 Pass-Through Syncing

### 4.1 Sync Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  1065 Return    │    │  K1Mappings     │    │  1040 Return    │
│  (Business)     │───▶│  Table          │───▶│  (Individual)   │
│                 │    │                 │    │                 │
│ Partner A: 40%  │    │ sourceReturnId  │    │ SchE (K-1)       │
│ Partner B: 60% │    │ partnerReturnId │    │ Line 1           │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 4.2 Sync Implementation (`convex/k1Sync.ts`)

```typescript
import { internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { generateK1Data } from "../lib/entityHandlers/business";
import { getDiagnosticMessage } from "../lib/i18n/diagnosticTranslations";

// Trigger K-1 sync when business return reaches "Accepted" status
export const triggerK1Sync = internalAction({
  args: {
    sourceReturnId: v.string(),
  },
  handler: async ({ db }, args) => {
    // 1. Fetch the business return
    const returnDoc = await db.query("returns")
      .withIndex("byReturnId", (q: any) => q.eq("returnId", args.sourceReturnId))
      .first();
    
    if (!returnDoc || returnDoc.entityType !== "Business") {
      throw new Error("Invalid source return for K-1 sync");
    }
    
    // 2. Generate K-1 data for all partners
    const k1DataList = await generateK1Data(db, args.sourceReturnId, null);
    
    // 3. For each partner, create/update K-1 mapping
    for (const k1Data of k1DataList) {
      const partnerReturnId = k1Data.partnerReturnId;
      
      // Create mapping record
      await db.insert("k1Mappings", {
        sourceReturnId: args.sourceReturnId,
        sourceFormCode: returnDoc.forms?.["1065"] ? "1065" : "1120S",
        partnerReturnId,
        partnerId: k1Data.partnerId,
        taxYear: returnDoc.year,
        syncStatus: "pending",
        k1Data: k1Data.fields,
        createdAt: Date.now(),
      });
      
      // 4. Apply K-1 fields to partner's return
      for (const field of k1Data.fields) {
        const fieldDoc = await db.query("fields")
          .withIndex("byComposite", (q: any) =>
            q.eq("returnId", partnerReturnId)
             .eq("formId", field.formId)
             .eq("fieldId", field.fieldId)
          )
          .first();
        
        if (fieldDoc) {
          await db.patch("fields", fieldDoc._id, {
            value: field.value,
            calculated: true,
            updatedAt: Date.now(),
          });
        }
      }
      
      // 5. Record audit trail with "k1_sync" trigger source
      await db.insert("audit", {
        returnId: partnerReturnId,
        formId: "SchE",
        action: "K1_SYNC",
        triggerSource: "calculation",
        newValue: JSON.stringify(k1Data.fields),
        createdAt: Date.now(),
      });
    }
    
    return { synced: k1DataList.length };
  },
});
```

### 4.3 Audit Trail Integration

The Timeline component ([`components/TimelineViewer.tsx`](components/TimelineViewer.tsx)) must display K-1 sync events:

```typescript
// In timeline query, filter for K1_SYNC action
const k1SyncEvents = auditEntries.filter(
  (entry) => entry.action === "K1_SYNC"
);
```

---

## 5. Dynamic Form Renderer

### 5.1 Metadata-Driven Component (`components/DynamicFormRenderer.tsx`)

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TaxInput } from "./TaxInput";
import { useReturn } from "@/contexts/ReturnContext";

interface DynamicFormRendererProps {
  formCode: string;
  year: number;
}

export function DynamicFormRenderer({ formCode, year }: DynamicFormRendererProps) {
  // Fetch form definition metadata
  const formDefinition = useQuery(api.formDefinitions.getByFormCode, {
    formCode,
    year,
  });
  
  // Fetch existing field values
  const returnContext = useReturn();
  const fields = useQuery(api.fields.getByReturnAndForm, {
    returnId: returnContext.returnId,
    formId: formCode,
  });
  
  if (!formDefinition) return null;
  
  return (
    <div className="form-renderer">
      {formDefinition.sections.map((section) => (
        <section key={section.sectionTitle} className="form-section">
          <h3>{section.sectionTitle}</h3>
          {section.fields.map((fieldDef) => (
            <TaxInput
              key={fieldDef.fieldId}
              fieldId={fieldDef.fieldId}
              formId={formCode}
              label={fieldDef.label}
              type={fieldDef.type}
              value={fields?.[fieldDef.fieldId]?.value}
              calculated={fieldDef.isCalculated}
              required={fieldDef.isRequired}
              irsLineReference={fieldDef.irsLineReference}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
```

### 5.2 Convex Queries for Form Definitions

Add to [`convex/formDefinitions.ts`](convex/formDefinitions.ts) (new file):

```typescript
import { query } from "./_generated/server";
import { v } from "convex/values";

// Get form definition by formCode and year
export const getByFormCode = query({
  args: {
    formCode: v.string(),
    year: v.number(),
  },
  handler: async ({ db }, args) => {
    return await db.query("formDefinitions")
      .withIndex("byFormCode", (q: any) => 
        q.eq("formCode", args.formCode).eq("year", args.year)
      )
      .first();
  },
});

// List all forms for a given year and entity type
export const listByEntityType = query({
  args: {
    entityType: v.string(),
    year: v.number(),
  },
  handler: async ({ db }, args) => {
    return await db.query("formDefinitions")
      .withIndex("byEntityType", (q: any) =>
        q.eq("entityType", args.entityType).eq("year", args.year)
      )
      .collect();
  },
});
```

---

## 6. Lifecycle Status Management

### 6.1 Status Transitions

```
Draft → Review → Ready → Transmitted → Accepted
                        ↘︎ Rejected
```

### 6.2 Status Query and Mutation

Extend [`convex/returns.ts`](convex/returns.ts):

```typescript
export const updateReturnStatus = mutation({
  args: {
    returnId: v.string(),
    newStatus: v.union(
      v.literal("Draft"),
      v.literal("Review"),
      v.literal("Ready"),
      v.literal("Transmitted"),
      v.literal("Accepted"),
      v.literal("Rejected")
    ),
  },
  handler: async ({ db, auth }, args) => {
    const user = await auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");
    
    const returnDoc = await db.query("returns")
      .withIndex("byReturnId", (q: any) => q.eq("returnId", args.returnId))
      .first();
    
    if (!returnDoc) throw new Error("Return not found");
    
    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      "Draft": ["Review"],
      "Review": ["Ready", "Draft"],
      "Ready": ["Transmitted", "Review"],
      "Transmitted": ["Accepted", "Rejected"],
      "Accepted": [],
      "Rejected": ["Review"],
    };
    
    const allowed = validTransitions[returnDoc.status || "Draft"];
    if (!allowed.includes(args.newStatus)) {
      throw new Error(`Invalid status transition from ${returnDoc.status} to ${args.newStatus}`);
    }
    
    // If transitioning to "Transmitted", trigger K-1 sync for business entities
    if (args.newStatus === "Transmitted" && returnDoc.entityType === "Business") {
      // This will be handled by the filing flow
    }
    
    await db.patch("returns", returnDoc._id, {
      status: args.newStatus,
      updatedAt: Date.now(),
    });
    
    return { success: true, previousStatus: returnDoc.status, newStatus: args.newStatus };
  },
});
```

---

## 7. Form Definition Seed Data

### 7.1 Sample 1040 Definition (2025)

```typescript
// In scripts/seed/2025/forms.ts
export const form1040_2025: TaxFormDefinition = {
  formCode: "1040",
  year: 2025,
  entityType: "Individual",
  formTitle: "U.S. Individual Income Tax Return",
  formTitleEs: "Declaración de Impuestos sobre el Ingreso Individual",
  sections: [
    {
      sectionTitle: "Filing Status",
      fields: [
        { fieldId: "filingStatus", type: "text", isRequired: true, category: "info" },
        { fieldId: "firstName", type: "text", isRequired: true, category: "info" },
        { fieldId: "lastName", type: "text", isRequired: true, category: "info" },
        { fieldId: "ssn", type: "text", isRequired: true, category: "info" },
      ],
    },
    {
      sectionTitle: "Income",
      fields: [
        { fieldId: "line1z", label: "Wages, salaries, tips", type: "currency", isCalculated: true, category: "income" },
        { fieldId: "line2a", label: "Tax-exempt interest", type: "currency", category: "income" },
        { fieldId: "line3a", label: "Tax-exempt dividends", type: "currency", category: "income" },
        { fieldId: "line5", label: "IRA distributions", type: "currency", category: "income" },
        { fieldId: "line7", label: "Business income (Sch C)", type: "currency", category: "income" },
      ],
    },
    // ... more sections
  ],
  validationRules: [
    { ruleId: "SSN_REQUIRED", errorMessageEn: "SSN is required", errorMessageEs: "El SSN es requerido", severity: "error" },
    { ruleId: "FILING_STATUS_REQUIRED", errorMessageEn: "Filing status is required", errorMessageEs: "El estado civil es requerido", severity: "error" },
  ],
  dependencies: {
    "line1z": ["W2.box1"],
    "line3": ["SchC.netProfit"],
  },
};
```

---

## 8. Implementation Phases

### Phase 1: Schema Extensions (Week 1)

- [ ] Add `formDefinitions` table to [`convex/schema.ts`](convex/schema.ts)
- [ ] Add entityType, status, language, partners, k1Sources to `returns` table
- [ ] Add `k1Mappings` table
- [ ] Run `convex dev` to regenerate types

### Phase 2: Form Definition CRUD (Week 1-2)

- [ ] Create [`convex/formDefinitions.ts`](convex/formDefinitions.ts) with queries
- [ ] Create seed script for 1040, 1065, 1120S, 990 definitions
- [ ] Add helper to fetch form metadata in components

### Phase 3: Entity Handlers (Week 2-3)

- [ ] Create `lib/entityHandlers/` directory
- [ ] Implement Individual handler with Schedule dependencies
- [ ] Implement Business handler with K-1 generation
- [ ] Implement Specialty handler with checklist validation

### Phase 4: Dynamic Renderer (Week 3-4)

- [ ] Create [`components/DynamicFormRenderer.tsx`](components/DynamicFormRenderer.tsx)
- [ ] Update [`components/FormTree.tsx`](components/FormTree.tsx) to use metadata
- [ ] Add Visual Line Guide support using `irsLineReference`

### Phase 5: K-1 Sync (Week 4-5)

- [ ] Implement [`convex/k1Sync.ts`](convex/k1Sync.ts) action
- [ ] Add K-1 sync trigger on business return acceptance
- [ ] Update Timeline viewer to show sync events

### Phase 6: Lifecycle & Diagnostics (Week 5-6)

- [ ] Implement status transition validation
- [ ] Integrate entity-specific validation rules
- [ ] Add bilingual diagnostic messages

---

## 9. Key Files to Modify

| File | Change Type |
|------|-------------|
| [`convex/schema.ts`](convex/schema.ts) | Extend tables |
| [`convex/formDefinitions.ts`](convex/formDefinitions.ts) | **NEW** - CRUD for form metadata |
| [`convex/k1Sync.ts`](convex/k1Sync.ts) | **NEW** - K-1 sync logic |
| [`lib/entityHandlers/index.ts`](lib/entityHandlers/index.ts) | **NEW** - Entity router |
| [`lib/entityHandlers/individual.ts`](lib/entityHandlers/individual.ts) | **NEW** - Individual logic |
| [`lib/entityHandlers/business.ts`](lib/entityHandlers/business.ts) | **NEW** - Business logic |
| [`lib/entityHandlers/specialty.ts`](lib/entityHandlers/specialty.ts) | **NEW** - Specialty logic |
| [`components/DynamicFormRenderer.tsx`](components/DynamicFormRenderer.tsx) | **NEW** - Dynamic UI |
| [`convex/returns.ts`](convex/returns.ts) | Add status mutations |
| [`lib/engine.ts`](lib/engine.ts) | Support entity-specific calculations |
| [`lib/fieldIds.ts`](lib/fieldIds.ts) | May need new canonicalization helpers |

---

## 10. Testing Strategy

- **Unit Tests**: Entity handlers in `tests/entityHandlers/`
- **Integration Tests**: K-1 sync flow in `tests/k1Sync.test.ts`
- **E2E Tests**: Full lifecycle in `tests/EndToEndReturn.test.ts`
- **Regression Tests**: Existing calculations in `tests/calculations.test.ts`

---

## 11. Backward Compatibility

This implementation is **additive only**. Existing:

- Field schema (`fields` table) remains unchanged
- Returns table gains optional fields—no breaking changes
- `updateField` mutation continues to work as before
- `FIELD_MAP` and `DEPENDENCY_GRAPH` are preserved

---

## 12. References

- IRS Forms: https://www.irs.gov/forms-instructions
- Publication 1345 (Audit Trail): Required for "flight recorder" compliance
- Publication 1075 (Security): PII encryption requirements
- MeF Architecture: [`lib/mef/mefGenerator.ts`](lib/mef/mefGenerator.ts)
