/**
 * Tests for BaseAgent.generateWithSelfCorrection — the loop that regenerates
 * code with validation errors as feedback instead of shipping broken output.
 *
 * Uses a test subclass with canned executeTask outputs and a scripted
 * validateOutput, so no LLM or DB is involved.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BaseAgent } from '../../src/agents/BaseAgent';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';

interface CannedValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/** Test agent: returns queued outputs from executeTask and validates each
 *  output via a caller-supplied map. Records how many times executeTask ran
 *  and the feedback it received. */
class TestAgent extends BaseAgent {
  outputs: string[] = [];
  validations: Record<string, CannedValidation> = {};
  executeCalls = 0;
  lastFeedback: string | undefined;

  async executeTask(_task: any, context?: any): Promise<any> {
    this.executeCalls++;
    this.lastFeedback = context?.errorFeedback;
    // Shift the next canned output; reuse the last one if the queue is empty.
    const code = this.outputs.length > 1 ? this.outputs.shift()! : this.outputs[0];
    return { success: true, generatedCode: code, language: 'html', type: 'layout' };
  }

  protected async validateOutput(generatedCode: string): Promise<CannedValidation> {
    return this.validations[generatedCode] ?? { isValid: true, errors: [], warnings: [] };
  }

  // Expose the protected method for testing.
  public run(task: any, context: any, taskId: string) {
    return this.generateWithSelfCorrection(task, context, taskId);
  }
}

describe('BaseAgent self-correction loop', () => {
  let agent: TestAgent;

  beforeEach(() => {
    const messageBus = new MessageBus(new MockTaskStore());
    agent = new TestAgent({ agentId: 'test', agentType: 'LAYOUT', capabilities: [] }, messageBus);
  });

  it('accepts valid output on the first attempt without regenerating', async () => {
    agent.outputs = ['<div id="app">ok</div>'];
    agent.validations = { '<div id="app">ok</div>': { isValid: true, errors: [], warnings: [] } };

    const result = await agent.run({}, {}, 'task-1');

    expect(result.generatedCode).toBe('<div id="app">ok</div>');
    expect(agent.executeCalls).toBe(1);
  });

  it('regenerates once and accepts the corrected output', async () => {
    agent.outputs = ['bad', 'good'];
    agent.validations = {
      bad: { isValid: false, errors: ['missing #app'], warnings: [] },
      good: { isValid: true, errors: [], warnings: [] },
    };

    const result = await agent.run({}, {}, 'task-1');

    expect(result.generatedCode).toBe('good');
    expect(agent.executeCalls).toBe(2);
  });

  it('passes the validation errors back as feedback on regeneration', async () => {
    agent.outputs = ['bad', 'good'];
    agent.validations = {
      bad: { isValid: false, errors: ['orphaned selector .foo'], warnings: [] },
      good: { isValid: true, errors: [], warnings: [] },
    };

    await agent.run({}, {}, 'task-1');

    expect(agent.lastFeedback).toContain('orphaned selector .foo');
  });

  it('stops at the regeneration cap and keeps the best (fewest-errors) attempt', async () => {
    // Each attempt strictly improves but never becomes valid.
    agent.outputs = ['e3', 'e2', 'e1', 'e0'];
    agent.validations = {
      e3: { isValid: false, errors: ['a', 'b', 'c'], warnings: [] },
      e2: { isValid: false, errors: ['a', 'b'], warnings: [] },
      e1: { isValid: false, errors: ['a'], warnings: [] },
      e0: { isValid: false, errors: ['a'], warnings: [] },
    };

    const result = await agent.run({}, {}, 'task-1');

    // Initial + MAX_VALIDATION_REGENERATIONS(2) = 3 executeTask calls.
    expect(agent.executeCalls).toBe(3);
    expect(result.generatedCode).toBe('e1'); // best attempt reached within the cap
  });

  it('stops early and keeps the prior best when a retry does not improve', async () => {
    agent.outputs = ['first', 'nope'];
    agent.validations = {
      first: { isValid: false, errors: ['a', 'b'], warnings: [] },
      nope: { isValid: false, errors: ['a', 'b'], warnings: [] }, // same error count
    };

    const result = await agent.run({}, {}, 'task-1');

    expect(agent.executeCalls).toBe(2); // one retry, then gives up (no improvement)
    expect(result.generatedCode).toBe('first');
  });

  it('returns output unchanged when there is no generatedCode', async () => {
    agent.outputs = [''];
    const result = await agent.run({}, {}, 'task-1');
    expect(result.generatedCode).toBe('');
    expect(agent.executeCalls).toBe(1);
  });
});
