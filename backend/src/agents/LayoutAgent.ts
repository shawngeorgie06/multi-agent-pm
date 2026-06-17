import type { AIService } from '../services/AIService.js';
import { MessageBus } from '../services/MessageBus.js';
import type { DesignBrief } from './DesignDirectorAgent.js';
import type { ResearchOutput } from './ResearchAgent.js';
import { CodeValidationService } from '../services/CodeValidationService.js';
import { BaseAgent } from './BaseAgent.js';
import { stripCodeFences } from '../utils/codeExtraction.js';

export class LayoutAgent extends BaseAgent {
  private generationService: AIService;

  constructor(
    agentId: string,
    messageBus: MessageBus,
    service: AIService
  ) {
    super(
      {
        agentId,
        agentType: 'LAYOUT',
        capabilities: ['html', 'semantic-html', 'accessibility', 'responsive-design']
      },
      messageBus
    );
    this.generationService = service;
  }

  /**
   * Generate HTML structure with semantics and accessibility.
   * Uses design tokens for consistent IDs/classes.
   */
  async generateLayout(
    projectDescription: string,
    designBrief: DesignBrief,
    taskContext?: string
  ): Promise<string> {
    // Always generate custom HTML purely from the project requirements (no templates).
    const prompt = `You are a Layout Specialist. You create HTML structure with semantic markup and all required elements.

## Project Requirements
${projectDescription}

## Design Brief (follow these tokens for IDs and classes)
${designBrief.raw}

## Design Tokens (use exactly these IDs/classes)
${designBrief.designTokens}

## Task Context
${taskContext || 'Create the main structure'}

## STEP 1: ANALYZE WHAT APP TYPE THIS IS
Before writing ANY code, identify what type of application this is and list ALL components it needs:
- Calculator → needs: display, numbers 0-9, operations (+,-,*,/), equals (=), clear, delete/backspace, decimal point
- Todo List → needs: input field, add button, todo list container, delete buttons, clear all button
- Contact Form → needs: name input, email input, message textarea, submit button, validation messages
- Timer/Stopwatch → needs: time display, start button, pause button, reset button, lap button
- Weather App → needs: location input, search button, weather display area, temperature, conditions, icon
- Shopping Cart → needs: product list, add to cart buttons, cart display, quantity controls, total price, checkout button

## STEP 2: CREATE COMPLETE ELEMENT LIST
List EVERY single element needed for the app to be fully functional. Do NOT skip any elements. Think about:
- What the user needs to INPUT (text fields, buttons, selections)
- What the user needs to SEE (displays, results, lists)
- What ACTIONS the user can take (every button/control needed)

## STEP 3: GENERATE COMPLETE HTML
Now create the HTML with EVERY element from your list.

## CRITICAL INSTRUCTIONS - READ CAREFULLY
1. Output ONLY complete HTML document (<!DOCTYPE html>, <html>, <head>, <body>) — no placeholders, no TODOs.
2. **EXTRACT EXACT IDs FROM PROJECT REQUIREMENTS** - If the requirements say 'id="todo-input"', you MUST use that exact ID
3. **SCAN FOR REQUIRED IDs** - Look for patterns like 'id="xxx"' or 'element with id xxx' in the project description and use those EXACT IDs
4. **GENERATE COMPLETE, WORKING APP** - Include EVERY button, input, and display element needed for full functionality
5. For calculators: MUST include all number buttons (0-9), ALL operation buttons (+, -, *, /, =), clear, delete, decimal point, and display
6. For todo apps: MUST include input field, add button, list container, and delete/clear functionality
7. Use semantic HTML: <main>, <section>, <button>, <input>, <ul>, <li>
8. Add aria-labels on inputs for accessibility
9. NEVER link external files (<link>, <script src=>, etc) - all CSS/JS embedded
10. NEVER include <style> or <script> tags - CSS and JS will be injected separately
11. Output raw HTML only - no markdown code blocks, no external references
12. The app must be FULLY FUNCTIONAL when combined with CSS and JavaScript - don't skip any elements

**MOST IMPORTANT:**
1. Generate a COMPLETE application with ALL necessary elements - partial implementations are NOT acceptable
2. Before creating any element, check if the project requirements specify an exact ID for it. If yes, use that EXACT ID.
3. Every button, input, and interactive element the user will need MUST be present in the HTML

Examples:
- Requirement says "input field (id=\"todo-input\")" → Use id="todo-input" exactly
- Requirement says "submit button (id=\"add-btn\")" → Use id="add-btn" exactly
- Calculator app → MUST include buttons: 0,1,2,3,4,5,6,7,8,9,+,-,*,/,=,C,DEL,. and a display field
- Todo app → MUST include: input field, add button, todo list container, delete buttons for each item`;


    const response = await this.generationService.generate(prompt);
    return this.extractCode(response);
  }

  private extractCode(response: string): string {
    return stripCodeFences(response);
  }

  /**
   * Direct code generation method (called from AgentOrchestrator)
   */
  async generateCode(
    projectDescription: string,
    research: ResearchOutput,
    context: any = {},
    callback?: (message: string) => void
  ): Promise<string> {
    if (callback) callback('Generating HTML structure…');

    const designBrief: DesignBrief = context.designBrief || {
      aesthetic: 'modern',
      typography: 'system fonts',
      colorPalette: '#ffffff background, #000000 text',
      motionAndEffects: 'smooth transitions',
      designTokens: '{}',
      raw: ''
    };

    const layout = await this.generateLayout(
      projectDescription,
      designBrief,
      `Functional requirements: ${(context.requirements || []).join(', ')}`
    );

    if (callback) callback('HTML structure complete');

    return layout;
  }

  /**
   * Validate HTML completeness
   */
  protected async validateOutput(
    generatedCode: string,
    task: any,
    context: any
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    // Handle both cases: requirements already in array form, or nested in object
    let requirements = context?.requirements;
    if (requirements && typeof requirements === 'object' && !Array.isArray(requirements)) {
      requirements = requirements.functional || [];
    }

    // If no requirements available (autonomous execution), skip detailed validation
    if (!requirements || !Array.isArray(requirements) || requirements.length === 0) {
      return {
        isValid: true,
        errors: [],
        warnings: ['No requirements available for validation (autonomous execution)', 'Skipping detailed completeness checks']
      };
    }

    return CodeValidationService.validateLayoutCompleteness(generatedCode, requirements);
  }

  /**
   * Retry with feedback about missing elements
   */
  protected async retryWithFeedback(
    task: any,
    context: any,
    errors: string[]
  ): Promise<any> {
    console.log('[LayoutAgent] Retrying with feedback about missing elements');

    const designBrief: DesignBrief = task.designBrief || {
      aesthetic: 'modern',
      typography: 'system fonts',
      colorPalette: '#ffffff background, #000000 text',
      motionAndEffects: 'smooth transitions',
      designTokens: '{}',
      raw: ''
    };

    const errorFeedback = `Previous generation was incomplete. Missing elements: ${errors.join(', ')}. Ensure ALL required elements are included in the final HTML.`;

    const layout = await this.generateLayout(
      task.description || 'Layout',
      designBrief,
      `${task.context || ''}\n\nIMPORTANT FEEDBACK: ${errorFeedback}`
    );

    return {
      success: true,
      generatedCode: layout,
      language: 'html',
      type: 'layout'
    };
  }

  /**
   * Phase A3: Execute task for autonomous agent execution
   */
  async executeTask(task: any, context?: any): Promise<any> {
    try {
      this.emitProgress(task.id, '', 0, 'Starting layout generation');

      const designBrief = task.designBrief || { colors: [], fonts: [] };

      this.emitProgress(task.id, '', 50, 'Generating layout');

      const layout = await this.generateLayout(
        task.description || 'Layout',
        designBrief,
        this.appendValidationFeedback(task.context, context)
      );

      this.emitProgress(task.id, '', 100, 'Layout generation complete');

      return {
        success: true,
        generatedCode: layout,
        language: 'html',
        type: 'layout'
      };
    } catch (error) {
      console.error('[LayoutAgent] Error executing task:', error);
      throw error;
    }
  }
}
