# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Purpose
TaxWise clone: a real-time tax preparation suite built with Next.js 15 App Router, Convex (DB/backend), and LLM-assisted data entry. Replicates TaxWise's form-tree UI and flow-through calculation logic.

## Commands
- `pnpm dev` — runs `next dev` + `convex dev` in parallel via `npm-run-all`
- `pnpm predev` — MUST succeed before `dev`; runs `convex dev --until-success` then opens dashboard
- `pnpm test` — Jest with `ts-jest`, `jsdom` environment; tests live in `tests/` only (not `__tests__/`)
- `pnpm test -- --testPathPattern=calculations` — run a single test file
- `pnpm lint` — ESLint ignores `convex/_generated/**` (never edit generated files)

## Critical Architecture Patterns

### Two Separate Field-ID Namespaces
- **`convex/logic.ts` `FIELD_MAP`** uses underscore keys: `"SchC_netProfit"`, `"1040_totalIncome"`
- **`lib/engine.ts` `DEPENDENCY_GRAPH`** uses dot keys: `"W2.box1"`, `"SchC.netProfit"`
- These are NOT interchangeable — keep them consistent within each system

### Convex Schema: `fields` table is the source of truth
- Fields are stored flat in the `fields` table, NOT embedded in `returns.forms`
- `byComposite` index (`returnId`, `formId`, `fieldId`) is required for all field lookups
- `returns.forms` may be embedded OR a list of IDs — check `typeof ret.forms` before iterating (see [`convex/returns.ts:17`](convex/returns.ts:17))

### F5 Key = Override Toggle
- [`components/FormTree.tsx`](components/FormTree.tsx) listens for `F5` keydown globally to toggle `FieldState` between `"normal"` and `"override"`
- `FieldDoc.overridden = true` signals a user-locked field that must NOT be overwritten by engine recalculation

### Recalculation Flow
`updateField` mutation → `recalculateReturnLogic()` → `calculateFederalTax()` in [`lib/engine.ts`](lib/engine.ts) → patches `fields` table + `returns.refund/taxLiability/diagnostics`

### LLM Integration
- [`lib/llmClient.ts`](lib/llmClient.ts) is a stub — wire to OpenAI/Anthropic before use
- All LLM-suggested field updates MUST be validated via Convex internal functions before persisting (security requirement per [`docs/LLM_SPEC.md`](docs/LLM_SPEC.md))

## Convex Rules (from `.github/instructions/convex.instructions.md` and `.cursor/rules/convex_rules.mdc`)
- Always use new function syntax: `export const f = query({ args: {}, handler: async (ctx, args) => {} })`
- ALWAYS include `args` validators on every Convex function (query, mutation, action, internal variants)
- Never use `filter()` in queries — define an index and use `withIndex` instead
- `"use node";` only in action files; never mix with queries/mutations in the same file
- `v.bigint()` is deprecated — use `v.int64()`
- HTTP endpoints go in `convex/http.ts` with `httpAction` decorator
- Internal functions use `internalQuery`/`internalMutation`/`internalAction` — never expose sensitive logic as public

## Tax Math Constants (2025)
- Standard deductions live in [`lib/taxMath.ts`](lib/taxMath.ts) `DEFAULT_2025_CONFIG` — update here for new tax years
- SE tax rate hardcoded as `0.153` in [`lib/engine.ts:59`](lib/engine.ts:59)
- CTC AGI threshold hardcoded as `200000` in [`lib/engine.ts:51`](lib/engine.ts:51)

## Testing Notes
- Jest `testMatch` is `**/tests/**/*.test.(ts|tsx|js)` — tests MUST be in the `tests/` directory
- `convex/internalFunctions.ts` exports are plain async functions (not Convex-registered) — safe to import in Jest
- `convex/logic.ts` `FIELD_MAP` is importable in tests without Convex runtime
