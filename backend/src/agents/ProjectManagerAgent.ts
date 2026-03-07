import { OllamaService, type OllamaOptions } from '../services/OllamaService.js';
import { GeminiService } from '../services/GeminiService.js';
import { MessageParser } from '../services/MessageParser.js';
import { ParsedMessage, ConversationMessage } from '../models/types.js';

export class ProjectManagerAgent {
  private generationService: OllamaService | GeminiService;
  private conversationHistory: ConversationMessage[] = [];

  private readonly systemPrompt = `You're a project manager chatting with an engineer. Write like you're actually talking—use contractions (I'm, we'll, that's), short sentences, and a friendly tone. No corporate speak or stiff formality.

CRITICAL INSTRUCTIONS:
1. Start with: **MESSAGE_TYPE:** PROJECT_PLAN, **TASK_ID:** N/A, **STATUS:** In Progress
2. Begin with a natural opener ("Alright, here's how I'd tackle this..." or "Got it, let me break this down...")
3. THEN provide EXACTLY 3 tasks in this format (DO NOT SKIP THIS):

Subtask 1: [Task Name]
Effort: [X] minutes
Priority: [HIGH|MEDIUM|LOW]
Dependencies: None
Acceptance Criteria: [1-2 clear criteria]

---

Subtask 2: [Task Name]
Effort: [X] minutes
Priority: [HIGH|MEDIUM|LOW]
Dependencies: Subtask 1
Acceptance Criteria: [criteria]

---

Subtask 3: [Task Name]
Effort: [X] minutes
Priority: [HIGH|MEDIUM|LOW]
Dependencies: Subtask 1, Subtask 2
Acceptance Criteria: [criteria]

---

4. After tasks, add any questions you have in natural language
5. Write each word only once - no repetition

## Effort Estimation (AI Code Gen, NOT manual work)
- **HTML structure (forms, buttons, divs)**: 10-15 minutes
- **CSS styling (colors, layout, spacing)**: 10-15 minutes
- **JavaScript logic (calculator, form handlers)**: 10-15 minutes
- **API integration**: 15-30 minutes
- **Complex features**: 30-60 minutes

**Most web projects should be 30-60 minutes TOTAL, not hours.**

## EXAMPLE for Calculator App:

Subtask 1: Build HTML structure with buttons and display
Effort: 10 minutes
Priority: HIGH
Dependencies: None
Acceptance Criteria: Calculator layout with 0-9 buttons and display field visible

---

Subtask 2: Style with CSS for clean appearance
Effort: 10 minutes
Priority: MEDIUM
Dependencies: Subtask 1
Acceptance Criteria: Buttons styled, display field formatted, responsive design

---

Subtask 3: Implement JavaScript calculation logic
Effort: 15 minutes
Priority: HIGH
Dependencies: Subtask 1, Subtask 2
Acceptance Criteria: Basic math operations work, display updates correctly, clearing works`;

  constructor(service: OllamaService | GeminiService) {
    this.generationService = service;
  }

  /**
   * Process user input and generate project plan with error handling
   */
  async generateProjectPlan(
    userRequest: string,
    onChunk?: (chunk: string) => void,
    designBrief?: string
  ): Promise<ParsedMessage> {
    const prompt = this.buildPrompt(userRequest, designBrief);

    let fullResponse = '';

    console.log('[PM_AGENT] Processing request...');

    try {
      // Stream the response for real-time updates
      await this.generationService.streamGenerate(prompt, (chunk) => {
        fullResponse += chunk;
        process.stdout.write(chunk);
        if (onChunk) onChunk(chunk);
      });

      console.log('\n[PM_AGENT] Response received, parsing...');

      // Parse the response
      const parsed = MessageParser.parseMessage(fullResponse, 'PROJECT_MANAGER');

      if (!parsed.tasks || parsed.tasks.length === 0) {
        console.warn('[PM_AGENT] Response parsed but no tasks extracted');
      }

      // Add to conversation history
      this.conversationHistory.push({
        fromAgent: 'USER',
        toAgent: 'PROJECT_MANAGER',
        messageType: 'PROJECT_PLAN',
        content: userRequest,
      });

      this.conversationHistory.push({
        fromAgent: 'PROJECT_MANAGER',
        toAgent: 'ENGINEER',
        messageType: parsed.messageType,
        content: fullResponse,
        metadata: {
          tasks: parsed.tasks,
          questions: parsed.questions,
        },
      });

      return parsed;
    } catch (error) {
      console.error('[PM_AGENT] Error during generateProjectPlan:', error);
      // Return empty response to trigger retry logic in orchestrator
      return {
        messageType: 'PROJECT_PLAN',
        taskId: undefined,
        content: fullResponse || 'Error: No response received from Ollama',
        tasks: [],
        questions: [],
        blockers: [],
        codeOutput: undefined,
      };
    }
  }

  /**
   * Process engineer response and generate follow-up with error handling
   */
  async respondToEngineer(
    engineerMessage: string,
    onChunk?: (chunk: string) => void
  ): Promise<ParsedMessage> {
    // Add engineer message to history
    this.conversationHistory.push({
      fromAgent: 'ENGINEER',
      toAgent: 'PROJECT_MANAGER',
      messageType: 'CLARIFICATION_NEEDED',
      content: engineerMessage,
    });

    // Generate response considering conversation history
    const prompt = this.buildFollowUpPrompt(engineerMessage);

    let fullResponse = '';

    console.log('[PM_AGENT] Responding to engineer...');

    try {
      await this.generationService.streamGenerate(prompt, (chunk) => {
        fullResponse += chunk;
        process.stdout.write(chunk);
        if (onChunk) onChunk(chunk);
      });

      console.log('\n[PM_AGENT] Response received, parsing...');

      const parsed = MessageParser.parseMessage(fullResponse, 'PROJECT_MANAGER');

      this.conversationHistory.push({
        fromAgent: 'PROJECT_MANAGER',
        toAgent: 'ENGINEER',
        messageType: parsed.messageType,
        content: fullResponse,
        metadata: {
          tasks: parsed.tasks,
          questions: parsed.questions,
        },
      });

      return parsed;
    } catch (error) {
      console.error('[PM_AGENT] Error during respondToEngineer:', error);
      // Return minimal response to allow conversation to continue
      return {
        messageType: 'CLARIFICATION_RESPONSE',
        taskId: undefined,
        content: fullResponse || 'Error: No response received from Ollama',
        tasks: [],
        questions: [],
        blockers: [],
        codeOutput: undefined,
      };
    }
  }

  /**
   * Build the prompt for the Ollama model
   */
  private buildPrompt(userRequest: string, designBrief?: string): string {
    const designContext = designBrief
      ? `\n\n## Design Direction (from Design Director)\n${designBrief}\n\nConsider this when planning tasks - we have Layout, Styling, and Logic specialists who will implement.`
      : '';
    return `${this.systemPrompt}

Someone just asked for: "${userRequest}"${designContext}

Reply like you're in a planning chat. Break it down naturally, then include the structured task list.

IMPORTANT: For interactive UIs (calculator, todo app, forms with buttons, etc.), you MUST include a subtask for "Implement JavaScript logic" or "Add interactivity" so the buttons/inputs actually work. Never create only HTML structure + styling without a task for the JavaScript behavior.

For web UIs, structure your subtasks as: (1) HTML structure/layout, (2) CSS styling, (3) JavaScript logic/interactivity.`;
  }

  /**
   * Build a follow-up prompt based on conversation history
   */
  private buildFollowUpPrompt(engineerMessage: string): string {
    return `You're a PM in a casual chat with an engineer. They said:

"${engineerMessage}"

Reply like a human—brief and friendly. If they asked questions, answer them. If they raised concerns, address them. If everything looks good, just say so and we move on. Write each word only once.

Always start your message with:
**MESSAGE_TYPE:** CLARIFICATION_RESPONSE
**TASK_ID:** N/A
**STATUS:** On Track

Then write your actual response naturally.`;
  }

  /**
   * Get conversation history
   */
  getConversationHistory(): ConversationMessage[] {
    return this.conversationHistory;
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Set the model
   */
  setModel(model: string): void {
    this.generationService.setModel(model);
  }
}
