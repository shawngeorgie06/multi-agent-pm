/**
 * Proves that when an agent regenerates after a failed validation, the
 * validation errors actually reach the LLM prompt — otherwise a retry would
 * re-send the identical prompt and produce identical broken output.
 *
 * Uses a prompt-capturing fake AIService, so no real model is called.
 */

import { describe, it, expect } from '@jest/globals';
import { LayoutAgent } from '../../src/agents/LayoutAgent';
import { MessageBus } from '../../src/services/MessageBus';
import { MockTaskStore } from '../fixtures/mockServices';
import type { AIService } from '../../src/services/AIService';

class PromptCapturingService implements AIService {
  readonly providerName = 'fake';
  readonly modelName = 'fake-model';
  lastPrompt = '';

  async generate(prompt: string): Promise<string> {
    this.lastPrompt = prompt;
    return '<div id="app">ok</div>';
  }

  async streamGenerate(prompt: string): Promise<string> {
    return this.generate(prompt);
  }
}

describe('validation feedback threading', () => {
  it('includes the validation errors in the regeneration prompt', async () => {
    const service = new PromptCapturingService();
    const messageBus = new MessageBus(new MockTaskStore());
    const agent = new LayoutAgent('layout-1', messageBus, service);

    await agent.executeTask(
      { description: 'a calculator', context: 'base context' },
      { errorFeedback: 'Previous attempt failed: missing #result element; orphaned selector .btn' }
    );

    expect(service.lastPrompt).toContain('missing #result element');
    expect(service.lastPrompt).toContain('orphaned selector .btn');
    expect(service.lastPrompt).toContain('FIX REQUIRED');
  });

  it('does not add a fix section on a first (feedback-free) attempt', async () => {
    const service = new PromptCapturingService();
    const messageBus = new MessageBus(new MockTaskStore());
    const agent = new LayoutAgent('layout-1', messageBus, service);

    await agent.executeTask({ description: 'a calculator', context: 'base context' }, {});

    expect(service.lastPrompt).not.toContain('FIX REQUIRED');
  });
});
