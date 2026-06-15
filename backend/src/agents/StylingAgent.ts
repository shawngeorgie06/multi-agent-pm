import type { AIService } from '../services/AIService.js';
import { MessageBus } from '../services/MessageBus.js';
import type { DesignBrief } from './DesignDirectorAgent.js';
import type { ResearchOutput } from './ResearchAgent.js';
import { CodeValidationService } from '../services/CodeValidationService.js';
import { BaseAgent } from './BaseAgent.js';
import { stripCodeFences } from '../utils/codeExtraction.js';

export class StylingAgent extends BaseAgent {
  private generationService: AIService;

  constructor(
    agentId: string,
    messageBus: MessageBus,
    service: AIService
  ) {
    super(
      {
        agentId,
        agentType: 'STYLING',
        capabilities: ['css', 'design', 'responsive', 'typography']
      },
      messageBus
    );
    this.generationService = service;
  }

  /**
   * Generate CSS with distinctive typography, colors, and effects.
   * Uses design tokens to target the correct elements.
   */
  async generateStyles(
    projectDescription: string,
    designBrief: DesignBrief,
    htmlStructure: string,
    taskContext?: string
  ): Promise<string> {
    // DISABLED: Template detection was matching wrong templates (e.g. color-picker CSS for calculators)
    // Always generate custom CSS based on actual HTML structure instead
    // const template = detectTemplate(projectDescription);
    // if (template) {
    //   return template.css;
    // }

    // Extract IDs and classes from HTML for strict targeting
    const elementIds = this.extractElementIds(htmlStructure);
    const elementClasses = this.extractElementClasses(htmlStructure);

    // Fallback to Ollama-based CSS generation if no template matches
    const prompt = `You are a Styling Specialist. Create CSS that makes the interface polished and professional.

## Project
${projectDescription}

## Design Brief
${designBrief.aesthetic} - ${designBrief.colorPalette}

## HTML Structure (use EXACTLY these IDs and classes)
${htmlStructure || 'No HTML provided yet'}

## Element IDs Found in HTML (style ONLY these with # selectors)
${elementIds.length > 0 ? elementIds.map(id => `#${id}`).join(', ') : 'No IDs found'}

## Element Classes Found in HTML (style ONLY these with . selectors)
${elementClasses.length > 0 ? elementClasses.map(cls => `.${cls}`).join(', ') : 'No classes found'}

## Task
${taskContext || 'Style the interface'}

## STYLING REQUIREMENTS BY APP TYPE
Identify the app type and ensure proper styling:
- Calculator → grid layout for buttons, large display, clear visual hierarchy, consistent button sizing
- Todo List → clean list styling, hover states, completed item styling, input focus states
- Forms → clear field boundaries, validation states, button prominence, error message styling
- Dashboard → card layouts, spacing, data visualization styling, responsive grid

## CRITICAL INSTRUCTIONS
1. Output ONLY CSS - no <style> tags, no external links, no markdown code blocks, no explanations
2. **TARGET ONLY THE IDs AND CLASSES LISTED ABOVE** - Do not invent new selectors
3. Style EVERY element listed in the HTML so the UI is complete and polished - no unstyled elements
4. Use modern CSS with gradients, shadows, transitions, and hover effects
5. Make buttons stand out with clear hover/active states and proper cursor styles
6. Use a cohesive color scheme based on the design brief
7. Add proper spacing, padding, and margins for a professional look
8. Make the layout responsive and visually appealing on all screen sizes
9. Ensure text is readable (proper contrast, font sizes, line heights)
10. Style interactive states: :hover, :active, :focus, :disabled
11. You can style generic elements (body, main, section, button, input, ul, li) without IDs/classes

**FORBIDDEN:** Do NOT write CSS for #todo-input, #add-btn, or ANY ID/class not in the lists above.

IMPORTANT:
- Before writing any #id or .class selector, verify it exists in the lists above
- Every element in the HTML should be styled appropriately - check the IDs list and ensure you've styled each one
- The final UI should look professional and complete, not like an unstyled prototype`;

    const response = await this.generationService.generate(prompt);
    return this.extractCode(response);
  }

  private extractCode(response: string): string {
    return stripCodeFences(response);
  }

  /**
   * Extract element IDs from HTML for strict CSS targeting
   */
  private extractElementIds(html: string): string[] {
    const idMatches = html.match(/id="([^"]+)"/g) || [];
    return idMatches.map(match => match.replace(/id="|"/g, ''));
  }

  /**
   * Extract element classes from HTML for strict CSS targeting
   */
  private extractElementClasses(html: string): string[] {
    const classMatches = html.match(/class="([^"]+)"/g) || [];
    const allClasses = classMatches.flatMap(match =>
      match.replace(/class="|"/g, '').split(' ')
    );
    return [...new Set(allClasses)]; // Remove duplicates
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
    if (callback) callback('Generating CSS styling…');

    const designBrief: DesignBrief = context.designBrief || {
      aesthetic: 'modern',
      typography: 'system fonts',
      colorPalette: '#ffffff background, #000000 text',
      motionAndEffects: 'smooth transitions',
      designTokens: '{}',
      raw: ''
    };

    const htmlStructure = context.layoutHTML || '';

    const styles = await this.generateStyles(
      projectDescription,
      designBrief,
      htmlStructure,
      `Functional requirements: ${(context.requirements || []).join(', ')}`
    );

    if (callback) callback('CSS styling complete');

    return styles;
  }

  /**
   * Validate CSS compatibility with HTML
   */
  protected async validateOutput(
    generatedCode: string,
    task: any,
    context: any
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    // Gracefully handle validation - return valid if no HTML structure available
    const htmlStructure = context?.layoutHTML || '';
    if (!htmlStructure) {
      return {
        isValid: true,
        errors: [],
        warnings: ['No HTML structure available for validation (autonomous execution)']
      };
    }
    return CodeValidationService.validateStylingCompatibility(htmlStructure, generatedCode);
  }

  /**
   * Retry with feedback about orphaned selectors
   */
  protected async retryWithFeedback(
    task: any,
    context: any,
    errors: string[]
  ): Promise<any> {
    console.log('[StylingAgent] Retrying with feedback about CSS selectors');

    const designBrief: DesignBrief = task.designBrief || {
      aesthetic: 'modern',
      typography: 'system fonts',
      colorPalette: '#ffffff background, #000000 text',
      motionAndEffects: 'smooth transitions',
      designTokens: '{}',
      raw: ''
    };

    const htmlStructure = context?.layoutHTML || '';

    const errorFeedback = `Previous CSS had issues. Make sure CSS only targets elements that exist in the HTML. Issues found: ${errors.slice(0, 3).join(', ')}`;

    const styles = await this.generateStyles(
      task.description || 'Styling',
      designBrief,
      htmlStructure,
      `${task.context || ''}\n\nIMPORTANT FEEDBACK: ${errorFeedback}`
    );

    return {
      success: true,
      generatedCode: styles,
      language: 'css',
      type: 'styling'
    };
  }

  /**
   * Phase A3: Execute task for autonomous agent execution
   */
  async executeTask(task: any, context?: any): Promise<any> {
    try {
      this.emitProgress(task.id, '', 0, 'Starting styling generation');

      const designBrief = task.designBrief || { colors: [], fonts: [] };

      // Get HTML from LAYOUT agent if available
      const htmlStructure = context?.layoutHTML || '';

      console.log(`[StylingAgent] Received HTML structure: ${htmlStructure ? htmlStructure.length + ' chars' : 'NONE'}`);

      this.emitProgress(task.id, '', 50, 'Generating styles based on HTML structure');

      const styles = await this.generateStyles(
        task.description || 'Styling',
        designBrief,
        htmlStructure,
        this.appendValidationFeedback(task.context, context)
      );

      this.emitProgress(task.id, '', 100, 'Styling generation complete');

      return {
        success: true,
        generatedCode: styles,
        language: 'css',
        type: 'styling'
      };
    } catch (error) {
      console.error('[StylingAgent] Error executing task:', error);
      throw error;
    }
  }
}
