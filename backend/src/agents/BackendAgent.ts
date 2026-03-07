import { OllamaService, type OllamaOptions } from '../services/OllamaService.js';
import { GeminiService } from '../services/GeminiService.js';
import { MessageBus } from '../services/MessageBus.js';
import type { ConversationMessage } from '../models/types.js';
import type { ResearchOutput } from './ResearchAgent.js';
import { BaseAgent } from './BaseAgent.js';

export class BackendAgent extends BaseAgent {
  private generationService: OllamaService | GeminiService;
  private conversationHistory: ConversationMessage[] = [];

  private readonly systemPrompt = `You are an Expert Backend Developer building production-ready APIs and databases.

CRITICAL: Generate COMPLETE, FULLY FUNCTIONAL backend code.

YOUR REQUIREMENTS:
1. Generate complete working code (Node.js/Express by default)
2. Implement ALL endpoints/features mentioned in requirements
3. Complete database schema with relationships
4. Input validation and error handling
5. Authentication/authorization if needed
6. CORS configuration
7. Environment variable management (.env example)
8. Proper HTTP status codes and error responses
9. API documentation comments
10. Database migrations or setup instructions

OUTPUT FORMAT:
Provide the code in logical sections with clear comments:
1. Dependencies/imports
2. Database connection and setup
3. Database schema/models
4. Middleware setup
5. API endpoints (grouped by resource)
6. Error handling
7. Server startup

Start with a comment block explaining the setup and how to run the code.
Include example API calls in comments.

MAKE IT PRODUCTION-READY:
- No hardcoded values (use .env)
- Proper error handling and validation
- Security best practices
- Clean, maintainable code
- All features fully implemented`;

  constructor(
    agentId: string,
    messageBus: MessageBus,
    service: OllamaService | GeminiService
  ) {
    super(
      {
        agentId,
        agentType: 'BACKEND',
        capabilities: ['nodejs', 'express', 'typescript', 'restapi', 'database', 'postgres', 'mongodb']
      },
      messageBus
    );
    this.generationService = service;
  }

  /**
   * Generate complete backend code
   */
  async generateCode(
    userRequest: string,
    researchOutput: ResearchOutput,
    onProgress?: (message: string) => void
  ): Promise<string> {
    const prompt = this.buildPrompt(userRequest, researchOutput);

    if (onProgress) onProgress('Backend Agent: Generating complete API...');
    console.log('[BACKEND_AGENT] Generating backend code...');

    try {
      const response = await this.generationService.generate(prompt);

      console.log('[BACKEND_AGENT] Backend code generation complete');

      // Extract code from markdown blocks if present
      let code = response;
      const codeMatch = response.match(/```(?:javascript|js|typescript|ts)?\n?([\s\S]*?)\n?```/);
      if (codeMatch) {
        code = codeMatch[1].trim();
      }

      if (onProgress) onProgress('Backend Agent: Code generation complete');

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
        messageType: 'IMPLEMENTATION_COMPLETE',
        content: response,
        codeOutput: code,
      });

      return code;
    } catch (error) {
      console.error('[BACKEND_AGENT] Error during code generation:', error);
      if (onProgress) onProgress(`Backend Agent: Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Build the code generation prompt
   */
  private buildPrompt(userRequest: string, researchOutput: ResearchOutput): string {
    let prompt = this.systemPrompt;

    prompt += `\n\nPROJECT REQUEST:
${userRequest}

REQUIREMENTS TO IMPLEMENT:`;

    // Add functional requirements
    if (researchOutput.requirements.functional.length > 0) {
      prompt += '\n\nFUNCTIONAL:';
      researchOutput.requirements.functional.forEach((req) => {
        prompt += `\n- ${req}`;
      });
    }

    // Add non-functional requirements
    if (researchOutput.requirements.nonFunctional.length > 0) {
      prompt += '\n\nNON-FUNCTIONAL:';
      researchOutput.requirements.nonFunctional.forEach((req) => {
        prompt += `\n- ${req}`;
      });
    }

    // Add success criteria
    if (researchOutput.successCriteria.length > 0) {
      prompt += '\n\nSUCCESS CRITERIA (ALL must be met):';
      researchOutput.successCriteria.forEach((criteria) => {
        prompt += `\n- ${criteria}`;
      });
    }

    // Add tech stack info
    if (researchOutput.techStack.backend && researchOutput.techStack.backend.length > 0) {
      prompt += `\n\nTECH STACK: ${researchOutput.techStack.backend.join(', ')}`;
    }
    if (researchOutput.techStack.database && researchOutput.techStack.database.length > 0) {
      prompt += `\nDATABASE: ${researchOutput.techStack.database.join(', ')}`;
    }

    // Add architecture patterns
    if (researchOutput.architecturePatterns.length > 0) {
      prompt += `\nARCHITECTURE: ${researchOutput.architecturePatterns.join(', ')}`;
    }

    prompt += '\n\nIMPLEMENT ALL ENDPOINTS AND FEATURES. Make it production-ready. Generate the complete backend code now:';

    return prompt;
  }

  /**
   * Phase A3: Execute task for autonomous agent execution
   * Implement backend code generation for a given task
   */
  async executeTask(task: any, context?: any): Promise<any> {
    try {
      this.emitProgress(task.id, '', 0, 'Starting backend generation');

      const researchOutput = task.researchOutput || {
        features: task.description ? [task.description] : [],
        techStack: { backend: ['nodejs', 'express'] },
        successCriteria: []
      };

      const designBrief = task.designBrief || '';

      this.emitProgress(task.id, '', 25, 'Generating backend code');

      const code = await this.generateCode(
        task.description || 'Backend service',
        researchOutput,
        (msg) => console.log('[BackendAgent]', msg)
      );

      this.emitProgress(task.id, '', 100, 'Backend code generation complete');

      return {
        success: true,
        generatedCode: code,
        language: 'javascript',
        type: 'backend',
        runtime: 'nodejs'
      };
    } catch (error) {
      console.error('[BackendAgent] Error executing task:', error);
      throw error;
    }
  }
}
