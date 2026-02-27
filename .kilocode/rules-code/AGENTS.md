# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Critical Coding Rules (Non-Obvious)

### Two Field-ID Namespaces — Never Mix Them

- [`convex/logic.ts`](../../convex/logic.ts) `FIELD_MAP` uses **underscore** keys: `"SchC_netProfit"`, `"1040_totalIncome"`
- [`lib/engine.ts`](../../lib/engine.ts) `DEPENDENCY_GRAPH` uses **dot** keys: `"W2.box1"`, `"SchC.netProfit"`
- Mixing these causes silent cascade failures — the wrong lookup returns `[]` and no error is thrown

### `fields` Table is the Source of Truth — Not `returns.forms`

- Always query fields via `byComposite` index: `(returnId, formId, fieldId)` — never scan the full table
- `returns.forms` shape is ambiguous: `typeof ret.forms` must be checked before iterating (see [`convex/returns.ts:17`](../../convex/returns.ts:17))
- Patching `returns.forms` directly does NOT trigger recalculation — only `updateField` mutation does

### `overridden` Flag Must Be Respected

- Before writing a calculated value to a field, check `fieldDoc.overridden === true`
- If `overridden` is true, skip the write — the user has locked this field via F5
- [`components/FormTree.tsx`](../../components/FormTree.tsx) manages the F5 toggle; [`convex/returns.ts`](../../convex/returns.ts) must honor it server-side

### `convex/internalFunctions.ts` Is NOT Convex-Registered

- Exports are plain `async function` — safe to import in Jest tests without Convex runtime
- Do NOT register these with `internalMutation`/`internalQuery` — they are called directly from mutations

### LLM Updates Require Server-Side Validation

- [`lib/llmClient.ts`](../../lib/llmClient.ts) is a stub — never persist its output directly
- All LLM-suggested field updates must go through Convex internal functions (see [`docs/LLM_SPEC.md`](../../docs/LLM_SPEC.md))

### Tax Math Constants Location

- To update standard deductions: edit `DEFAULT_2025_CONFIG` in [`lib/taxMath.ts`](../../lib/taxMath.ts)
- SE tax rate (`0.153`) and CTC threshold (`200000`) are hardcoded in [`lib/engine.ts`](../../lib/engine.ts) — not in `taxMath.ts`

### Convex-Specific Gotchas

- Never use `filter()` in queries — always define an index and use `withIndex`
- `v.bigint()` is deprecated — use `v.int64()`
- `"use node";` only in action files — never in files that also export queries/mutations
- Never use `ctx.db` inside actions
- `convex/_generated/**` files are auto-generated — never edit them manually
