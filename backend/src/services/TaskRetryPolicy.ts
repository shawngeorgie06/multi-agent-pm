/**
 * Task retry policy.
 *
 * When an agent reports a task failure, the distribution layer needs to decide
 * whether to put the task back on the queue for another attempt or to give up.
 * Without a cap, a task that fails deterministically (bad prompt, model error,
 * impossible requirement) loops forever: claim -> fail -> reset to TODO ->
 * claim -> fail ... This burns API quota, keeps agents busy, and makes the
 * project appear "stuck".
 *
 * This module isolates that decision as a pure function so it can be unit-tested
 * without a database or message bus.
 */

/**
 * Maximum number of times a failed task is retried before it is marked
 * terminally FAILED (dead-lettered) instead of being requeued.
 */
export const MAX_TASK_RETRIES = 3;

/** What to do with a task after a reported failure. */
export type TaskFailureAction = 'retry' | 'dead-letter';

export interface TaskFailureOutcome {
  /** 'retry' to requeue the task; 'dead-letter' to stop retrying. */
  action: TaskFailureAction;
  /** The retryCount value to persist on the task after this failure. */
  nextRetryCount: number;
  /** The Task.status to persist: 'TODO' to requeue, 'FAILED' when exhausted. */
  nextStatus: 'TODO' | 'FAILED';
}

/**
 * Decide what to do when a task fails, enforcing the retry cap.
 *
 * @param currentRetryCount how many times this task has already been retried
 *        (values below zero are treated as zero)
 * @param maxRetries the cap; defaults to {@link MAX_TASK_RETRIES}
 */
export function decideTaskFailureOutcome(
  currentRetryCount: number,
  maxRetries: number = MAX_TASK_RETRIES
): TaskFailureOutcome {
  const attemptsSoFar = Math.max(0, Math.floor(currentRetryCount) || 0);

  if (attemptsSoFar >= maxRetries) {
    // Retry budget exhausted — stop the loop and surface a terminal failure.
    return {
      action: 'dead-letter',
      nextRetryCount: attemptsSoFar,
      nextStatus: 'FAILED',
    };
  }

  return {
    action: 'retry',
    nextRetryCount: attemptsSoFar + 1,
    nextStatus: 'TODO',
  };
}
