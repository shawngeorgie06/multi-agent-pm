/**
 * PhaseOrchestrator - Clean three-phase orchestration with zero race conditions
 *
 * PHASE 1: ORCHESTRATION
 *   - PM creates project plan
 *   - Engineer reviews and provides feedback
 *   - Loop until consensus
 *   - Output: Finalized task list
 *   - No task queueing, no agent execution
 *
 * PHASE 2: PREPARATION
 *   - Wait for Phase 1 to complete
 *   - Create TaskQueue entries from finalized tasks
 *   - Start all agents in listening mode
 *   - Output: System ready for execution
 *
 * PHASE 3: EXECUTION
 *   - Agents autonomously claim and execute tasks
 *   - Parallel execution
 *   - No orchestration interference
 *
 * Key Design: Each phase MUST complete before the next begins
 */

import { AgentOrchestrator } from '../agents/AgentOrchestrator.js';
import { MessageBus } from './MessageBus.js';
import { TaskDistributionService } from './TaskDistributionService.js';
import { TaskQueueManager } from './TaskQueueManager.js';
import { SocketServer } from '../websocket/SocketServer.js';
import { ProjectBuilderService } from './ProjectBuilderService.js';
import prisma from '../database/db.js';
import { stripCodeFences } from '../utils/codeExtraction.js';

export interface Phase1Output {
  projectId: string;
  tasks: any[];
  messages: any[];
  status: 'orchestration_complete';
  backendPort?: number;
}

export interface Phase2Output {
  projectId: string;
  queuedTaskCount: number;
  status: 'preparation_complete';
}

export interface Phase3Output {
  projectId: string;
  status: 'execution_started';
}

export class PhaseOrchestrator {
  constructor(
    private orchestrator: AgentOrchestrator,
    private messageBus: MessageBus,
    private taskDistributionService: TaskDistributionService,
    private socketServer: SocketServer
  ) {}

  /**
   * PHASE 1: ORCHESTRATION
   * Run PM/Engineer conversation until consensus
   * Returns finalized tasks - nothing is queued yet
   */
  async phase1Orchestration(userRequest: string, projectId: string): Promise<Phase1Output> {
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 1: ORCHESTRATION (Direct Code Generation)');
    console.log('='.repeat(80));

    this.socketServer.emitProjectStatus(projectId, 'in_progress', 'Phase 1: Generating code for ' + userRequest.substring(0, 50) + '…');

    try {
      // Generate code directly using specialized prompts
      console.log('[PHASE 1] Generating code with Layout→Styling→Logic pipeline...\n');

      // Detect if app needs a backend server
      const needsBackend = this.needsBackend(userRequest);
      let backendPort: number | undefined;
      if (needsBackend) {
        // Import lazily to avoid circular deps
        const { ProjectBuilderService } = await import('./ProjectBuilderService.js');
        backendPort = ProjectBuilderService.getInstance().allocatePort();
        console.log(`[PHASE 1] Backend required — allocated port ${backendPort}\n`);
      }

      // Generate Layout HTML
      console.log('[LAYOUT] Generating HTML structure…');
      this.socketServer.emitProjectStatus(projectId, 'in_progress', 'Generating HTML structure…');
      this.socketServer.emitAgentActivity(projectId, 'LAYOUT', 'Building HTML structure…');

      const layoutPrompt = this.buildLayoutPrompt(userRequest);
      const layoutCode = this.stripMarkdown(await this.orchestrator.generationService.generate(layoutPrompt));

      this.socketServer.emitAgentActivity(projectId, 'LAYOUT', `HTML structure complete (${layoutCode.length} chars) ✓`);
      console.log(`✅ Layout generated: ${layoutCode.length} characters\n`);

      // Generate Styling CSS
      console.log('[STYLING] Generating CSS styling…');
      this.socketServer.emitProjectStatus(projectId, 'in_progress', 'Generating CSS styling…');
      this.socketServer.emitAgentActivity(projectId, 'STYLING', 'Writing CSS styles…');

      const stylingPrompt = this.buildStylingPrompt(userRequest, layoutCode);
      const stylingCode = this.stripMarkdown(await this.orchestrator.generationService.generate(stylingPrompt));

      this.socketServer.emitAgentActivity(projectId, 'STYLING', `CSS complete (${stylingCode.length} chars) ✓`);
      console.log(`✅ Styling generated: ${stylingCode.length} characters\n`);

      // Generate Backend FIRST (if needed) so its protocol can be passed to the JS prompt
      let backendCode: string | undefined;
      if (needsBackend && backendPort) {
        console.log('[BACKEND] Generating Node.js server…');
        this.socketServer.emitProjectStatus(projectId, 'in_progress', 'Generating backend server…');
        this.socketServer.emitAgentActivity(projectId, 'BACKEND', 'Generating Node.js server…');

        const backendPrompt = this.buildBackendPrompt(userRequest, backendPort);
        backendCode = this.stripMarkdown(await this.orchestrator.generationService.generate(backendPrompt));

        this.socketServer.emitAgentActivity(projectId, 'BACKEND', `Server code complete ✓`);
        console.log(`✅ Backend generated: ${backendCode.length} characters\n`);
      }

      // Generate Logic JavaScript — pass backend code so frontend matches its protocol exactly
      console.log('[LOGIC] Generating JavaScript logic…');
      this.socketServer.emitProjectStatus(projectId, 'in_progress', 'Generating JavaScript logic…');
      this.socketServer.emitAgentActivity(projectId, 'LOGIC', 'Writing JavaScript logic…');

      const logicPrompt = this.buildLogicPrompt(userRequest, layoutCode, backendPort, backendCode);
      let logicCode = this.stripMarkdown(await this.orchestrator.generationService.generate(logicPrompt));

      // Detect stubs — retry up to 2 times with a targeted fill-in prompt
      for (let attempt = 0; attempt < 2 && this.hasStubs(logicCode); attempt++) {
        console.warn(`[LOGIC] Stubs detected (attempt ${attempt + 1}) — retrying with stub-fill prompt…`);
        this.socketServer.emitProjectStatus(projectId, 'in_progress', 'Completing implementation (stubs detected)…');
        this.socketServer.emitAgentActivity(projectId, 'LOGIC', `Filling in stubs (attempt ${attempt + 1})…`);
        const fillPrompt = this.buildStubFillPrompt(userRequest, layoutCode, logicCode);
        logicCode = this.stripMarkdown(await this.orchestrator.generationService.generate(fillPrompt));
      }
      if (this.hasStubs(logicCode)) {
        console.warn('[LOGIC] Stubs remain after retries — proceeding with best effort');
      }

      console.log(`✅ Logic generated: ${logicCode.length} characters\n`);

      // Build tasks list
      const tasks: any[] = [
        {
          taskId: 'LAYOUT-001',
          description: `HTML: ${userRequest}`,
          status: 'COMPLETE',
          priority: 'HIGH',
          estimatedHours: 0.25,
          dependencies: [],
          generatedCode: layoutCode,
        },
        {
          taskId: 'STYLING-001',
          description: `CSS: ${userRequest}`,
          status: 'COMPLETE',
          priority: 'MEDIUM',
          estimatedHours: 0.25,
          dependencies: ['LAYOUT-001'],
          generatedCode: stylingCode,
        },
        {
          taskId: 'LOGIC-001',
          description: `JS: ${userRequest}`,
          status: 'COMPLETE',
          priority: 'HIGH',
          estimatedHours: 0.25,
          dependencies: ['LAYOUT-001'],
          generatedCode: logicCode,
        },
      ];

      if (backendCode && backendPort) {
        tasks.push({
          taskId: 'BACKEND-001',
          description: `Node.js server: ${userRequest}`,
          status: 'COMPLETE',
          priority: 'HIGH',
          estimatedHours: 0.25,
          dependencies: [],
          generatedCode: backendCode,
          backendPort,
        });
      }

      const totalChars = tasks.reduce((s, t) => s + (t.generatedCode?.length || 0), 0);
      const allMessages = [{
        fromAgent: 'ORCHESTRATOR',
        toAgent: 'SYSTEM',
        messageType: 'status',
        content: `Generated complete code: ${totalChars} total characters`,
      }];

      console.log(`✅ PHASE 1 COMPLETE`);
      console.log(`   - Layout: ${layoutCode.length} chars`);
      console.log(`   - Styling: ${stylingCode.length} chars`);
      console.log(`   - Logic: ${logicCode.length} chars`);
      if (backendCode) console.log(`   - Backend: ${backendCode.length} chars (port ${backendPort})`);
      console.log(`   - Total: ${totalChars} chars`);

      this.socketServer.emitProjectStatus(
        projectId,
        'in_progress',
        'Code generated. Building project…'
      );

      return {
        projectId,
        tasks,
        messages: allMessages,
        status: 'orchestration_complete',
        backendPort,
      };
    } catch (error) {
      console.error('❌ PHASE 1 FAILED:', error);
      this.socketServer.emitProjectStatus(
        projectId,
        'failed',
        `Phase 1 failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  private stripMarkdown(code: string): string {
    // Delegates to the shared, well-tested extractor so all generated code is
    // cleaned identically and stray fences can never reach the assembled HTML.
    return stripCodeFences(code);
  }

  private hasStubs(code: string): boolean {
    const stubPatterns = [
      /\/\/\s*TODO/i,
      /\/\/\s*FIXME/i,
      /\/\/\s*implement/i,
      /\/\/\s*add\s+(logic|code|implementation|your)/i,
      /throw new Error\(['"]not implemented/i,
      /function\s+\w+\s*\([^)]*\)\s*\{\s*\}/,   // empty function body
      /=>\s*\{\s*\}/,                              // empty arrow function body
      /\/\/\s*placeholder/i,
    ];
    return stubPatterns.some(p => p.test(code));
  }

  private buildStubFillPrompt(userRequest: string, html: string, jsWithStubs: string): string {
    return `You are a senior JavaScript engineer. The code below has incomplete implementations marked with TODO comments or empty function bodies. Your job is to replace EVERY stub with a complete, working implementation.

PROJECT: "${userRequest}"

HTML (element IDs available):
${html}

JAVASCRIPT WITH STUBS:
${jsWithStubs}

INSTRUCTIONS:
1. Find every // TODO, // FIXME, empty function body, and placeholder comment
2. Replace each one with a COMPLETE, working implementation — no shortcuts
3. For game logic (chess, cards, etc.): implement the full algorithm — all piece movement rules, all win conditions, all edge cases
4. For data operations: implement all CRUD operations with localStorage
5. For UI interactions: wire up all missing event handlers
6. Keep all existing working code intact — only fill in the gaps
7. The final code must have ZERO TODO comments and ZERO empty function bodies

OUTPUT: The complete JavaScript with all stubs filled in. No markdown fences, no explanations.`;
  }

  needsBackend(request: string): boolean {
    const keywords = ['chat', 'real-time', 'realtime', 'websocket', 'multiplayer',
      'collaborative', 'live message', 'socket', 'messaging app', 'room'];
    return keywords.some(k => request.toLowerCase().includes(k));
  }

  private buildLayoutPrompt(projectRequest: string): string {
    return `You are a senior front-end engineer specialising in semantic, accessible HTML. Build a COMPLETE HTML5 document for:

PROJECT: ${projectRequest}

STRICT OUTPUT RULES:
- Output ONLY the HTML document — no CSS, no JavaScript, no markdown fences
- Start with <!DOCTYPE html> and end with </html>
- No placeholder text ("Lorem ipsum", "Coming soon"), no TODO comments, no stub elements

STRUCTURE & SEMANTICS:
- Use correct semantic elements: <header>, <nav>, <main>, <section>, <article>, <aside>, <footer>
- Every <input> and <textarea> must have a matching <label for="..."> — no unlabelled controls
- Every <button> must have an explicit type attribute (type="button" or type="submit")
- Every <img> must have a descriptive alt attribute
- Use <ul>/<ol> for lists, <table> for tabular data, <form> for data-entry groups
- Add role and aria-label attributes wherever the semantic element alone is insufficient

ELEMENT NAMING (critical — CSS and JS depend on these):
- Give every interactive element a unique, readable id: e.g. id="search-input", id="submit-btn"
- Use kebab-case class names that describe purpose: class="card", class="result-list", class="error-message"
- Group related elements inside a wrapper with a class: class="card-grid", class="form-group", class="modal-overlay"

COMPLETENESS:
- Include ALL UI regions the app needs: input areas, output/results areas, empty-state messages, error message containers, loading spinners
- Add a hidden class="error-message" span or div near every form or data-fetch area
- Add a hidden class="loading-indicator" element where async operations will show progress
- The document must be fully functional when CSS and JS are added — nothing can be missing

GAME & VISUAL APPS — CRITICAL:
If the project is a game or has a visual board/grid, you MUST render the complete initial visual structure in HTML:
- Chess: render all 64 squares as <div class="square light|dark" data-row="r" data-col="c"> inside a board container, with pieces shown as Unicode characters in <span class="piece" data-piece="K" data-color="white"> etc. in their starting positions
- Card games: render the deck, hand areas, and play area with placeholder card elements
- Grid puzzles (sudoku, minesweeper): render the full cell grid with appropriate classes
- Calculators, clocks, scoreboards: render the display and all buttons fully
DO NOT leave game boards as empty containers expecting JavaScript to build them — the visual structure must be present in the HTML so CSS can style it and JS can operate on existing elements.

Generate the complete, production-ready HTML now:`;
  }

  private skeletonHTML(html: string): string {
    // Extract all unique IDs and classes for CSS/JS reference — never truncate these
    const ids = [...new Set((html.match(/id="([^"]+)"/g) || []).map(m => m.slice(4, -1)))];
    const classes = [...new Set((html.match(/class="([^"]+)"/g) || []).flatMap(m => m.slice(7, -1).split(/\s+/)))];

    // Strip text nodes but keep all tags with their attributes — no char limit
    const skeleton = html
      .replace(/>\s*[^<]{3,}\s*</g, '><')
      .replace(/\s+/g, ' ')
      .trim();

    return `${skeleton}\n\n<!-- IDs: ${ids.join(', ')} -->\n<!-- Classes: ${classes.join(', ')} -->`;
  }

  private buildStylingPrompt(projectRequest: string, layoutHTML: string): string {
    return `You are a senior UI designer and CSS architect. Generate a COMPLETE, polished CSS stylesheet for:

PROJECT: ${projectRequest}

HTML STRUCTURE (style every element, class, and id present):
${this.skeletonHTML(layoutHTML)}

STRICT OUTPUT RULES:
- Output ONLY raw CSS — no HTML, no JavaScript, no <style> tags, no markdown fences
- Style EVERY element, class, and id present in the HTML above — nothing unstyled

DESIGN SYSTEM (define these first, use them everywhere):
:root {
  /* Define a cohesive palette of 4–6 colours appropriate for this project type */
  --color-primary, --color-primary-hover, --color-secondary, --color-accent
  --color-bg, --color-surface, --color-surface-raised
  --color-text, --color-text-muted, --color-border
  /* Spacing scale */
  --space-xs: 4px; --space-sm: 8px; --space-md: 16px; --space-lg: 24px; --space-xl: 40px;
  /* Typography */
  --font-body: system-ui, -apple-system, sans-serif;
  --font-mono: 'Courier New', monospace;
  --radius-sm: 6px; --radius-md: 12px; --radius-lg: 20px;
  --shadow-sm, --shadow-md, --shadow-lg
}

LAYOUT:
- Use CSS Grid or Flexbox for all multi-element containers — no floats
- Center the app using: max-width + margin: 0 auto + min-height: 100vh
- Mobile-first: base styles for small screens, then @media (min-width: 640px) and (min-width: 1024px)

VISUAL POLISH:
- Every button: distinct background, padding, border-radius, font-weight: 600, cursor: pointer
- Every button :hover: color shift + transform: translateY(-1px) + box-shadow transition
- Every button :active: transform: translateY(0)
- Every input/select/textarea: border, padding, border-radius, outline: none on :focus + border-color change + box-shadow
- Cards/panels: background var(--color-surface), border-radius, box-shadow var(--shadow-md), padding
- Error messages (.error-message): red/warning colour, hidden by default (display: none), shown with .visible class
- Loading indicators (.loading-indicator): animated, hidden by default

TYPOGRAPHY:
- h1: 2rem–2.5rem, font-weight: 800, tight letter-spacing
- h2/h3: step down proportionally
- Body text: 1rem, line-height: 1.6
- Muted text: var(--color-text-muted), font-size: 0.875rem

ANIMATIONS:
- All transitions: transition: all 0.2s ease (on interactive elements)
- Add a subtle @keyframes fadeIn for dynamically inserted list items or results
- Add @keyframes spin for loading spinners

Generate the complete, production-quality CSS now:`;
  }

  private buildLogicPrompt(projectRequest: string, layoutHTML: string, backendPort?: number, backendCode?: string): string {
    const idMatches = layoutHTML.match(/id="([^"]+)"/g) || [];
    const ids = [...new Set(idMatches.map(m => m.replace(/id="|"/g, '')))];

    const backendNote = backendPort
      ? `BACKEND: A WebSocket server is running at ws://localhost:${backendPort}. You MUST use exactly the message types and payload shapes defined in the backend code below.`
      : 'BACKEND: None. Use only browser APIs (localStorage, fetch to public APIs) for data and state.';

    const backendSection = backendCode
      ? `\nBACKEND SERVER CODE (match this protocol exactly — same message type strings, same payload field names):\n${backendCode}\n`
      : '';

    return `You are a senior JavaScript engineer. Generate COMPLETE, production-quality JavaScript for:

PROJECT: ${projectRequest}

${backendNote}
${backendSection}
HTML STRUCTURE (reference — use ONLY these element IDs):
${this.skeletonHTML(layoutHTML)}

ELEMENT IDs AVAILABLE:
${ids.map(id => `- #${id}`).join('\n')}

STRICT OUTPUT RULES:
- Output ONLY raw JavaScript — no <script> tags, no HTML, no CSS, no markdown fences
- Reference ONLY the IDs listed above — never getElementById/querySelector with an ID not in that list
- Wrap ALL code in: document.addEventListener('DOMContentLoaded', () => { ... })

FUNCTIONALITY (implement 100% — no TODOs, no stubs):
- Every button, input, form, and interactive element must have a working event listener
- Every user action must produce visible feedback — never silently fail
- Implement all features implied by the project description in full

DATA & STATE:
- Persist user data with localStorage where appropriate (lists, settings, scores)
- Use a single state object or clear module-level variables — no scattered globals
- When loading saved data on page start, handle missing/corrupted data gracefully (JSON.parse in try/catch)

ERROR HANDLING & VALIDATION:
- Validate all inputs before processing: check for empty, out-of-range, wrong type
- Show error feedback by setting the nearest .error-message element's textContent and adding class "visible"
- Clear errors when the user corrects the input
- Wrap every fetch/async call in try/catch; show a user-friendly message on failure

LOADING STATES:
- For any async operation, toggle the nearest .loading-indicator: show before the call, hide after
- Disable the triggering button during async operations (button.disabled = true/false)

UX POLISH:
- Support Enter key on text inputs as equivalent to clicking the primary action button
- Auto-focus the primary input on page load
- Animate dynamically inserted items: add a CSS class (e.g. "fade-in") immediately after insertion
- Format numbers with toLocaleString() where displayed to users
- Debounce any input event that triggers expensive work (300ms)
- ${backendPort
        ? `Connect WebSocket to ws://localhost:${backendPort} and reconnect automatically on disconnect`
        : 'Store all data in localStorage; initialise from stored data on DOMContentLoaded'}

ACCESSIBILITY:
- After dynamic content updates, move focus or announce changes (use aria-live regions if present)
- Never rely solely on colour to convey state — update text content too

Generate the complete, production-ready JavaScript now:`;
  }

  private buildBackendPrompt(projectRequest: string, port: number): string {
    return `You are an expert Node.js developer. Generate a COMPLETE, production-ready Node.js server for:

PROJECT: ${projectRequest}

REQUIREMENTS:
1. Use CommonJS syntax only (require/module.exports) — NO ES module import/export
2. Use the 'ws' package for WebSocket, 'express' for HTTP, 'cors' for headers
3. Server MUST listen on port ${port}: server.listen(${port}, () => console.log('Server on port ${port}'))
4. Implement ALL real-time features the project needs (rooms, messaging, online users, etc.)
5. Handle client disconnections gracefully — clean up rooms/users
6. Add CORS headers to allow all origins
7. Log connections and key events to console
8. Only use these packages (already installed): ws, express, cors — nothing else
9. Return ONLY the JavaScript code — no explanations, no markdown blocks

Generate the complete Node.js server now:`;
  }

  /**
   * PHASE 2: PREPARATION
   * Queue all tasks and start agents listening
   * Do NOT trigger task distribution yet
   */
  async phase2Preparation(phase1Output: Phase1Output): Promise<Phase2Output> {
    const { projectId, tasks } = phase1Output;

    console.log('\n' + '='.repeat(80));
    console.log('PHASE 2: PREPARATION (TaskQueue Population & Agent Startup)');
    console.log('='.repeat(80));

    this.socketServer.emitProjectStatus(projectId, 'in_progress', 'Phase 2: Preparing agents and task queue…');

    try {
      // Save tasks to database
      console.log(`\n[PHASE 2] Saving ${tasks.length} tasks to database...`);
      const savedTasks = await this.saveTasks(projectId, tasks);
      console.log(`✅ Saved ${savedTasks.length} tasks`);

      // Create TaskQueue entries
      console.log(`\n[PHASE 2] Creating TaskQueue entries...`);
      await this.populateTaskQueue(projectId, savedTasks, tasks);
      console.log(`✅ TaskQueue populated with ${savedTasks.length} entries`);

      // Register and start agents listening
      console.log(`\n[PHASE 2] Starting all agents in listening mode...`);
      await this.startAgents();
      console.log(`✅ All agents registered and listening`);

      console.log(`\n✅ PHASE 2 COMPLETE`);
      console.log(`   - ${savedTasks.length} tasks queued`);
      console.log(`   - Agents ready to claim tasks`);
      console.log(`   - Ready to move to Phase 3`);

      this.socketServer.emitProjectStatus(
        projectId,
        'in_progress',
        'Phase 2 complete. Starting parallel execution…'
      );

      return {
        projectId,
        queuedTaskCount: savedTasks.length,
        status: 'preparation_complete',
      };
    } catch (error) {
      console.error('❌ PHASE 2 FAILED:', error);
      this.socketServer.emitProjectStatus(
        projectId,
        'failed',
        `Phase 2 failed: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * PHASE 3: REFINEMENT
   * Design Director → Logic Agent → QA run targeted improvement passes
   * then rebuild the app with the polished code.
   */
  async phase3Execution(phase2Output: Phase2Output, userRequest: string, phase1Tasks: any[]): Promise<Phase3Output> {
    const { projectId } = phase2Output;

    console.log('\n' + '='.repeat(80));
    console.log('PHASE 3: REFINEMENT (Design Director → Logic → QA)');
    console.log('='.repeat(80));

    // Re-open project so the Dashboard shows agents working after the Phase 1 preview
    await prisma.project.update({ where: { id: projectId }, data: { status: 'in_progress' } });
    this.socketServer.emitProjectStatus(projectId, 'in_progress', 'Phase 3: Agent refinement pipeline starting…');

    try {
      const layoutTask = phase1Tasks.find((t: any) => t.taskId.startsWith('LAYOUT'));
      const stylingTask = phase1Tasks.find((t: any) => t.taskId.startsWith('STYLING'));
      const logicTask   = phase1Tasks.find((t: any) => t.taskId.startsWith('LOGIC'));
      const backendTask = phase1Tasks.find((t: any) => t.taskId.startsWith('BACKEND'));

      const html        = layoutTask?.generatedCode  || '';
      let   css         = stylingTask?.generatedCode || '';
      let   js          = logicTask?.generatedCode   || '';
      const backendCode = backendTask?.generatedCode;
      const backendPort = backendTask?.backendPort;

      const gen = this.orchestrator.generationService;

      // ── DESIGN DIRECTOR: refine CSS ──────────────────────────────────────
      console.log('\n[PHASE 3] Design Director refining CSS…');
      this.socketServer.emitAgentActivity(projectId, 'DESIGN_DIRECTOR', 'Reviewing visual design…');
      try {
        css = await this.refineDesign(gen, userRequest, html, css);
        // Persist improved CSS to the DB task record
        const dbStyling = await prisma.task.findFirst({ where: { projectId, taskId: { contains: 'STYLING' } } });
        if (dbStyling) await prisma.task.update({ where: { id: dbStyling.id }, data: { generatedCode: css } });
        console.log('✅ CSS refined');
        this.socketServer.emitAgentActivity(projectId, 'DESIGN_DIRECTOR', 'Visual design enhanced ✓');
      } catch (e) {
        console.warn('[PHASE 3] Design refinement failed, using Phase 1 CSS:', e);
        this.socketServer.emitAgentActivity(projectId, 'DESIGN_DIRECTOR', 'Design pass skipped — using Phase 1 output');
      }

      // ── LOGIC AGENT: refine JS ───────────────────────────────────────────
      console.log('\n[PHASE 3] Logic Agent refining JavaScript…');
      this.socketServer.emitAgentActivity(projectId, 'LOGIC', 'Reviewing JavaScript logic…');
      try {
        js = await this.refineLogic(gen, userRequest, html, js);
        const dbLogic = await prisma.task.findFirst({ where: { projectId, taskId: { contains: 'LOGIC' } } });
        if (dbLogic) await prisma.task.update({ where: { id: dbLogic.id }, data: { generatedCode: js } });
        console.log('✅ JS refined');
        this.socketServer.emitAgentActivity(projectId, 'LOGIC', 'Logic refined ✓');
      } catch (e) {
        console.warn('[PHASE 3] Logic refinement failed, using Phase 1 JS:', e);
        this.socketServer.emitAgentActivity(projectId, 'LOGIC', 'Logic pass skipped — using Phase 1 output');
      }

      // ── QA AGENT: validate ───────────────────────────────────────────────
      console.log('\n[PHASE 3] QA Agent validating…');
      this.socketServer.emitAgentActivity(projectId, 'QA', 'Running quality checks…');
      try {
        const qaReport = await this.runQACheck(gen, userRequest, html, css, js);
        this.socketServer.emitQAReport(projectId, qaReport);
        await prisma.project.update({ where: { id: projectId }, data: { qaReport: JSON.stringify(qaReport) } });
        console.log(`✅ QA complete — ${qaReport.status}`);
        this.socketServer.emitAgentActivity(projectId, 'QA', `QA complete — ${qaReport.status} ✓`);
      } catch (e) {
        console.warn('[PHASE 3] QA check failed:', e);
        this.socketServer.emitAgentActivity(projectId, 'QA', 'QA pass skipped');
      }

      // ── Rebuild with refined code ────────────────────────────────────────
      console.log('\n[PHASE 3] Rebuilding app with refined code…');
      const builder = ProjectBuilderService.getInstance();
      await builder.buildAndServe(projectId, html, css, js, backendCode, backendPort);

      this.socketServer.emitProjectStatus(projectId, 'completed', 'Refinement complete. App updated.');
      console.log('\n✅ PHASE 3 COMPLETE — app rebuilt with agent improvements');

      return { projectId, status: 'execution_started' };
    } catch (error) {
      console.error('❌ PHASE 3 FAILED:', error);
      // Don't fail the whole project — Phase 1 preview is already live
      await prisma.project.update({ where: { id: projectId }, data: { status: 'completed' } });
      this.socketServer.emitProjectStatus(projectId, 'completed', 'Phase 1 build complete (refinement pass failed).');
      return { projectId, status: 'execution_started' };
    }
  }

  private async refineDesign(gen: any, userRequest: string, html: string, css: string): Promise<string> {
    const prompt = `You are a Design Director doing a final CSS polish pass on a generated web app. Your job is to elevate it from "functional" to "polished product".

PROJECT: "${userRequest}"

HTML STRUCTURE:
${this.skeletonHTML(html)}

CURRENT CSS:
${css}

WHAT TO IMPROVE — be specific and thorough:

1. DESIGN SYSTEM: Ensure :root defines --color-primary, --color-primary-hover, --color-secondary, --color-accent, --color-bg, --color-surface, --color-surface-raised, --color-text, --color-text-muted, --color-border, --color-error, and spacing/radius/shadow tokens. Replace any hard-coded hex values with these variables.

2. COLOUR & CONTRAST: The palette must feel intentional for this project type (e.g. a finance app feels trustworthy/blue, a game feels vibrant, a productivity tool feels focused). Ensure WCAG AA contrast ratios between text and backgrounds.

3. TYPOGRAPHY: h1 should be 2rem+ with font-weight 800. Each heading level steps down clearly. Body text line-height: 1.6. Use letter-spacing on headings and uppercase labels.

4. INTERACTIVE STATES: Every button must have :hover (colour shift + translateY(-1px) + box-shadow), :active (translateY(0)), and :focus-visible (outline using --color-primary). Every input/select must have :focus border-color change + ring shadow.

5. COMPONENT POLISH: Cards need border-radius: var(--radius-md), background: var(--color-surface), box-shadow: var(--shadow-md). Empty states and error messages need appropriate colours and spacing. Badges/tags need padding, border-radius: var(--radius-sm), font-weight: 600.

6. ANIMATION: Add @keyframes fadeInUp (opacity 0→1, translateY 8px→0, 0.25s ease) and apply it to dynamically-inserted list items with .fade-in class. Add @keyframes spin for .loading-indicator.

7. RESPONSIVE: Mobile-first base styles, then @media (min-width: 640px) for tablet adjustments and @media (min-width: 1024px) for desktop. No horizontal overflow on mobile.

8. MICRO-DETAILS: Smooth scrollbar styling. Selection colour using ::selection. Placeholder styling with opacity: 0.5. Disabled state styling (opacity: 0.5, cursor: not-allowed).

OUTPUT: ONLY the complete refined CSS. No markdown fences, no explanations, no HTML.
CRITICAL: Preserve every existing class name and ID selector exactly — do not rename or remove any.`;

    const raw = await gen.generate(prompt);
    return raw.replace(/^```[\w]*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
  }

  private async refineLogic(gen: any, userRequest: string, html: string, js: string): Promise<string> {
    const prompt = `You are a senior JavaScript engineer doing a final quality pass on a generated web app. Your goal is to make it robust, complete, and production-ready.

PROJECT: "${userRequest}"

HTML STRUCTURE (only reference IDs that exist here):
${this.skeletonHTML(html)}

CURRENT JAVASCRIPT:
${js}

CRITICAL — DO THESE FIRST:
0. STUB ELIMINATION: Search for every // TODO, // FIXME, empty function body (function foo() {}), and placeholder comment. Replace EVERY one with a complete, working implementation. This is the highest priority task. A game without move validation, a form without submission logic, or a chart without data rendering is a broken app. Implement it fully.
   - For games: implement ALL rules — movement, validation, win/loss/draw detection, turn management
   - For data apps: implement ALL CRUD operations with localStorage
   - For UI: wire ALL missing event handlers

THEN DO THESE:
1. INPUT VALIDATION: Every input must be validated before use. Check for: empty strings (trim first), numbers out of range, invalid formats. Show errors via the nearest .error-message element (.textContent + .classList.add('visible')). Clear errors on correction.

2. EDGE CASES: Handle division by zero, empty arrays/lists, null DOM elements (check before calling methods), localStorage parse failures (wrap JSON.parse in try/catch with fallback to empty state).

3. ASYNC ROBUSTNESS: Every fetch/async call must: show a loading indicator before, hide it after (in finally block), disable the triggering button during the call, catch errors and show user-friendly messages.

4. MISSING HANDLERS: Verify EVERY button, input, form, select, and link in the HTML has an event listener. If any are missing, add them now.

5. KEYBOARD UX: Text inputs should submit on Enter (equivalent to clicking the primary action). Add keydown listeners where relevant.

6. DATA PERSISTENCE: If the app manages a list, settings, scores, or user data — save to localStorage on every change. Reload from localStorage on DOMContentLoaded with graceful fallback.

7. UX POLISH: Auto-focus the primary input on load. Format numbers with toLocaleString(). Add .fade-in class to dynamically inserted DOM elements. Show meaningful empty states when lists are empty.

8. BUG FIXES: Remove any getElementById/querySelector calls referencing IDs that do NOT exist in the HTML above.

9. NO REGRESSIONS: Keep all existing working functionality intact. Do not remove or rename any functions.

OUTPUT: ONLY the complete refined JavaScript with ZERO TODO comments and ZERO empty function bodies. No markdown fences, no <script> tags, no HTML, no explanations.`;

    const raw = await gen.generate(prompt);
    return raw.replace(/^```[\w]*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
  }

  private async runQACheck(gen: any, userRequest: string, html: string, css: string, js: string): Promise<any> {
    const prompt = `You are a QA Engineer doing a thorough review of a generated web application.

PROJECT REQUEST: "${userRequest}"

HTML:
${html.substring(0, 3000)}

CSS (first 2000 chars):
${css.substring(0, 2000)}

JAVASCRIPT (first 3000 chars):
${js.substring(0, 3000)}

Review the app against the project requirements and return ONLY valid JSON (no markdown, no explanation):
{
  "status": "PASS|FAIL|WARNING",
  "summary": "one sentence overall assessment",
  "functionalTests": [
    {"test": "specific feature or user action", "status": "PASS|FAIL", "issue": "what is broken or missing if FAIL"}
  ],
  "securityChecks": [
    {"check": "security concern name", "status": "PASS|WARNING|FAIL", "severity": "LOW|MEDIUM|HIGH|CRITICAL", "details": "specific finding"}
  ],
  "performanceIssues": ["specific issue description"],
  "recommendations": ["specific, actionable improvement"]
}

Include at least 4 functional tests covering the core user flows. Include at least 3 security checks (XSS, input sanitisation, unsafe eval usage, etc.).`;

    const raw = await gen.generate(prompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('QA response had no JSON');
    const parsed = JSON.parse(jsonMatch[0]);
    return { ...parsed, reviewedAt: new Date().toISOString() };
  }

  /**
   * Run all three phases in sequence
   */
  async orchestrateFullWorkflow(userRequest: string, projectId: string): Promise<void> {
    try {
      const phase1Output = await this.phase1Orchestration(userRequest, projectId);
      const phase2Output = await this.phase2Preparation(phase1Output);
      await this.phase3Execution(phase2Output, userRequest, phase1Output.tasks);

      console.log('\n' + '='.repeat(80));
      console.log('✅ ALL PHASES COMPLETE');
      console.log('='.repeat(80));
    } catch (error) {
      console.error('❌ WORKFLOW FAILED:', error);
      throw error;
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async saveTasks(
    projectId: string,
    tasks: any[]
  ): Promise<Array<{ id: string; taskId: string; description: string; status: string; priority: string }>> {
    const savedTasks = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const uniqueTaskId = `${task.taskId}-${projectId.substring(0, 8)}`;

      try {
        const savedTask = await prisma.task.upsert({
          where: {
            projectId_taskId: {
              projectId,
              taskId: uniqueTaskId,
            },
          },
          update: {
            description: task.description,
            status: task.status,
            priority: task.priority,
            estimatedHours: task.estimatedHours,
            dependencies: task.dependencies || [],
            generatedCode: task.generatedCode ?? null,
          },
          create: {
            projectId,
            taskId: uniqueTaskId,
            description: task.description,
            status: task.status,
            priority: task.priority,
            estimatedHours: task.estimatedHours,
            dependencies: task.dependencies || [],
            generatedCode: task.generatedCode ?? null,
          },
        });

        savedTasks.push(savedTask);
      } catch (err) {
        console.error(`Error saving task ${uniqueTaskId}:`, err);
      }
    }

    return savedTasks;
  }

  private async populateTaskQueue(
    projectId: string,
    savedTasks: any[],
    originalTasks: any[]
  ): Promise<void> {
    // Clear any existing queue entries
    await prisma.taskQueue.deleteMany({
      where: { projectId },
    });

    // Create new queue entries with Task.id (UUID)
    // Skip tasks that are already COMPLETE — Phase 1 already generated their code
    for (let i = 0; i < savedTasks.length; i++) {
      const savedTask = savedTasks[i];
      const task = originalTasks[i];

      if (savedTask.status === 'COMPLETE') {
        console.log(`[PHASE 2] Skipping queue entry for ${savedTask.taskId} — already COMPLETE`);
        continue;
      }

      try {
        const inferredType = this.inferAgentType(task);

        await prisma.taskQueue.create({
          data: {
            taskId: savedTask.id, // Use UUID
            projectId,
            agentType: inferredType as any,
            priority: task.priority || 'MEDIUM',
            requiredCapabilities: [],
          },
        });
      } catch (err: any) {
        if (!err.message.includes('Unique constraint')) {
          console.error(`Error queuing task ${savedTask.id}:`, err);
        }
      }
    }
  }

  private inferAgentType(task: any): string {
    const descLower = task.description?.toLowerCase() || '';
    const taskIdLower = (task.taskId || '').toLowerCase();

    // Check task ID first
    if (taskIdLower.includes('layout') || taskIdLower.includes('html') || taskIdLower.includes('structure')) {
      return 'LAYOUT';
    } else if (taskIdLower.includes('styling') || taskIdLower.includes('style') || taskIdLower.includes('css')) {
      return 'STYLING';
    } else if (taskIdLower.includes('logic') || taskIdLower.includes('javascript') || taskIdLower.includes('js')) {
      return 'LOGIC';
    }

    // Check description
    if (descLower.includes('html') || descLower.includes('structure') || descLower.includes('layout')) {
      return 'LAYOUT';
    } else if (descLower.includes('css') || descLower.includes('style') || descLower.includes('aesthetic')) {
      return 'STYLING';
    } else if (
      descLower.includes('javascript') ||
      descLower.includes('logic') ||
      descLower.includes('interactivity')
    ) {
      return 'LOGIC';
    }

    // Fallback by order
    if ((task.taskId || '').includes('-001')) {
      return 'LAYOUT';
    } else if ((task.taskId || '').includes('-002')) {
      return 'STYLING';
    } else if ((task.taskId || '').includes('-003')) {
      return 'LOGIC';
    }

    return 'LAYOUT';
  }

  private async startAgents(): Promise<void> {
    // Start agents listening on MessageBus
    // This must happen AFTER TaskQueue is populated but BEFORE Phase 3 triggers distribution
    console.log('[PHASE 2] Starting agents in listening mode...');

    // Call orchestrator to start parallel execution (registers agents and starts listening)
    await this.orchestrator.startParallelAgentExecution();

    console.log('[PHASE 2] ✅ All agents are now listening for tasks');
  }
}
