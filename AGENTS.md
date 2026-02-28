# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project Purpose and Scope

TaxWise clone: a real-time tax preparation suite built with Next.js 15 App Router, Convex (DB/backend), and LLM-assisted data entry. Replicates TaxWise's form-tree UI and flow-through calculation logic.This repository is a modern, real-time tax preparation suite inspired by TaxWise, built with Next.js (App Router), Convex (DB/Storage/Components), Tailwind CSS, and TypeScript. It models complex IRS form logic (e.g., 1040 line mappings), supports reactive “flow-through” calculations across forms, and emphasizes high performance, strong UX familiarity for power users, and PII security.

## Commands and Development Workflow

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

## Project Structure and Key Files

- app/
  - Next.js App Router pages and server components (e.g., app/page.tsx, app/server/page.tsx, app/final-review/page.tsx).
  - globals.css, layout.tsx: global styles and app layout.
- components/
  - Reusable client components (FormTree, TaxInput, RefundMonitor, DiagnosticPanel, FinalReview, etc.).
  - ConvexClientProvider for hooking Convex into the app.
- contexts/
  - React contexts for application state (e.g., ReturnContext for active return/session context).
- convex/
  - Convex backend functions, schema, and typed API generators.
  - logic.ts, diagnostics.ts, returns.ts, files.ts, export.ts, import.ts, sessions.ts, print.ts, printAction.ts, http.ts, internalFunctions.ts, audit.ts.
  - _generated/ contains Convex codegen outputs (api, server, dataModel) — do not edit directly.
  - schema.ts defines the Convex data model.
- hooks/
  - Reusable React hooks (e.g., useTaxKeyboard, useFocusMap) for domain input/UX efficiency.
- lib/
  - Core domain logic/utilities not tied to React: engine.ts (dependency engine), taxMath.ts (numeric operations), fieldIds.ts (IDs and canonicalization helpers), validators.ts (input validation), printEngine.ts & printTemplates.ts (print pipeline), encryption.ts (PII security), llmClient.ts (LLM integration), mefGenerator.ts (MEF output).
- public/
  - Static assets.
- scripts/
  - Utilities like migrateFieldIds.js for schema/ID maintenance.
- tests/
  - Jest test suite: unit and integration tests for calculations, flowthrough, diagnostics, canonicalization, and end-to-end return flows.
- Root configs:
  - tsconfig.json, eslint.config.mjs, jest.config.ts, jest.setup.ts, next.config.ts, postcss.config.mjs, .prettierrc.
  - .env.example for environment configuration.
  - Docs: README.md, AGENT.md/AGENTS.md, docs/LLM_SPEC.md, docs/WISP.md, Convex Best Practices.txt.
- 

Role of key files:

- lib/engine.ts: Core dependency engine that recalculates fields based on changes; central to flow-through behavior.
- convex/schema.ts: Authoritative data model for Convex; update here for new collections/fields.
- components/FormTree.tsx, TaxInput.tsx: Primary UI patterns mirroring TaxWise form/line entry.
- lib/taxMath.ts: Centralized numeric and rounding rules — use instead of ad hoc math.
- lib/encryption.ts: PII encryption utilities — always route sensitive data through here.
- tests/*.test.ts: Canonical truth for expected behavior; add tests with each new feature.

## Test Strategy and Organization

- Framework: Jest with ts-jest/TypeScript support (see jest.config.ts and jest.setup.ts).
- Organization:
  - tests/ contains domain-focused suites: calculations, taxMath, flowthrough, diagnostics, overrideRecalc, EndToEndReturn.
  - Prefer co-locating new domain tests in tests/ with descriptive filenames matching feature or module.
- Philosophy:
  - Unit tests for lib/ modules (taxMath, validators, fieldIds, engine primitives).
  - Integration tests for cross-module flow (engine + field mappings + storage interactions).
  - End-to-end tests for return lifecycle and UI+Convex orchestration where feasible.
- Mocking:
  - Mock IO (Convex calls, network/LLM) and date/time deterministically.
  - Avoid mocking domain math: test the real taxMath/engine to catch regression in calculations.
- Coverage:
  - Target high coverage for lib/ and convex/ logic, especially calculations, engine dependencies, and diagnostics.
  - Include negative tests (invalid inputs, edge IRS rules, overrides).
- Regression:
  - When fixing bugs, add regression tests that capture the exact failing scenario/ID set.

## Code Style and Conventions

- Language: TypeScript with strict typing (no any). Use unknown or generics when necessary.
- Async:
  - Prefer async/await. Wrap Convex and network calls in try/catch with typed error paths.
- Typing:
  - Strong typing for domain entities (FieldId, ReturnId, Money, Percent, DiagnosticCode).
  - Use branded types or nominal wrappers where appropriate to avoid ID mix-ups.
  - For dynamic schemas (IRS form mappings), expose narrow, validated shapes and utility type guards rather than using any.
- Naming:
  - Files: camelCase or kebab-case for non-components; PascalCase for React components; .ts for logic, .tsx for React.
  - Variables: descriptive camelCase; constants UPPER_SNAKE_CASE when global.
  - Functions: verbNoun; avoid abbreviations except IRS-standard terms (AGI, EIC).
  - Types/Interfaces: PascalCase with clear domain meaning.
- Comments/Docs:
  - Add docblocks for exported functions and complex algorithms (engine resolution steps, canonicalization, validators).
  - Reference IRS forms/lines (e.g., “1040 Line 1z”) in comments near mapping logic.
- Error handling:
  - Domain errors should be typed (e.g., Result<T, DomainError> or custom Error subclasses).
  - Validate inputs at the boundary (UI/convex/http) using validators.ts.
  - Log with context but never leak PII in logs.
- Formatting/Lint:
  - Prettier and ESLint configs are present; adhere to formatting and lint rules.
  - No implicit any. Avoid non-null assertions unless proven safe and documented.

## Common Patterns and Best Practices

- Dependency Engine:
  - Centralized recalculation via lib/engine.ts. All field updates should route through the engine to trigger flow-through changes.
  - Idempotent, deterministic evaluation. Avoid side effects during pure computation steps.
- Field Identification & Canonicalization:
  - Use lib/fieldIds.ts for canonical field IDs; run scripts/migrateFieldIds.js when migrating IDs.
- Numeric Safety:
  - Use lib/taxMath.ts for all arithmetic, rounding, and currency-safe operations. Never hand-roll rounding rules inline.
- Validation:
  - Consolidate input and state validation in lib/validators.ts. Reuse validators in UI and Convex to enforce consistency.
- Diagnostics:
  - Encapsulate rule evaluation in convex/diagnostics.ts and components/DiagnosticPanel.tsx. Add new rules with tests in tests/diagnostics.test.ts.
- Printing/Export:
  - lib/printEngine.ts and lib/printTemplates.ts handle rendering; convex/print.ts and convex/printAction.ts orchestrate.
  - lib/mefGenerator.ts for MEF outputs; keep schemas up to date with IRS yearly changes.
- Security:
  - lib/encryption.ts for all crypto operations. Never store raw PII. Ensure keys are sourced from environment and rotated securely.
- React:
  - Thin components; heavy logic in lib/ and convex/.
  - Use contexts/ReturnContext.tsx to scope active return/session; prefer hooks for UI behaviors (useTaxKeyboard, useFocusMap).
- Convex:
  - Data model changes through convex/schema.ts; follow codegen outputs in convex/_generated.
  - Split mutations/queries logically by domain (returns, sessions, files, diagnostics).

## Do's and Don'ts for Agents

- Do
  - Route all field updates through the dependency engine.
  - Use taxMath.ts for all math operations.
  - Add tests when introducing new IRS rules or changing form logic.
  - Keep PII encrypted at rest and avoid logging sensitive data.
  - Use typed IDs and validated shapes across boundaries.
  - Document assumptions and IRS references near complex logic.
  - Keep UI declarative; side effects in hooks or Convex actions/mutations.
- Don’t
  - Don’t use any — prefer unknown, generics, or discriminated unions.
  - Don’t bypass validators or the dependency engine.
  - Don’t duplicate logic across UI, lib, and backend — centralize in lib/ and convex/.
  - Don’t mutate shared objects; prefer immutable updates in calculations.
  - Don’t hardcode IRS constants inline — centralize in a constants module or taxMath.

## Tools & Dependencies

- Next.js (App Router): app/ structure for SSR/ISR and server components.
- Convex: database, functions, and real-time updates; codegen under convex/_generated.
- Tailwind CSS: utility-first styling via globals.css and component classes.
- Jest: testing framework configured for TypeScript; see jest.config.ts and jest.setup.ts.
- TypeScript: strict mode; align with tsconfig.json.
- ESLint + Prettier: linting/formatting.
- Scripts: migrateFieldIds.js to maintain field ID consistency.

Setup:

- Copy .env.example to .env and configure Convex/crypto keys.
- Install dependencies: npm install
- Start dev: npm run dev
- Run tests: npm test

## Other Notes and Guidelines

- LLM usage:
  - Keep prompts and responses free of PII. If LLMs assist with logic, gate outputs with validators and tests.
  - When generating code, maintain strict typing and avoid any.
- Yearly IRS updates:
  - Expect annual schema/taxMath changes; version rules and templates per tax year where feasible.
- Performance:
  - The dependency engine should be optimized for minimal recomputation; prefer memoization where safe and deterministic.
- Accessibility & Power-User UX:
  - Maintain keyboard-first input flows (useTaxKeyboard) and predictable focus management (useFocusMap).
- Printing and MEF:
  - Tests must pin outputs for stability; use snapshots judiciously with explicit numeric assertions.

---
End code/documentation snippets.