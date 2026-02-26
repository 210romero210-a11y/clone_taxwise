# LLM Function-Calling Spec (TaxWise Clone)

- Purpose: LLM assists with data entry, suggestions, and complex mapping (flow-through).
- Interaction pattern:
  - Client composes `LLMFunctionCall` objects and sends to `lib/llmClient.callLLMFunction`.
  - LLM returns a JSON object with:
    - `result`: suggested field updates { formId, fieldId, value, reason }
    - `diagnostics`: array of { fieldId, message, severity: 'error'|'warning' }
    - `actions`: optional list of idempotent commands for Convex internal functions (e.g., `applyFieldUpdate`)
- Security: All LLM-suggested updates must be validated server-side via Convex internal functions before persisting.
