# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Architectural Constraints (Non-Obvious)

### Dual Calculation Pipeline — Not Unified

- Two separate systems handle field propagation and they are NOT connected:
  1. `FIELD_MAP` cascade in [`convex/logic.ts`](../../convex/logic.ts) — propagates raw values, no math, uses underscore keys
  2. `calculateFederalTax` in [`lib/engine.ts`](../../lib/engine.ts) — computes tax math, uses dot keys
- `recalculateReturnLogic` in [`convex/returns.ts`](../../convex/returns.ts) only calls `calculateFederalTax` — `syncCalculations` is never invoked from the main update path

### `fields` Table Architecture: Flat, Not Nested

- Fields are stored flat with `(returnId, formId, fieldId)` composite key — NOT nested inside `returns.forms`
- `returns.forms` is `v.optional(v.any())` — it exists for legacy/embedded use but is NOT the authoritative store
- Any new field logic MUST use the `fields` table with `byComposite` index

### `returns.forms` Shape Is Intentionally Ambiguous

- Typed as `Record<string, FormDoc> | string[]` to support both embedded and reference patterns
- Code that reads `returns.forms` MUST handle both shapes (see [`convex/returns.ts:17`](../../convex/returns.ts:17))
- This is a deliberate "iterate quickly" design decision — not a bug

### Override System: Two-Layer State

- UI layer: React local state in [`components/FormTree.tsx`](../../components/FormTree.tsx) tracks `FieldState` per field key
- DB layer: `FieldDoc.overridden` in Convex `fields` table is the authoritative lock
- F5 keydown updates BOTH layers — if only one is updated, they will drift

### `convex/internalFunctions.ts` Is Intentionally Decoupled from Convex Runtime

- Exports are plain `async function` (not `internalMutation`/`internalQuery`) so they can be unit-tested in Jest without Convex
- This is a deliberate architectural choice — do NOT convert them to Convex-registered functions without also updating tests

### Known Schema Gaps (Pre-existing Technical Debt)

- `returns` table has no `byTaxpayerId` index but [`convex/returns.ts:11`](../../convex/returns.ts:11) queries it — will throw at runtime
- [`components/TaxInput.tsx`](../../components/TaxInput.tsx) imports `lucide-react` and `clsx` which are missing from `package.json`
- [`tests/flowthrough.test.ts`](../../tests/flowthrough.test.ts) has TypeScript errors (index signature syntax in object literal)

### LLM Integration Architecture

- LLM suggestions flow: `lib/llmClient.ts` → Convex internal function validation → `fields` table patch
- LLM must NEVER write directly to the DB — all updates must be validated server-side (security boundary)
- [`lib/llmClient.ts`](../../lib/llmClient.ts) is a stub; wire to OpenAI/Anthropic function-calling API
