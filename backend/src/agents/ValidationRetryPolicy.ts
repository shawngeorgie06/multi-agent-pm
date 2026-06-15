/**
 * Validation retry policy.
 *
 * Agents validate their generated code (orphaned CSS selectors, missing
 * required elements, broken structure, …). Previously a failed validation was
 * logged and the broken code shipped anyway. This policy defines, as pure
 * testable logic, when an agent should regenerate after a failed validation —
 * bounded so a stubbornly-failing generation can't loop and burn LLM quota
 * forever.
 */

/**
 * Maximum number of times an agent regenerates after a failed validation
 * before accepting its best attempt. Kept small (LLM calls are expensive).
 */
export const MAX_VALIDATION_REGENERATIONS = 2;

/**
 * Whether to regenerate the output again.
 *
 * @param validation the latest validation result (only `isValid` is consulted)
 * @param regenerationsSoFar how many regenerations have already been attempted
 * @param maxRegenerations the cap (defaults to {@link MAX_VALIDATION_REGENERATIONS})
 */
export function shouldRegenerate(
  validation: { isValid: boolean },
  regenerationsSoFar: number,
  maxRegenerations: number = MAX_VALIDATION_REGENERATIONS
): boolean {
  if (validation.isValid) return false;
  return regenerationsSoFar < maxRegenerations;
}
