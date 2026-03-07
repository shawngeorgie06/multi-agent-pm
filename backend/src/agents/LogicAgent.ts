import { OllamaService, type OllamaOptions } from '../services/OllamaService.js';
import { GeminiService } from '../services/GeminiService.js';
import { MessageBus } from '../services/MessageBus.js';
import type { DesignBrief } from './DesignDirectorAgent.js';
import { detectTemplate } from '../templates/utils.js';
import { BaseAgent } from './BaseAgent.js';

export class LogicAgent extends BaseAgent {
  private generationService: OllamaService | GeminiService;

  constructor(
    agentId: string,
    messageBus: MessageBus,
    service: OllamaService | GeminiService
  ) {
    super(
      {
        agentId,
        agentType: 'LOGIC',
        capabilities: ['javascript', 'event-handling', 'state-management']
      },
      messageBus
    );
    this.generationService = service;
  }

  /**
   * Generate JavaScript for interactivity and behavior.
   * Uses design tokens to target the correct elements.
   */
  async generateLogic(
    projectDescription: string,
    designBrief: DesignBrief,
    htmlStructure: string,
    taskContext?: string
  ): Promise<string> {
    // Try to detect a matching template from the registry
    const template = detectTemplate(projectDescription);
    if (template) {
      return template.js;
    }

    // Extract element IDs from HTML for reference
    const elementIds = this.extractElementIds(htmlStructure);

    const prompt = `You are a Logic Specialist. You create JavaScript that makes interactive UIs work.

## Project
${projectDescription}

## HTML Structure (examine CAREFULLY to find all element IDs and onclick attributes)
${htmlStructure || 'No HTML provided yet'}

## Element IDs Found in HTML (USE ONLY THESE IDs - DO NOT INVENT NEW ONES)
${elementIds.length > 0 ? elementIds.map(id => `- ${id}`).join('\n') : 'ERROR: No IDs found - check HTML structure'}

## Task
${taskContext || 'Implement interactivity'}

## STEP 1: IDENTIFY APP TYPE AND REQUIRED FUNCTIONALITY
Analyze what type of app this is and what complete functionality it needs:
- Calculator → implement: number input, all math operations (+,-,*,/,=), clear, delete, decimal handling, order of operations
- Todo List → implement: add items, delete items, mark complete, clear all, persist state, handle empty input
- Contact Form → implement: validation, submit, clear, error messages, success feedback
- Timer → implement: start/stop/pause, reset, lap times, time formatting

## STEP 2: MAP EVERY ELEMENT TO ITS FUNCTION
Go through the Element IDs list above and plan what each element does:
- Which elements are inputs/displays that hold data?
- Which elements are buttons that trigger actions?
- What happens when each button is clicked?
- How do elements interact with each other?

## STEP 3: IMPLEMENT COMPLETE, WORKING LOGIC
Write JavaScript that makes EVERY element functional. No element should be inactive.

## CRITICAL INSTRUCTIONS - READ CAREFULLY
1. Output ONLY JavaScript - no <script> tags, no HTML, no markdown code blocks, no explanations
2. **YOU MUST USE ONLY THE IDs LISTED ABOVE** - DO NOT use getElementById with any ID not in that list
3. **FORBIDDEN:** Do NOT reference IDs like "todo-input", "add-btn", "clear-btn", "todo-list" or ANY ID unless it's explicitly listed in "Element IDs Found in HTML" above
4. Write event handlers for EVERY button and interactive element you see in the HTML - no element should be non-functional
5. If the HTML has onclick="functionName()", you MUST define that function
6. Implement complete, working logic - NO placeholders, NO TODOs, NO stubs, NO console.log("implement this later")
7. For calculators: implement proper calculation logic with order of operations, handle decimals, handle errors (divide by zero)
8. For todo apps: implement add/delete/clear with proper DOM manipulation, handle edge cases (empty input)
9. Before writing ANY getElementById, verify that exact ID exists in the "Element IDs Found in HTML" list above
10. Test logic mentally: would this code actually work if run in a browser? If no, fix it before outputting

**VALIDATION STEP:** Before you write any code:
1. List out which IDs you will use and confirm each one exists in the HTML IDs list above
2. Plan what each button/element does
3. Ensure your logic handles all user interactions completely

MANDATORY:
- Every button in the HTML must have a working event handler using ONLY the IDs that actually exist in the HTML
- The application must be fully functional - user can perform ALL intended actions
- No broken functionality or unimplemented features`;

    const response = await this.generationService.generate(prompt);
    return this.extractCode(response);
  }

  /**
   * Extract element IDs from HTML for better context
   */
  private extractElementIds(html: string): string[] {
    const idMatches = html.match(/id="([^"]+)"/g) || [];
    return idMatches.map(match => match.replace(/id="|"/g, ''));
  }

  private extractCode(response: string): string {
    const match = response.match(/\`\`\`[\w]*\n([\s\S]*?)\n\`\`\`/);
    return match ? match[1].trim() : response.trim();
  }

  /**
   * Phase A3: Execute task for autonomous agent execution
   */
  async executeTask(task: any, context?: any): Promise<any> {
    try {
      this.emitProgress(task.id, '', 0, 'Starting logic generation');

      const designBrief = task.designBrief || { colors: [], fonts: [] };

      // Get HTML from LAYOUT agent if available
      const htmlStructure = context?.layoutHTML || '';

      console.log(`[LogicAgent] Received HTML structure: ${htmlStructure ? htmlStructure.length + ' chars' : 'NONE'}`);

      this.emitProgress(task.id, '', 50, 'Generating logic based on HTML structure');

      const logic = await this.generateLogic(
        task.description || 'Logic',
        designBrief,
        htmlStructure,
        task.context
      );

      this.emitProgress(task.id, '', 100, 'Logic generation complete');

      return {
        success: true,
        generatedCode: logic,
        language: 'javascript',
        type: 'logic'
      };
    } catch (error) {
      console.error('[LogicAgent] Error executing task:', error);
      throw error;
    }
  }
}
