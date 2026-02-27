# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Debugging Rules (Non-Obvious)

### Silent Cascade Failures

- If a field update doesn't propagate, check which namespace is being used: `FIELD_MAP` (underscore keys in [`convex/logic.ts`](../../convex/logic.ts)) vs `DEPENDENCY_GRAPH` (dot keys in [`lib/engine.ts`](../../lib/engine.ts)) — mixing them causes silent no-ops
- `syncCalculations` in [`convex/logic.ts`](../../convex/logic.ts) passes `formId: ""` (empty string) to `byComposite` index — this will fail to find fields that have a real `formId`

### `overridden` Fields Silently Skip Recalculation

- If a calculated field never updates, check `fieldDoc.overridden` — F5 sets this to `true` and the engine must skip it
- The F5 toggle state is stored in React local state in [`components/FormTree.tsx`](../../components/FormTree.tsx) AND in `FieldDoc.overridden` in Convex — they can drift if the mutation isn't called

### `convex/internalFunctions.ts` Always Returns `{ applied: false }`

- `runFlowThrough` and `applyFieldUpdate` are stubs — they always return `{ applied: false, details: 'not implemented' }`
- If flow-through logic appears to not run, this is why — the real logic is in [`convex/returns.ts`](../../convex/returns.ts) `recalculateReturnLogic`

### `returns.forms` Shape Ambiguity

- `returns.forms` is typed as `v.optional(v.any())` — it can be `Record<string, FormDoc>` OR `string[]`
- [`convex/returns.ts:17`](../../convex/returns.ts:17) checks `typeof ret.forms === "object" && !Array.isArray(ret.forms)` — if this check fails, forms are silently skipped in recalculation

### Test Failures: Wrong Directory

- Jest `testMatch` is `**/tests/**/*.test.(ts|tsx|js)` — tests placed in `__tests__/` or alongside source files will NOT be discovered

### Missing Dependencies in `TaxInput.tsx`

- [`components/TaxInput.tsx`](../../components/TaxInput.tsx) imports `lucide-react` and `clsx` which are not in `package.json` — these will fail at runtime until installed
