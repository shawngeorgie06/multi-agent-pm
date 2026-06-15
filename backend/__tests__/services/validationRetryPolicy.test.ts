/**
 * Unit tests for the validation retry policy — the pure decision of whether to
 * regenerate code after it fails validation, used by BaseAgent's
 * self-correction loop. No LLM or DB involved.
 */

import { describe, it, expect } from '@jest/globals';
import {
  MAX_VALIDATION_REGENERATIONS,
  shouldRegenerate,
} from '../../src/agents/ValidationRetryPolicy';

describe('ValidationRetryPolicy', () => {
  it('does not regenerate valid output', () => {
    expect(shouldRegenerate({ isValid: true }, 0, 2)).toBe(false);
  });

  it('regenerates invalid output while attempts remain', () => {
    expect(shouldRegenerate({ isValid: false }, 0, 2)).toBe(true);
    expect(shouldRegenerate({ isValid: false }, 1, 2)).toBe(true);
  });

  it('stops regenerating once the cap is reached', () => {
    expect(shouldRegenerate({ isValid: false }, 2, 2)).toBe(false);
    expect(shouldRegenerate({ isValid: false }, 3, 2)).toBe(false);
  });

  it('never regenerates valid output even with attempts left', () => {
    expect(shouldRegenerate({ isValid: true }, 0, 5)).toBe(false);
  });

  it('uses MAX_VALIDATION_REGENERATIONS as the default cap', () => {
    expect(shouldRegenerate({ isValid: false }, MAX_VALIDATION_REGENERATIONS - 1)).toBe(true);
    expect(shouldRegenerate({ isValid: false }, MAX_VALIDATION_REGENERATIONS)).toBe(false);
  });

  it('keeps the default cap small to avoid burning LLM quota', () => {
    expect(MAX_VALIDATION_REGENERATIONS).toBeGreaterThanOrEqual(1);
    expect(MAX_VALIDATION_REGENERATIONS).toBeLessThanOrEqual(3);
  });
});
