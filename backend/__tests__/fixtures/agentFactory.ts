/**
 * Agent Factory for Testing
 * Creates test agents with mocked dependencies
 */

import { MockMessageBus, MockTaskStore, MockOllamaProvider } from './mockServices.js';

/**
 * Factory configuration interface
 */
export interface TestAgentConfig {
  messageBus?: MockMessageBus;
  taskStore?: MockTaskStore;
  ollama?: MockOllamaProvider;
  [key: string]: any;
}

/**
 * Create a test agent with mocked dependencies
 */
export function createTestAgent(agentType: string, config?: TestAgentConfig) {
  const messageBus = config?.messageBus || new MockMessageBus();
  const taskStore = config?.taskStore || new MockTaskStore();
  const ollama = config?.ollama || new MockOllamaProvider();

  const agentConfig = {
    id: `test-${agentType.toLowerCase()}-${Date.now()}`,
    type: agentType,
    messageBus,
    taskStore,
    ollama,
    ...config,
  };

  return agentConfig;
}

/**
 * Create a complete test environment with all dependencies
 */
export function createTestEnvironment() {
  return {
    messageBus: new MockMessageBus(),
    taskStore: new MockTaskStore(),
    ollama: new MockOllamaProvider(),
  };
}

/**
 * Create multiple test agents with shared dependencies
 */
export function createTestTeam(agentTypes: string[], sharedEnv?: any) {
  const env = sharedEnv || createTestEnvironment();
  const agents = agentTypes.map((type) =>
    createTestAgent(type, {
      messageBus: env.messageBus,
      taskStore: env.taskStore,
      ollama: env.ollama,
    })
  );
  return { agents, environment: env };
}

/**
 * Create a realistic multi-phase workflow test scenario
 */
export function createWorkflowScenario() {
  const env = createTestEnvironment();

  // Create a team with multiple agent types
  const team = {
    pm: createTestAgent('PROJECT_MANAGER', {
      messageBus: env.messageBus,
      taskStore: env.taskStore,
      ollama: env.ollama,
    }),
    frontend: createTestAgent('FRONTEND', {
      messageBus: env.messageBus,
      taskStore: env.taskStore,
      ollama: env.ollama,
    }),
    backend: createTestAgent('BACKEND', {
      messageBus: env.messageBus,
      taskStore: env.taskStore,
      ollama: env.ollama,
    }),
    qa: createTestAgent('QA', {
      messageBus: env.messageBus,
      taskStore: env.taskStore,
      ollama: env.ollama,
    }),
  };

  return {
    team,
    environment: env,
    // Helper to get all agents
    getAllAgents() {
      return Object.values(team);
    },
    // Helper to get agent by type
    getAgentByType(type: string) {
      return Object.values(team).find((a: any) => a.type === type);
    },
  };
}

/**
 * Test fixture for concurrent claiming scenario
 */
export function createConcurrentClaimingScenario() {
  const env = createTestEnvironment();
  const agents = [];

  // Create 10 agents
  for (let i = 1; i <= 10; i++) {
    agents.push(
      createTestAgent(`AGENT_${i}`, {
        messageBus: env.messageBus,
        taskStore: env.taskStore,
        ollama: env.ollama,
      })
    );
  }

  return {
    agents,
    environment: env,
    agentCount: 10,
    taskCount: 50,
  };
}

/**
 * Helper to simulate agent activity
 */
export async function simulateAgentWork(agent: any, taskCount: number = 5): Promise<any> {
  const results = [];
  for (let i = 0; i < taskCount; i++) {
    // Simulate work
    await new Promise((r) => setTimeout(r, 10));
    results.push({
      agentId: agent.id,
      taskIndex: i,
      completed: true,
      timestamp: new Date(),
    });
  }
  return results;
}

/**
 * Reset helper for cleaning up test state
 */
export async function resetTestEnvironment(env: any): Promise<void> {
  if (env.taskStore?.clearAll) {
    env.taskStore.clearAll();
  }
  if (env.messageBus?.clearMessages) {
    env.messageBus.clearMessages();
  }
  if (env.ollama?.clearHistory) {
    env.ollama.clearHistory();
  }
}
