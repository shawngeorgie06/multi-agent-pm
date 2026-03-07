import { OllamaService, type OllamaOptions } from '../services/OllamaService.js';
import { GeminiService } from '../services/GeminiService.js';
import { MessageBus } from '../services/MessageBus.js';
import type { ConversationMessage } from '../models/types.js';
import { BaseAgent } from './BaseAgent.js';

export interface ResearchOutput {
  projectType: 'web' | 'fullstack' | 'api' | 'mobile';
  techStack: {
    frontend?: string[];
    backend?: string[];
    database?: string[];
    testing?: string[];
  };
  architecturePatterns: string[];
  requirements: {
    functional: string[];
    nonFunctional: string[];
  };
  successCriteria: string[];
  summary?: string;
}

export class ResearchAgent extends BaseAgent {
  private generationService: OllamaService | GeminiService;
  private conversationHistory: ConversationMessage[] = [];

  private readonly systemPrompt = `You are a Senior Technical Architect researching project requirements.

Your role is to:
1. Analyze the project description and requirements
2. Classify the project type (web/fullstack/api/mobile)
3. Recommend the best tech stack
4. Identify appropriate architecture patterns
5. Extract and list functional and non-functional requirements
6. Define clear success criteria

Be thorough and professional. Consider scalability, maintainability, and best practices.

Format your response as structured JSON with this exact format:
{
  "projectType": "web|fullstack|api|mobile",
  "techStack": {
    "frontend": ["Technology1", "Technology2"],
    "backend": ["Technology1", "Technology2"],
    "database": ["Technology1"],
    "testing": ["Technology1", "Technology2"]
  },
  "architecturePatterns": ["Pattern1", "Pattern2"],
  "requirements": {
    "functional": ["Requirement 1", "Requirement 2", "Requirement 3"],
    "nonFunctional": ["Requirement 1", "Requirement 2"]
  },
  "successCriteria": ["Criteria 1", "Criteria 2", "Criteria 3"],
  "summary": "Brief executive summary of the project"
}`;

  constructor(
    agentId: string,
    messageBus: MessageBus,
    service: OllamaService | GeminiService
  ) {
    super(
      {
        agentId,
        agentType: 'RESEARCH',
        capabilities: ['research', 'analysis', 'architecture']
      },
      messageBus
    );
    this.generationService = service;
  }

  /**
   * Analyze project requirements and generate research output
   */
  async analyzeProject(userRequest: string, existingTasks?: string[]): Promise<ResearchOutput> {
    const prompt = this.buildPrompt(userRequest, existingTasks);

    console.log('[RESEARCH_AGENT] Analyzing project requirements...');

    try {
      const response = await this.generationService.generate(prompt);

      console.log('[RESEARCH_AGENT] Analysis complete, parsing response...');

      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[RESEARCH_AGENT] Failed to extract JSON from response');
        return this.getFallbackResearch(userRequest);
      }

      try {
        const parsed = JSON.parse(jsonMatch[0]);

        // Validate and normalize the output
        const research: ResearchOutput = {
          projectType: this.normalizeProjectType(parsed.projectType),
          techStack: {
            frontend: Array.isArray(parsed.techStack?.frontend) ? parsed.techStack.frontend : [],
            backend: Array.isArray(parsed.techStack?.backend) ? parsed.techStack.backend : [],
            database: Array.isArray(parsed.techStack?.database) ? parsed.techStack.database : [],
            testing: Array.isArray(parsed.techStack?.testing) ? parsed.techStack.testing : [],
          },
          architecturePatterns: Array.isArray(parsed.architecturePatterns) ? parsed.architecturePatterns : [],
          requirements: {
            functional: Array.isArray(parsed.requirements?.functional) ? parsed.requirements.functional : [],
            nonFunctional: Array.isArray(parsed.requirements?.nonFunctional) ? parsed.requirements.nonFunctional : [],
          },
          successCriteria: Array.isArray(parsed.successCriteria) ? parsed.successCriteria : [],
          summary: typeof parsed.summary === 'string' ? parsed.summary : undefined,
        };

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
          messageType: 'STATUS_CHECK',
          content: response,
          metadata: { research },
        });

        console.log(`[RESEARCH_AGENT] Project type: ${research.projectType}`);
        console.log(`[RESEARCH_AGENT] Tech stack: Frontend=[${research.techStack.frontend?.join(', ')}], Backend=[${research.techStack.backend?.join(', ')}]`);
        console.log(`[RESEARCH_AGENT] Requirements: ${research.requirements.functional.length} functional, ${research.requirements.nonFunctional.length} non-functional`);

        return research;
      } catch (parseError) {
        console.error('[RESEARCH_AGENT] Failed to parse JSON:', parseError);
        return this.getFallbackResearch(userRequest);
      }
    } catch (error) {
      console.error('[RESEARCH_AGENT] Error during analysis:', error);
      return this.getFallbackResearch(userRequest);
    }
  }

  /**
   * Build the analysis prompt
   */
  private buildPrompt(userRequest: string, existingTasks?: string[]): string {
    let prompt = `${this.systemPrompt}

PROJECT DESCRIPTION:
${userRequest}`;

    if (existingTasks && existingTasks.length > 0) {
      prompt += `\n\nEXISTING TASKS:
${existingTasks.join('\n')}`;
    }

    prompt += `\n\nProvide a comprehensive technical analysis in the specified JSON format.`;

    return prompt;
  }

  /**
   * Normalize project type to valid values
   */
  private normalizeProjectType(type: string): 'web' | 'fullstack' | 'api' | 'mobile' {
    const normalized = type?.toLowerCase() || '';
    if (normalized.includes('full') || normalized.includes('backend') || normalized.includes('database')) {
      return 'fullstack';
    }
    if (normalized.includes('api') || normalized.includes('server')) {
      return 'api';
    }
    if (normalized.includes('mobile') || normalized.includes('react-native') || normalized.includes('flutter')) {
      return 'mobile';
    }
    return 'web'; // Default
  }

  /**
   * Provide fallback research when analysis fails
   */
  private getFallbackResearch(userRequest: string): ResearchOutput {
    console.log('[RESEARCH_AGENT] Using fallback research');

    const isFullstack = /api|backend|database|server/i.test(userRequest);
    const isMobile = /mobile|react-native|flutter/i.test(userRequest);
    const isAPI = /api|rest|graphql/i.test(userRequest) && !isFullstack;

    let projectType: 'web' | 'fullstack' | 'api' | 'mobile' = 'web';
    if (isMobile) projectType = 'mobile';
    else if (isFullstack) projectType = 'fullstack';
    else if (isAPI) projectType = 'api';

    return {
      projectType,
      techStack: {
        frontend: projectType !== 'api' ? ['HTML/CSS/JavaScript'] : [],
        backend: projectType !== 'web' ? ['Node.js/Express'] : [],
        database: projectType !== 'web' ? ['SQLite'] : [],
        testing: ['Jest', 'Cypress'],
      },
      architecturePatterns: projectType === 'fullstack' ? ['REST API', 'MVC'] : projectType === 'api' ? ['REST API'] : ['Single Page Application'],
      requirements: {
        functional: [
          'Core functionality implementation',
          'User interface/API endpoints',
          'Data persistence/storage',
        ],
        nonFunctional: [
          'Performance optimization',
          'Security best practices',
          'Accessibility standards',
        ],
      },
      successCriteria: [
        'All features implemented',
        'Code is functional',
        'Responsive/robust',
      ],
      summary: `${projectType.charAt(0).toUpperCase() + projectType.slice(1)} project requiring ${projectType === 'fullstack' ? 'both frontend and backend' : projectType === 'api' ? 'backend API' : projectType === 'mobile' ? 'mobile' : 'frontend'} development`,
    };
  }

  /**
   * Phase A3: Execute task for autonomous agent execution
   */
  async executeTask(task: any, context?: any): Promise<any> {
    try {
      this.emitProgress(task.id, '', 0, 'Starting research analysis');

      this.emitProgress(task.id, '', 50, 'Analyzing requirements');

      const research = await this.analyzeProject(
        task.description || 'Research'
      );

      this.emitProgress(task.id, '', 100, 'Research analysis complete');

      return {
        success: true,
        researchOutput: research,
        language: 'json',
        type: 'research'
      };
    } catch (error) {
      console.error('[ResearchAgent] Error executing task:', error);
      throw error;
    }
  }
}
