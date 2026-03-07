import { OllamaService, type OllamaOptions } from './OllamaService.js';

interface TaskInfo {
  taskId: string;
  description: string;
  priority: string;
  estimatedHours?: number;
}

export class CodeGeneratorService {
  private ollamaService: OllamaService;

  constructor(apiUrl?: string, model?: string, options?: OllamaOptions) {
    this.ollamaService = new OllamaService(apiUrl, model, options);
  }

  /**
   * Generate code for a single task given project context
   */
  async generateCodeForTask(
    task: TaskInfo,
    projectDescription: string,
    otherTasks: TaskInfo[]
  ): Promise<string> {
    const isWebProject =
      /website|web page|html|landing page|web app|frontend|ui|page|calculator|app/i.test(projectDescription) ||
      /calculator|interactive|button|click/i.test(task.description);

    const isCalculator =
      /calculator/i.test(projectDescription) || /calculator|add|subtract|multiply|divide|numbers|buttons/i.test(task.description);

    const webHint = isWebProject
      ? `
IMPORTANT: This will be displayed in a live preview. Output plain HTML, CSS, and/or JavaScript that runs in a browser.
- Use a complete HTML document (<!DOCTYPE html>, <html>, <head>, <body>) if this is the main page
- Or output HTML fragments, <style> blocks, or <script> blocks that can be combined
- No React, Vue, or build tools—only vanilla HTML/CSS/JS
- Use consistent element IDs across tasks (e.g. id="display" for the result, id="calc" for the container)
- Event handlers must reference elements that exist in the HTML (match IDs/classes exactly)
`
      : '';

    const isStructureTask = /structure|html|layout|ui|create|build|design/i.test(task.description) && !/logic|javascript|behavior|interactivity|functionality/i.test(task.description);
    const needsCompleteCalculator = isCalculator && (isStructureTask || otherTasks.length <= 1);

    const calculatorHint = isCalculator
      ? `
CALCULATOR-SPECIFIC: The calculator MUST actually work when buttons are clicked.
${needsCompleteCalculator ? `
CRITICAL: Output a COMPLETE working calculator in one HTML document. Include <style> and <script> tags.
- The JavaScript must: append digits when number buttons (0-9) are clicked, handle + - * /, evaluate when = is clicked, clear when C is clicked
- Use id="display" for the output element. Use onclick="append('7')" etc. with GLOBAL functions (define function append(n) { ... } in the script)
- Never output HTML buttons without the JavaScript that makes them work
` : `
- Use id="display" for the result. Use document.getElementById('display') to update it
- If using onclick="append('7')", define append as a global function in a <script> block
- Support 0-9, +, -, *, /, =, clear. Evaluate expressions correctly
`}
`
      : '';

    const isQuoteProject = /quote|inspiration|motivat|random quote/i.test(projectDescription);
    const quoteHint = isQuoteProject
      ? `
QUOTE APP (CRITICAL): The backend provides GET /api/quote. It returns JSON: { "q": "quote text", "a": "author" }.
- Use fetch("/api/quote") (same-origin; no full URL). Display d.q in the quote element and d.a as author.
- Include: (1) an element for the quote text (e.g. id="quote"), (2) an element for the author (e.g. id="author"), (3) a "New Quote" or "Load another" button that calls the same fetch and updates the display, (4) optional: Copy button. Load a quote on page load.
- Output COMPLETE working code: full HTML with <style> and <script>. No placeholders. The app must work when opened.
`
      : '';

    const prompt = `You are a software engineer. Generate production-ready code for the following task.

## Project Context
${projectDescription}

## This Task
- ID: ${task.taskId}
- Description: ${task.description}
- Priority: ${task.priority}
${task.estimatedHours ? `- Estimated: ${task.estimatedHours}h` : ''}

## Other tasks in this project (for context)
${otherTasks.map((t) => `- ${t.taskId}: ${t.description}`).join('\n')}
${webHint}
${calculatorHint}
${quoteHint}

## API Integration (CRITICAL)
For weather apps specifically:
1. ALWAYS use window.API_KEYS.openweathermap for API key
2. Fallback: localStorage.getItem('apiKey')
3. Fetch URL: https://api.openweathermap.org/data/2.5/weather?q=CITY&appid=KEY&units=metric
4. MUST display results in these exact element IDs:
   - id="city-name" ← city, country
   - id="current-temp" ← temp with °C/°F
   - id="current-description" ← weather description
   - id="current-humidity" ← humidity %
   - id="current-windspeed" ← wind speed
5. Temperature conversion: Fahrenheit = (Celsius * 9/5) + 32, use Math.round()
6. MUST have handlers for: id="search-btn", id="search-input" (Enter key), id="celsius-btn", id="fahrenheit-btn"
7. Error messages → id="error" with showError(msg)
8. Loading state → id="loading" with showLoading(true/false)
9. Always try-catch with response.ok validation before .json()
10. Never hardcode 'YOUR_API_KEY' - always use window.API_KEYS.openweathermap

## Instructions
1. Generate COMPLETE, runnable code that works when loaded in a browser. No placeholders, no TODOs, no "implement later".
2. Include every element and handler the app needs. Every button must do something; every feature described must work.
3. Include necessary setup; no external dependencies (vanilla HTML/CSS/JS only).
4. Output raw code only—no markdown code blocks or \`\`\` wrappers.
5. Be concise but complete: the full app must work end-to-end.
6. If this task depends on HTML from another task, use the exact same IDs/classes that the HTML task defines.
7. Use window.showError(), window.showLoading(), window.fetchData() for API calls when applicable.
8. Handle errors gracefully - never crash; use demo data or a clear message instead.

MANDATORY — app must work: Every button/input/link has an id. Every id in the HTML is used in the JavaScript (getElementById, querySelector, or in an event handler). Every button has an event listener or onclick that does the described action. No empty functions. No TODO or placeholder logic. Write real, working behavior for every interaction.

Generate the complete, working code now:`;

    const response = await this.ollamaService.generate(prompt);

    // Extract code block if present
    const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)\n```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    return response.trim();
  }
}
