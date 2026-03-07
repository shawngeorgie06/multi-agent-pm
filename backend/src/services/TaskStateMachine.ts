/**
 * Task State Machine - Phase A3
 * Manages valid state transitions for tasks during parallel execution
 * Ensures tasks move through correct state sequence and prevents invalid transitions
 */

/**
 * Valid task states in the execution lifecycle
 */
export enum TaskState {
  TODO = 'TODO',           // Initial state - task created but not claimed
  CLAIMED = 'CLAIMED',     // Agent has claimed the task (lock acquired)
  IN_PROGRESS = 'IN_PROGRESS', // Agent actively executing
  COMPLETE = 'COMPLETE',   // Task completed successfully
  FAILED = 'FAILED',       // Task failed - permanent failure
  RETRYING = 'RETRYING'    // Task failed but will retry
}

/**
 * Task state transition rules
 * Defines which states can transition to which other states
 */
const VALID_TRANSITIONS: Map<TaskState, Set<TaskState>> = new Map([
  [TaskState.TODO, new Set([TaskState.CLAIMED])],
  [TaskState.CLAIMED, new Set([TaskState.IN_PROGRESS, TaskState.TODO])], // Revert if claim fails
  [TaskState.IN_PROGRESS, new Set([TaskState.COMPLETE, TaskState.FAILED, TaskState.RETRYING])],
  [TaskState.FAILED, new Set([TaskState.RETRYING, TaskState.TODO])], // Retry or reset
  [TaskState.RETRYING, new Set([TaskState.CLAIMED, TaskState.FAILED])], // Retry attempt or give up
  [TaskState.COMPLETE, new Set([])] // Terminal state
]);

/**
 * Task state transition context
 */
export interface StateTransitionContext {
  taskId: string;
  projectId: string;
  fromState: TaskState;
  toState: TaskState;
  agentId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * State transition event
 */
export interface StateTransitionEvent {
  taskId: string;
  projectId: string;
  previousState: TaskState;
  currentState: TaskState;
  transition: string;
  agentId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Task State Machine
 * Enforces valid state transitions and provides state validation
 */
export class TaskStateMachine {
  // Track current state per task: taskId -> TaskState
  private taskStates: Map<string, TaskState> = new Map();

  // Track state history per task: taskId -> StateTransitionEvent[]
  private stateHistory: Map<string, StateTransitionEvent[]> = new Map();

  // Listeners for state changes
  private listeners: Array<(event: StateTransitionEvent) => void> = [];

  /**
   * Initialize a task to TODO state
   */
  initializeTask(taskId: string, projectId: string): boolean {
    if (this.taskStates.has(taskId)) {
      console.warn(`[TaskStateMachine] Task ${taskId} already initialized`);
      return false;
    }

    this.taskStates.set(taskId, TaskState.TODO);
    this.stateHistory.set(taskId, []);

    const event: StateTransitionEvent = {
      taskId,
      projectId,
      previousState: TaskState.TODO,
      currentState: TaskState.TODO,
      transition: 'INITIALIZE',
      timestamp: new Date()
    };

    this.stateHistory.get(taskId)!.push(event);
    this.notifyListeners(event);

    console.log(`[TaskStateMachine] Task ${taskId} initialized to TODO state`);
    return true;
  }

  /**
   * Attempt a state transition
   * Returns true if transition is valid, false if invalid
   */
  transitionTask(
    taskId: string,
    projectId: string,
    toState: TaskState,
    agentId?: string,
    metadata?: Record<string, any>
  ): boolean {
    const currentState = this.taskStates.get(taskId);

    // Task doesn't exist
    if (!currentState) {
      console.error(`[TaskStateMachine] Task ${taskId} not found - cannot transition`);
      return false;
    }

    // Same state - no-op
    if (currentState === toState) {
      console.log(`[TaskStateMachine] Task ${taskId} already in state ${toState}`);
      return true;
    }

    // Check if transition is valid
    const validTargets = VALID_TRANSITIONS.get(currentState);
    if (!validTargets || !validTargets.has(toState)) {
      console.error(
        `[TaskStateMachine] Invalid transition: ${taskId} from ${currentState} to ${toState}`
      );
      return false;
    }

    // Perform transition
    const previousState = currentState;
    this.taskStates.set(taskId, toState);

    const event: StateTransitionEvent = {
      taskId,
      projectId,
      previousState,
      currentState: toState,
      transition: `${previousState} -> ${toState}`,
      agentId,
      timestamp: new Date(),
      metadata
    };

    if (!this.stateHistory.has(taskId)) {
      this.stateHistory.set(taskId, []);
    }
    this.stateHistory.get(taskId)!.push(event);

    this.notifyListeners(event);

    console.log(
      `[TaskStateMachine] Task ${taskId} transitioned: ${previousState} -> ${toState}${agentId ? ` by ${agentId}` : ''}`
    );
    return true;
  }

  /**
   * Get current state of a task
   */
  getTaskState(taskId: string): TaskState | null {
    return this.taskStates.get(taskId) || null;
  }

  /**
   * Check if a task is in a terminal state
   */
  isTerminalState(taskId: string): boolean {
    const state = this.getTaskState(taskId);
    return state === TaskState.COMPLETE || state === TaskState.FAILED;
  }

  /**
   * Check if a state transition is valid
   */
  isValidTransition(fromState: TaskState, toState: TaskState): boolean {
    if (fromState === toState) {
      return true;
    }
    const validTargets = VALID_TRANSITIONS.get(fromState);
    return validTargets ? validTargets.has(toState) : false;
  }

  /**
   * Get all valid next states from current state
   */
  getValidNextStates(taskId: string): TaskState[] {
    const currentState = this.getTaskState(taskId);
    if (!currentState) {
      return [];
    }

    const validTargets = VALID_TRANSITIONS.get(currentState);
    return validTargets ? Array.from(validTargets) : [];
  }

  /**
   * Get state history for a task
   */
  getTaskHistory(taskId: string): StateTransitionEvent[] {
    return this.stateHistory.get(taskId) || [];
  }

  /**
   * Get all tasks in a specific state
   */
  getTasksByState(state: TaskState): string[] {
    const tasks: string[] = [];
    for (const [taskId, taskState] of this.taskStates.entries()) {
      if (taskState === state) {
        tasks.push(taskId);
      }
    }
    return tasks;
  }

  /**
   * Get state statistics
   */
  getStateStatistics(): Record<TaskState, number> {
    const stats: Record<TaskState, number> = {
      [TaskState.TODO]: 0,
      [TaskState.CLAIMED]: 0,
      [TaskState.IN_PROGRESS]: 0,
      [TaskState.COMPLETE]: 0,
      [TaskState.FAILED]: 0,
      [TaskState.RETRYING]: 0
    };

    for (const state of this.taskStates.values()) {
      stats[state]++;
    }

    return stats;
  }

  /**
   * Subscribe to state change events
   */
  onStateChange(listener: (event: StateTransitionEvent) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(event: StateTransitionEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[TaskStateMachine] Error in state change listener:', error);
      }
    }
  }

  /**
   * Reset state machine (for testing)
   */
  reset(): void {
    this.taskStates.clear();
    this.stateHistory.clear();
    this.listeners = [];
    console.log('[TaskStateMachine] State machine reset');
  }

  /**
   * Clear history for a specific task (cleanup old entries)
   */
  clearTaskHistory(taskId: string): void {
    this.stateHistory.delete(taskId);
  }

  /**
   * Get all tracked tasks
   */
  getAllTasks(): string[] {
    return Array.from(this.taskStates.keys());
  }

  /**
   * Validate and log a complete task state diagram
   */
  logStateDiagram(): void {
    console.log('\n' + '='.repeat(60));
    console.log('TASK STATE MACHINE DIAGRAM');
    console.log('='.repeat(60));

    for (const [fromState, toStates] of VALID_TRANSITIONS.entries()) {
      const targets = Array.from(toStates).join(', ') || 'NONE (TERMINAL)';
      console.log(`  ${fromState} -> ${targets}`);
    }

    console.log('='.repeat(60) + '\n');
  }
}

export default TaskStateMachine;
