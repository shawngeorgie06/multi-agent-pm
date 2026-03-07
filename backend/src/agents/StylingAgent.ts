import { OllamaService, type OllamaOptions } from '../services/OllamaService.js';
import { GeminiService } from '../services/GeminiService.js';
import { MessageBus } from '../services/MessageBus.js';
import { detectTemplate } from '../templates/utils.js';
import type { DesignBrief } from './DesignDirectorAgent.js';
import { BaseAgent } from './BaseAgent.js';

export class StylingAgent extends BaseAgent {
  private generationService: OllamaService | GeminiService;

  constructor(
    agentId: string,
    messageBus: MessageBus,
    service: OllamaService | GeminiService
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
    // Try to detect template from project description
    const template = detectTemplate(projectDescription);
    if (template) {
      return template.css;
    }

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
    const match = response.match(/```[\w]*\n([\s\S]*?)\n```/);
    return match ? match[1].trim() : response.trim();
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
        task.context
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
