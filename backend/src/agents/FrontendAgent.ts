import { OllamaService, type OllamaOptions } from '../services/OllamaService.js';
import { GeminiService } from '../services/GeminiService.js';
import { MessageBus } from '../services/MessageBus.js';
import type { ConversationMessage } from '../models/types.js';
import type { ResearchOutput } from './ResearchAgent.js';
import { BaseAgent } from './BaseAgent.js';

export class FrontendAgent extends BaseAgent {
  private generationService: OllamaService | GeminiService;
  private conversationHistory: ConversationMessage[] = [];

  private readonly systemPrompt = `You are an Expert Frontend Developer. Generate COMPLETE, WORKING, PROFESSIONAL HTML5 applications.

ABSOLUTE REQUIREMENTS:
1. Generate ONE complete HTML file with embedded CSS and JavaScript
2. Include full DOCTYPE, html, head, body tags with proper meta tags
3. Working JavaScript with complete logic - NO placeholder functions or TODOs
4. Responsive design that works on mobile/tablet/desktop (use media queries)
5. Professional, modern styling (CSS Grid/Flexbox for layout)
6. Data persistence with localStorage where applicable
7. All features MUST be fully functional - test every interaction
8. No external libraries or CDN imports (pure HTML/CSS/JS)

FEATURE IMPLEMENTATION CHECKLIST:
✓ Add/Create functionality with input validation
✓ Delete functionality with confirmation UI
✓ Display/Show all items with proper rendering
✓ Edit functionality with inline or modal editing
✓ Search or filter capabilities
✓ Clear status indicators and feedback
✓ Form validation with helpful error messages
✓ Auto-save to localStorage (save on every change)
✓ Load from localStorage on page load (DOMContentLoaded)
✓ Loading states for async operations
✓ Error handling and user feedback

MODERN UI/UX DESIGN STANDARDS:
1. **Color System**:
   - Use modern color palettes (not basic blue/red)
   - Apply color psychology: blue (trust), green (success), red (danger), orange (warning)
   - Include hover states (brighten or darken by 10%)
   - Use opacity for disabled states (0.5-0.7)

2. **Typography**:
   - Font stack: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
   - Hierarchy: h1 (2rem), h2 (1.5rem), body (1rem), small (0.875rem)
   - Line height: 1.6 for body text, 1.2 for headings
   - Font weights: 400 (normal), 600 (semibold), 700 (bold)

3. **Spacing & Layout**:
   - Use 8px grid system (8, 16, 24, 32, 48, 64px)
   - Container max-width: 1200px for desktop
   - Card padding: 24px
   - Button padding: 12px 24px
   - Gap between elements: 16px minimum

4. **Shadows & Depth**:
   - Subtle shadows: 0 2px 4px rgba(0,0,0,0.1)
   - Medium shadows: 0 4px 6px rgba(0,0,0,0.1)
   - Large shadows: 0 10px 15px rgba(0,0,0,0.1)
   - Hover elevation: increase shadow spread

5. **Border Radius**:
   - Buttons: 8px
   - Cards: 12px
   - Inputs: 6px
   - Pills/tags: 20px

6. **Transitions**:
   - Standard: all 0.2s ease
   - Use for: hover states, color changes, transforms
   - Smooth animations: opacity, transform (avoid animating width/height)

7. **Responsive Breakpoints**:
   - Mobile: < 640px
   - Tablet: 640px - 1024px
   - Desktop: > 1024px
   - Use mobile-first approach (base styles for mobile, @media for larger)

API INTEGRATION PATTERNS:

For apps requiring external APIs (weather, data fetching):
- Use fetch() with proper error handling
- Show loading states (spinner or skeleton UI)
- Handle network errors gracefully with user-friendly messages
- Use async/await for cleaner code
- Cache API responses in localStorage to reduce calls
- For weather apps: if no API key, use mock data for demonstration

STATE MANAGEMENT:
- Use JavaScript objects to manage app state
- Update UI when state changes
- Keep single source of truth for data

FORM VALIDATION:
- Validate on submit AND on input change
- Show inline error messages next to fields
- Disable submit button until form is valid
- Use HTML5 validation attributes (required, pattern, min, max)

CALCULATOR APPS:
- GLOBAL functions: append(digit), calculate(), clear(), setOperator(op)
- Use onclick handlers for buttons
- Store: currentValue, operator, previousValue
- Handle: division by zero, consecutive operators, decimals

TODO/LIST APPS:
- GLOBAL functions: addItem(), deleteItem(id), toggleComplete(id)
- Use Date.now() for unique IDs
- localStorage: save on every change, load on page load
- Validate input and provide feedback

WEATHER/DASHBOARD APPS:
- GLOBAL functions: searchCity(), showLoading(bool), displayWeather(data), showError(msg)
- Use realistic mock data if no API (multiple cities with different weather)
- Search functionality MUST work - input + button + Enter key support
- Display: temperature, condition, humidity, wind, forecast
- Loading spinner visible during "fetch"
- Error messages for invalid cities
- Example working pattern:

  const mockWeather = {
    'London': { temp: 15, condition: 'Cloudy', humidity: 75, wind: 12, forecast: [...] },
    'New York': { temp: 22, condition: 'Sunny', humidity: 60, wind: 8, forecast: [...] },
    'Tokyo': { temp: 18, condition: 'Rainy', humidity: 80, wind: 15, forecast: [...] }
  };

  function searchCity() {
    const city = document.getElementById('cityInput').value.trim();
    if (!city) return showError('Please enter a city name');

    showLoading(true);
    setTimeout(() => {
      const data = mockWeather[city];
      if (data) {
        displayWeather(city, data);
      } else {
        showError('City not found. Try London, New York, or Tokyo');
      }
      showLoading(false);
    }, 500);
  }

  function displayWeather(city, data) {
    document.getElementById('cityName').textContent = city;
    document.getElementById('temperature').textContent = data.temp + '°C';
    document.getElementById('condition').textContent = data.condition;
    // ... update all weather fields
  }

CRITICAL JAVASCRIPT RULES:
1. ALL functions defined in GLOBAL scope
2. Use onclick for immediate availability
3. NO empty functions or TODOs - everything fully functional
4. Add DOMContentLoaded listener for initialization
5. Handle ALL edge cases and validation
6. Use try/catch for async operations
7. Provide user feedback for every action

MANDATORY CHECKS:
- Every button has working functionality
- All IDs are used properly
- Data persists across refreshes
- Loading states for async ops
- Error messages for failures
- Empty states when no data

OUTPUT FORMAT:
Generate ONLY raw HTML. Start with <!DOCTYPE html>, end with </html>.
Include <style> in <head> and <script> before </body>.
NO markdown, NO code blocks, NO explanations.`;

  constructor(
    agentId: string,
    messageBus: MessageBus,
    service: OllamaService | GeminiService
  ) {
    super(
      {
        agentId,
        agentType: 'FRONTEND',
        capabilities: ['html', 'css', 'javascript', 'react', 'typescript', 'responsive-design']
      },
      messageBus
    );
    this.generationService = service;
  }

  private cleanupGeneratedCode(code: string): string {
    let cleaned = code;

    // Remove markdown artifacts
    cleaned = cleaned.replace(/```html\s*/gi, '').replace(/```\s*$/g, '');

    // Ensure proper DOCTYPE
    if (!cleaned.includes('<!DOCTYPE')) {
      cleaned = '<!DOCTYPE html>\n' + cleaned;
    }

    // Remove duplicate DOCTYPE declarations
    const doctypes = cleaned.match(/<!DOCTYPE[^>]*>/gi) || [];
    if (doctypes.length > 1) {
      // Keep first, remove rest
      let first = true;
      cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/gi, (match) => {
        if (first) {
          first = false;
          return match;
        }
        return '';
      });
    }

    // Ensure script tags are before closing body
    if (cleaned.includes('<script') && !cleaned.match(/<script[^>]*>[\s\S]*<\/script>\s*<\/body>/i)) {
      cleaned = cleaned.replace(/<\/body>/i, '<script></script>\n</body>');
    }

    return cleaned.trim();
  }

  private validateGeneratedCode(code: string, requirements: { functional: string[] }): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for complete HTML structure
    if (!code.includes('<!DOCTYPE') && !code.includes('<html')) {
      issues.push('Missing DOCTYPE or html tag');
    }

    // Check for closing tags
    const openTags = code.match(/<(\w+)[^>]*>/g) || [];
    const closeTags = code.match(/<\/(\w+)>/g) || [];
    if (openTags.length > closeTags.length + 2) { // Allow some self-closing tags
      issues.push('Possible unclosed HTML tags detected');
    }

    // Check for JavaScript completeness
    if (code.includes('<script')) {
      const scriptContent = code.match(/<script[^>]*>([\s\S]*?)<\/script>/i)?.[1] || '';

      // Verify functions referenced in onclick are defined
      const onclickHandlers = code.match(/onclick="([^"(]+)\(/g) || [];
      const functionNames = onclickHandlers.map(h => h.match(/onclick="([^"(]+)/)?.[1]).filter(Boolean);

      for (const funcName of functionNames) {
        if (!scriptContent.includes(`function ${funcName}`) && !scriptContent.includes(`${funcName} =`)) {
          issues.push(`onclick handler "${funcName}" not defined in JavaScript`);
        }
      }

      // Check for localStorage if required
      const needsStorage = requirements.functional.some(req =>
        req.toLowerCase().includes('persist') ||
        req.toLowerCase().includes('save') ||
        req.toLowerCase().includes('storage')
      );

      if (needsStorage && !scriptContent.includes('localStorage')) {
        issues.push('Requirements mention persistence but no localStorage implementation found');
      }
    }

    // Check for required elements based on project type
    const isCalculator = requirements.functional.some(req =>
      req.toLowerCase().includes('calculat') ||
      req.toLowerCase().includes('math')
    );

    if (isCalculator) {
      const hasDisplay = code.includes('id="display"') || code.includes("id='display'");
      const hasButtons = code.match(/<button/gi)?.length || 0;

      if (!hasDisplay) issues.push('Calculator missing display element with id="display"');
      if (hasButtons < 10) issues.push(`Calculator only has ${hasButtons} buttons (expected 10+ for digits)`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Generate complete frontend code
   */
  async generateCode(
    userRequest: string,
    researchOutput: ResearchOutput,
    designBrief?: string,
    onProgress?: (message: string) => void
  ): Promise<string> {
    const prompt = this.buildPrompt(userRequest, researchOutput, designBrief);

    if (onProgress) onProgress('Frontend Agent: Generating complete UI...');
    console.log('[FRONTEND_AGENT] Generating frontend code...');

    try {
      const response = await this.generationService.generate(prompt);

      console.log('[FRONTEND_AGENT] Frontend code generation complete');

      // Extract HTML from markdown code blocks if present
      let code = response;

      // Try multiple extraction patterns
      let htmlMatch = response.match(/```html\s*\n?([\s\S]*?)\n?```/i);
      if (!htmlMatch) {
        htmlMatch = response.match(/```\s*\n?(<!DOCTYPE[\s\S]*?)\n?```/i);
      }
      if (!htmlMatch) {
        // Try finding just the HTML content without code blocks
        htmlMatch = response.match(/(<!DOCTYPE[\s\S]*<\/html>)/i);
      }

      if (htmlMatch) {
        code = htmlMatch[1].trim();
      }

      // Validate the code contains HTML
      if (!code.includes('<html') && !code.includes('<body') && !code.includes('<!DOCTYPE')) {
        console.warn('[FRONTEND_AGENT] Response may not be valid HTML, attempting extraction');
        // Try to extract HTML content
        const bodyMatch = response.match(/<body[^>]*>[\s\S]*?<\/body>/i);
        if (bodyMatch) {
          code = `<!DOCTYPE html>\n<html>\n<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>\n${response}\n</html>`;
        }
      }

      // Clean up generated code
      code = this.cleanupGeneratedCode(code);

      if (onProgress) onProgress('Frontend Agent: Code generation complete');

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

      // Validate generated code
      const validation = this.validateGeneratedCode(code, researchOutput.requirements);

      if (!validation.valid) {
        console.warn('[FRONTEND_AGENT] Code validation issues:', validation.issues);
        // Log but don't block - LLM might have used alternative approach
      }

      // Debug logging
      console.log('[FRONTEND_AGENT] Generated code stats:');
      console.log(`  - Total length: ${code.length} characters`);
      console.log(`  - Has <script> tags: ${code.includes('<script')}`);
      console.log(`  - Has <style> tags: ${code.includes('<style')}`);
      console.log(`  - onclick handlers: ${(code.match(/onclick=/g) || []).length}`);
      console.log(`  - Functions defined: ${(code.match(/function \w+\(/g) || []).length}`);

      if (!validation.valid) {
        console.warn('[FRONTEND_AGENT] ⚠️  Validation issues found:');
        validation.issues.forEach(issue => console.warn(`  - ${issue}`));
      } else {
        console.log('[FRONTEND_AGENT] ✅ Code passed validation');
      }

      console.log('[FRONTEND_AGENT] Frontend code generation complete');
      return code;
    } catch (error) {
      console.error('[FRONTEND_AGENT] Error during code generation:', error);
      if (onProgress) onProgress(`Frontend Agent: Error - ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }

  /**
   * Build the code generation prompt
   */
  private buildPrompt(userRequest: string, researchOutput: ResearchOutput, designBrief?: string): string {
    // Start with the SPECIFIC user request FIRST to ensure it's prioritized
    let prompt = `========================================
YOUR TASK - READ THIS CAREFULLY
========================================

YOU MUST BUILD EXACTLY WHAT IS DESCRIBED BELOW:

${userRequest}

${designBrief ? `\nDESIGN BRIEF:\n${designBrief}\n` : ''}

SPECIFIC REQUIREMENTS YOU MUST IMPLEMENT:`;

    // Add functional requirements
    if (researchOutput.requirements.functional.length > 0) {
      prompt += '\n\nFUNCTIONAL REQUIREMENTS:';
      researchOutput.requirements.functional.forEach((req) => {
        prompt += `\n✓ ${req}`;
      });
    }

    // Add non-functional requirements
    if (researchOutput.requirements.nonFunctional.length > 0) {
      prompt += '\n\nNON-FUNCTIONAL REQUIREMENTS:';
      researchOutput.requirements.nonFunctional.forEach((req) => {
        prompt += `\n✓ ${req}`;
      });
    }

    // Add success criteria
    if (researchOutput.successCriteria.length > 0) {
      prompt += '\n\nSUCCESS CRITERIA (ALL MUST BE MET):';
      researchOutput.successCriteria.forEach((criteria) => {
        prompt += `\n✓ ${criteria}`;
      });
    }

    // Add tech stack info
    if (researchOutput.techStack.frontend && researchOutput.techStack.frontend.length > 0) {
      prompt += `\n\nTECH STACK: ${researchOutput.techStack.frontend.join(', ')}`;
    }

    // Now add the system guidelines AFTER the specific requirements
    prompt += `\n\n========================================
IMPLEMENTATION GUIDELINES
========================================

` + this.systemPrompt;

    prompt += `\n\n========================================
FINAL INSTRUCTIONS
========================================

Generate a COMPLETE, WORKING HTML file that implements EXACTLY what was requested above.
- Start with <!DOCTYPE html>
- End with </html>
- Include ALL CSS in <style> tag in <head>
- Include ALL JavaScript in <script> tag before </body>
- NO markdown code blocks
- NO explanations
- JUST the raw HTML code

IMPORTANT: Make sure your code implements the SPECIFIC features from the user request, not generic examples!`;

    return prompt;
  }

  /**
   * Phase A3: Execute task for autonomous agent execution
   * Implement frontend code generation for a given task
   */
  async executeTask(task: any, context?: any): Promise<any> {
    try {
      this.emitProgress(task.id, '', 0, 'Starting frontend generation');

      // Extract research and design info from task metadata
      const researchOutput = task.researchOutput || {
        features: task.description ? [task.description] : [],
        techStack: { frontend: ['html', 'css', 'javascript'] },
        successCriteria: []
      };

      const designBrief = task.designBrief || '';

      this.emitProgress(task.id, '', 25, 'Generating frontend code');

      const code = await this.generateCode(
        task.description || 'Frontend component',
        researchOutput,
        designBrief,
        (msg) => this.emitProgress(task.id, '', 50, msg)
      );

      this.emitProgress(task.id, '', 75, 'Validating generated code');

      // Validate the code
      const validation = this.validateGeneratedCode(code, {
        functional: researchOutput.features || []
      });

      if (!validation.valid) {
        console.warn('[FrontendAgent] Code validation issues:', validation.issues);
        // Continue anyway - code might still work despite validation warnings
      }

      this.emitProgress(task.id, '', 100, 'Frontend code generation complete');

      return {
        success: true,
        generatedCode: code,
        language: 'html',
        type: 'frontend',
        validationIssues: validation.issues
      };
    } catch (error) {
      console.error('[FrontendAgent] Error executing task:', error);
      throw error;
    }
  }
}
