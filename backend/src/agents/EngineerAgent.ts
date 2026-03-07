import { OllamaService, type OllamaOptions } from '../services/OllamaService.js';
import { GeminiService } from '../services/GeminiService.js';
import { MessageParser } from '../services/MessageParser.js';
import { ParsedMessage, ConversationMessage } from '../models/types.js';

export class EngineerAgent {
  private generationService: OllamaService | GeminiService;
  private conversationHistory: ConversationMessage[] = [];

  private readonly systemPrompt = `You're a software engineer chatting with a project manager. Write like you're actually talking—use contractions (I'm, we'll, that's), short sentences, casual tone. Like you're on Slack or in a standup.

Give your honest take on the plan. If something looks good, say so. If you have concerns, raise them naturally. If you need clarification, just ask—like you would in a real conversation.

CRITICAL: Write each word only once. Never repeat words or phrases. Speak naturally as one person to another.

When you have questions, phrase them as actual questions (end with ?). When something could block progress, mention it—"One blocker:" or "Heads up:" before describing it. The system looks for lines ending in ? and "BLOCKER:" to parse your response.

## Effort Reality Check
These estimates are for AI code generation (much faster than manual coding). Check if the PM's estimates are realistic:
- Tasks should be 5-30 minutes each for straightforward code generation
- Total project: 15-60 minutes for simple apps
- If estimates seem too high (multiple hours for basic HTML/CSS/JS), they're wrong—push back

Start your message with:
**MESSAGE_TYPE:** CLARIFICATION_NEEDED (if you have questions) or PROGRESS_UPDATE (if you're good to go)
**TASK_ID:** N/A
**STATUS:** On Track (or At Risk / Blocked if needed)

Then just talk. Be helpful, not pedantic. Keep estimates realistic—don't add buffers. Keep it brief and conversational.`;

  constructor(service: OllamaService | GeminiService) {
    this.generationService = service;
  }

  /**
   * Process project manager's plan and provide engineer perspective
   */
  async respondToProjectPlan(
    pmMessage: string,
    onChunk?: (chunk: string) => void
  ): Promise<ParsedMessage> {
    const prompt = this.buildInitialPrompt(pmMessage);

    let fullResponse = '';

    console.log('Engineer Agent: Analyzing project plan...');

    await this.generationService.streamGenerate(prompt, (chunk) => {
      fullResponse += chunk;
      process.stdout.write(chunk);
      if (onChunk) onChunk(chunk);
    });

    console.log('\n');

    const parsed = MessageParser.parseMessage(fullResponse, 'ENGINEER');

    // Add to conversation history
    this.conversationHistory.push({
      fromAgent: 'PROJECT_MANAGER',
      toAgent: 'ENGINEER',
      messageType: 'PROJECT_PLAN',
      content: pmMessage,
    });

    this.conversationHistory.push({
      fromAgent: 'ENGINEER',
      toAgent: 'PROJECT_MANAGER',
      messageType: parsed.messageType,
      content: fullResponse,
      metadata: {
        questions: parsed.questions,
        blockers: parsed.blockers,
      },
    });

    return parsed;
  }

  /**
   * Respond to PM's follow-up or clarifications
   */
  async respondToProjectManager(
    pmMessage: string,
    onChunk?: (chunk: string) => void
  ): Promise<ParsedMessage> {
    // Add PM message to history
    this.conversationHistory.push({
      fromAgent: 'PROJECT_MANAGER',
      toAgent: 'ENGINEER',
      messageType: 'TASK_ASSIGNMENT',
      content: pmMessage,
    });

    const prompt = this.buildFollowUpPrompt(pmMessage);

    let fullResponse = '';

    console.log('Engineer Agent: Processing PM response...');

    await this.generationService.streamGenerate(prompt, (chunk) => {
      fullResponse += chunk;
      process.stdout.write(chunk);
      if (onChunk) onChunk(chunk);
    });

    console.log('\n');

    const parsed = MessageParser.parseMessage(fullResponse, 'ENGINEER');

    this.conversationHistory.push({
      fromAgent: 'ENGINEER',
      toAgent: 'PROJECT_MANAGER',
      messageType: parsed.messageType,
      content: fullResponse,
      metadata: {
        questions: parsed.questions,
        blockers: parsed.blockers,
      },
    });

    return parsed;
  }

  /**
   * Build the initial prompt for analyzing the project plan
   */
  private buildInitialPrompt(pmMessage: string): string {
    return `${this.systemPrompt}

The PM just shared this plan:

---
${pmMessage}
---

Reply like you're in the chat. What do you think? Any questions? Concerns? Or does it look good to go?`;
  }

  /**
   * Build prompt for follow-up responses
   */
  private buildFollowUpPrompt(pmMessage: string): string {
    return `You're an engineer in a planning chat. The PM just replied:

"${pmMessage}"

Respond like a human. If they answered your questions and you're good, say so—keep it short. If something's still unclear or blocking, mention it. Write each word only once. Use the MESSAGE_TYPE header at the start.`;
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
