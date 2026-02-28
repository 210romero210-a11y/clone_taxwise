import { api } from "@/convex/_generated/api";
import { LlmFieldSuggestion, ApplyResult, ValidFieldUpdate } from "@/lib/llmTypes";
import { Id } from "@/convex/_generated/dataModel";
import { getConvexClient } from '@/components/ConvexClientProvider'

/**
 * Apply a validated, strictly typed set of LLM-suggested field updates
 * via an internal Convex action.
 *
 * Why:
 * - Centralizes flow for applying LLM suggestions through a single secure entrypoint.
 * - Ensures all updates are authorized, override-aware, audited, and run through the
 *   dependency engine on the backend (Convex).
 * - Prevents persisting raw LLM output and returns only non-PII diagnostics.
 *
 * Security and typing:
 * - Accepts only LlmFieldSuggestion (no `any`), whose fields are validated at the boundary.
 * - Calls a Convex internal action that must enforce:
 *   - Session authorization/ownership checks.
 *   - Canonical field ID validation and override respect.
 *   - Audit logging with PII-safe storage.
 * - Returns a strictly typed ApplyResult containing applied updates and diagnostics.
 *
 * Error handling:
 * - Surfaces Convex action errors to the caller; upstream code should handle and display
 *   non-sensitive error messages.
 *
 * @param sessionId - Authenticated session identifier used for server-side authorization.
 * @param suggestion - Validated LLM suggestion payload with readonly, strictly typed updates.
 * @returns Typed application result: applied updates and non-PII diagnostics.
 */
export async function applyLlmSuggestion(
  sessionId: string,
  suggestion: LlmFieldSuggestion
): Promise<ApplyResult> {
  const convex = await getConvexClient();

  // Internal action responsibilities:
  // - Authorize sessionId; check return ownership for each update.
  // - Canonicalize and validate field IDs and values; enforce overrides.
  // - Apply engine-driven recalculation and write audit records.
  const res = await convex.action(api.internal.applyValidatedFieldUpdates, {
    sessionId,
    updates: suggestion.updates,
    source: "llm",
  });

  // Returns strictly typed, non-PII result. Do not cast to `any`.
  return {
    applied: res.applied as ReadonlyArray<ValidFieldUpdate>,
    diagnostics: res.diagnostics as ReadonlyArray<{
      code: string;
      level: "info" | "warn" | "error";
    }>,
  };
}