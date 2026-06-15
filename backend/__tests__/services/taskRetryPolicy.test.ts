/**
 * Unit tests for the task retry policy.
 *
 * This logic is intentionally pure (no DB, no MessageBus) so the retry cap that
 * prevents permanently-failing tasks from looping forever is verifiable without
 * any infrastructure.
 */

import { describe, it, expect } from '@jest/globals';
import {
  MAX_TASK_RETRIES,
  decideTaskFailureOutcome,
} from '../../src/services/TaskRetryPolicy';

describe('TaskRetryPolicy', () => {
  it('retries a first-time failure and increments the count', () => {
    const outcome = decideTaskFailureOutcome(0, 3);
    expect(outcome.action).toBe('retry');
    expect(outcome.nextStatus).toBe('TODO');
    expect(outcome.nextRetryCount).toBe(1);
  });

  it('keeps retrying until one attempt before the cap', () => {
    const outcome = decideTaskFailureOutcome(2, 3);
    expect(outcome.action).toBe('retry');
    expect(outcome.nextStatus).toBe('TODO');
    expect(outcome.nextRetryCount).toBe(3);
  });

  it('dead-letters once the retry cap is reached', () => {
    const outcome = decideTaskFailureOutcome(3, 3);
    expect(outcome.action).toBe('dead-letter');
    expect(outcome.nextStatus).toBe('FAILED');
    expect(outcome.nextRetryCount).toBe(3);
  });

  it('dead-letters when the count already exceeds the cap', () => {
    const outcome = decideTaskFailureOutcome(7, 3);
    expect(outcome.action).toBe('dead-letter');
    expect(outcome.nextStatus).toBe('FAILED');
  });

  it('treats a negative/garbage count as zero attempts', () => {
    const outcome = decideTaskFailureOutcome(-5, 3);
    expect(outcome.action).toBe('retry');
    expect(outcome.nextRetryCount).toBe(1);
  });

  it('uses MAX_TASK_RETRIES as the default cap', () => {
    // At the default cap it must dead-letter; one below it must still retry.
    expect(decideTaskFailureOutcome(MAX_TASK_RETRIES).action).toBe('dead-letter');
    expect(decideTaskFailureOutcome(MAX_TASK_RETRIES - 1).action).toBe('retry');
  });
});
