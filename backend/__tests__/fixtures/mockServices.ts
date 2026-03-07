/**
 * Mock Services for Testing Agent-Teams Infrastructure
 * Provides test doubles for MessageBus, TaskStore, and OllamaProvider
 */

/**
 * MockMessageBus - Simulates pub/sub, direct messaging, and request/response
 */
export class MockMessageBus {
  private messages: any[] = [];
  private subscribers: Map<string, Function[]> = new Map();

  subscribe(channel: string, handler: Function): void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, []);
    }
    this.subscribers.get(channel)!.push(handler);
  }

  send(recipientId: string, message: any): void {
    const envelope = { to: recipientId, message, timestamp: new Date() };
    this.messages.push(envelope);
    this.emit(`direct:${recipientId}`, envelope);
  }

  broadcast(message: any): void {
    const envelope = { broadcast: true, message, timestamp: new Date() };
    this.messages.push(envelope);
    this.emit('broadcast', envelope);
  }

  async request(recipientId: string, message: any, timeout: number = 5000): Promise<any> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ error: 'timeout' }), timeout);
      this.send(recipientId, message);
      resolve({ status: 'ok', requestId: `req-${Date.now()}` });
      clearTimeout(timer);
    });
  }

  private emit(event: string, data: any): void {
    const handlers = this.subscribers.get(event) || [];
    handlers.forEach((handler) => handler(data));
  }

  getMessages(): any[] {
    return this.messages;
  }

  clearMessages(): void {
    this.messages = [];
  }

  getMessageCount(): number {
    return this.messages.length;
  }
}

/**
 * MockTaskStore - Simulates task persistence and claiming
 */
export class MockTaskStore {
  private projects: Map<string, any> = new Map();
  private tasks: Map<string, Map<string, any>> = new Map();
  private messages: Map<string, any[]> = new Map();

  // Project Methods
  async saveProject(project: any): Promise<any> {
    const id = project.id || `proj-${Date.now()}`;
    const data = {
      id,
      ...project,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.projects.set(id, data);
    return data;
  }

  async getProject(id: string): Promise<any | null> {
    return this.projects.get(id) || null;
  }

  async listProjects(limit: number = 10): Promise<any[]> {
    return Array.from(this.projects.values()).slice(0, limit);
  }

  async updateProject(id: string, updates: any): Promise<any> {
    const project = this.projects.get(id);
    if (!project) throw new Error(`Project ${id} not found`);
    const updated = { ...project, ...updates, updatedAt: new Date() };
    this.projects.set(id, updated);
    return updated;
  }

  async deleteProject(id: string): Promise<void> {
    this.projects.delete(id);
    this.tasks.delete(id);
    this.messages.delete(id);
  }

  // Task Methods
  async saveTask(projectId: string, task: any): Promise<any> {
    if (!this.tasks.has(projectId)) {
      this.tasks.set(projectId, new Map());
    }
    const taskId = task.taskId || `task-${Date.now()}`;
    const data = {
      id: `${projectId}-${taskId}`,
      projectId,
      ...task,
      taskId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tasks.get(projectId)!.set(taskId, data);
    return data;
  }

  async getTasks(projectId: string): Promise<any[]> {
    const projectTasks = this.tasks.get(projectId);
    return projectTasks ? Array.from(projectTasks.values()) : [];
  }

  async updateTask(projectId: string, taskId: string, updates: any): Promise<any> {
    const projectTasks = this.tasks.get(projectId);
    if (!projectTasks) throw new Error(`Project ${projectId} not found`);
    const task = projectTasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    const updated = { ...task, ...updates, updatedAt: new Date() };
    projectTasks.set(taskId, updated);
    return updated;
  }

  async deleteTask(projectId: string, taskId: string): Promise<void> {
    const projectTasks = this.tasks.get(projectId);
    if (projectTasks) {
      projectTasks.delete(taskId);
    }
  }

  // Message Methods
  async saveMessage(projectId: string, message: any): Promise<any> {
    if (!this.messages.has(projectId)) {
      this.messages.set(projectId, []);
    }
    const data = {
      id: `msg-${Date.now()}`,
      projectId,
      ...message,
      createdAt: new Date(),
    };
    this.messages.get(projectId)!.push(data);
    return data;
  }

  async getMessages(projectId: string): Promise<any[]> {
    return this.messages.get(projectId) || [];
  }

  // Lifecycle
  async connect(): Promise<void> {
    // Mock implementation
  }

  async disconnect(): Promise<void> {
    // Mock implementation
  }

  // Test utilities
  clearAll(): void {
    this.projects.clear();
    this.tasks.clear();
    this.messages.clear();
  }

  getStats(): any {
    return {
      projects: this.projects.size,
      tasks: Array.from(this.tasks.values()).reduce((sum, m) => sum + m.size, 0),
      messages: Array.from(this.messages.values()).reduce((sum, arr) => sum + arr.length, 0),
    };
  }
}

/**
 * MockOllamaProvider - Simulates LLM generation
 */
export class MockOllamaProvider {
  private model: string;
  private callHistory: any[] = [];

  constructor(model: string = 'mistral:latest') {
    this.model = model;
  }

  async generate(prompt: string): Promise<string> {
    this.callHistory.push({ type: 'generate', prompt, timestamp: new Date() });
    // Return mock response based on prompt content
    if (prompt.includes('PROJECT_MANAGER')) {
      return `{
        "tasks": [
          { "taskId": "PM-001", "description": "Plan project", "estimatedHours": 2 },
          { "taskId": "PM-002", "description": "Design mockups", "estimatedHours": 4 }
        ],
        "questions": ["What technologies do you prefer?"],
        "blockers": []
      }`;
    }
    if (prompt.includes('FRONTEND')) {
      return `<!DOCTYPE html>
<html>
<head><title>Test App</title></head>
<body><h1>Generated Frontend</h1></body>
</html>`;
    }
    return `Mock response for: ${prompt.substring(0, 50)}...`;
  }

  async streamGenerate(prompt: string, onChunk: (chunk: string) => void): Promise<string> {
    const response = await this.generate(prompt);
    // Simulate streaming
    for (const char of response) {
      onChunk(char);
      await new Promise((r) => setTimeout(r, 1));
    }
    return response;
  }

  async generateCode(prompt: string): Promise<string> {
    this.callHistory.push({ type: 'generateCode', prompt, timestamp: new Date() });
    return 'function mockCode() { return "test"; }';
  }

  async analyzeCode(code: string): Promise<any> {
    this.callHistory.push({ type: 'analyzeCode', code, timestamp: new Date() });
    return { issues: [], suggestions: [] };
  }

  setModel(model: string): void {
    this.model = model;
  }

  getModel(): string {
    return this.model;
  }

  getCallHistory(): any[] {
    return this.callHistory;
  }

  clearHistory(): void {
    this.callHistory = [];
  }
}
