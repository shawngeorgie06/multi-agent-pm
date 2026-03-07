import { ProjectManagerAgent } from './ProjectManagerAgent.js';
import { EngineerAgent } from './EngineerAgent.js';
import { DesignDirectorAgent, type DesignBrief } from './DesignDirectorAgent.js';
import { ResearchAgent, type ResearchOutput } from './ResearchAgent.js';
import { FrontendAgent } from './FrontendAgent.js';
import { BackendAgent } from './BackendAgent.js';
import { LayoutAgent } from './LayoutAgent.js';
import { StylingAgent } from './StylingAgent.js';
import { LogicAgent } from './LogicAgent.js';
import { QAAgent, type QAReport } from './QAAgent.js';
import { ParsedMessage, ConversationMessage } from '../models/types.js';
import { SocketServer } from '../websocket/SocketServer.js';
import { MessageBus } from '../services/MessageBus.js';
import { TaskDistributionService } from '../services/TaskDistributionService.js';
import { TaskQueueManager } from '../services/TaskQueueManager.js';
import prisma from '../database/db.js';
import { MessageParser } from '../services/MessageParser.js';
import { ParallelExecutionEngine } from '../services/ParallelExecutionEngine.js';
import type { OllamaOptions } from '../services/OllamaService.js';
import { OllamaService } from '../services/OllamaService.js';
import { GeminiService } from '../services/GeminiService.js';

export interface ProjectContext {
  projectId?: string;
  initialRequest: string;
  allMessages: ConversationMessage[];
  tasks: any[];
  currentStatus: 'planning' | 'clarifying' | 'complete' | 'error';
  conversationRound: number;
  maxRounds: number;
  designBrief?: DesignBrief;
  researchOutput?: ResearchOutput;
  qaReport?: QAReport;
  generatedCode?: {
    frontend?: string;
    backend?: string;
  };
}

export class AgentOrchestrator {
  private pmAgent: ProjectManagerAgent;
  private engineerAgent: EngineerAgent;
  private designDirectorAgent: DesignDirectorAgent;
  private researchAgent: ResearchAgent;
  private frontendAgent: FrontendAgent;
  private backendAgent: BackendAgent;
  private layoutAgent: LayoutAgent;
  private stylingAgent: StylingAgent;
  private logicAgent: LogicAgent;
  private qaAgent: QAAgent;
  private context: ProjectContext;

  private socketServer?: SocketServer;
  private messageBus?: MessageBus;
  private taskQueueManager?: TaskQueueManager;
  private taskDistributionService?: TaskDistributionService;
  private parallelExecutionEngine?: ParallelExecutionEngine;
  private generationService: OllamaService | GeminiService;
  private executingAgents: Set<string> = new Set();

  constructor(
    maxRounds: number = 2,
    generationService: OllamaService | GeminiService,
    socketServer?: SocketServer,
    projectId?: string,
    messageBus?: MessageBus
  ) {
    this.generationService = generationService;
    this.pmAgent = new ProjectManagerAgent(generationService);
    this.engineerAgent = new EngineerAgent(generationService);
    this.designDirectorAgent = new DesignDirectorAgent(generationService);
    this.socketServer = socketServer;
    this.messageBus = messageBus;

    // Phase A3: Initialize agents with BaseAgent support (agentId + messageBus)
    if (this.messageBus) {
      this.researchAgent = new ResearchAgent('agent-research-1', this.messageBus, generationService);
      this.frontendAgent = new FrontendAgent('agent-frontend-1', this.messageBus, generationService);
      this.backendAgent = new BackendAgent('agent-backend-1', this.messageBus, generationService);
      this.layoutAgent = new LayoutAgent('agent-layout-1', this.messageBus, generationService);
      this.stylingAgent = new StylingAgent('agent-styling-1', this.messageBus, generationService);
      this.logicAgent = new LogicAgent('agent-logic-1', this.messageBus, generationService);
      this.qaAgent = new QAAgent('agent-qa-1', this.messageBus, generationService);
    } else {
      // Fallback for agents that don't require messageBus
      this.researchAgent = new ResearchAgent('agent-research-1', new MessageBus(), generationService);
      this.frontendAgent = new FrontendAgent('agent-frontend-1', new MessageBus(), generationService);
      this.backendAgent = new BackendAgent('agent-backend-1', new MessageBus(), generationService);
      this.layoutAgent = new LayoutAgent('agent-layout-1', new MessageBus(), generationService);
      this.stylingAgent = new StylingAgent('agent-styling-1', new MessageBus(), generationService);
      this.logicAgent = new LogicAgent('agent-logic-1', new MessageBus(), generationService);
      this.qaAgent = new QAAgent('agent-qa-1', new MessageBus(), generationService);
    }

    // Initialize Phase A2/A3 services if MessageBus is available
    if (this.messageBus) {
      this.taskQueueManager = new TaskQueueManager(undefined, this.messageBus);
      this.taskDistributionService = new TaskDistributionService(
        this.messageBus,
        this.taskQueueManager,
        this.socketServer
      );
      // Create a minimal taskStore for ParallelExecutionEngine
      const taskStore = {
        getTask: async () => null,
        updateTask: async () => {},
        saveTask: async () => {}
      } as any;
      this.parallelExecutionEngine = new ParallelExecutionEngine(this.messageBus, taskStore);
      this.setupParallelExecutionListeners();
    }

    this.context = {
      projectId,
      initialRequest: '',
      allMessages: [],
      tasks: [],
      currentStatus: 'planning',
      conversationRound: 0,
      maxRounds,
    };
  }

  /**
   * Setup listeners for parallel execution events
   * Phase A3: Monitor agent task claiming and execution progress
   */
  private setupParallelExecutionListeners(): void {
    if (!this.messageBus) return;

    // Listen on broadcast channel for all events
    this.messageBus.on('broadcast', async (envelope: any) => {
      const message = envelope.content || envelope;
      const eventType = message.event;

      // Track when agents come online
      if (eventType === 'agent:registered') {
        console.log(`[ORCHESTRATOR] Agent registered: ${message.agentId} (${message.agentType})`);
        this.executingAgents.add(message.agentId);
      }

      // Track when agents claim tasks
      else if (eventType === 'task:claimed') {
        console.log(`[ORCHESTRATOR] Task claimed: ${message.taskId} by ${message.agentId}`);
        if (this.socketServer && this.context.projectId) {
          // Fetch full task data to emit with IN_PROGRESS status
          const task = await prisma.task.findUnique({
            where: { id: message.taskId }
          });

          if (task) {
            // Emit task update with full task data
            this.socketServer.emitTaskUpdate(this.context.projectId, task);
          }

          this.socketServer.emitAgentActivity(
            this.context.projectId,
            message.agentType || 'AGENT',
            `Executing ${message.taskId}...`
          );
        }
      }

      // Track when tasks complete
      else if (eventType === 'task:completed') {
        console.log(`[ORCHESTRATOR] Task completed: ${message.taskId}`);
        if (this.socketServer && this.context.projectId) {
          this.socketServer.emitTaskUpdate(this.context.projectId, {
            id: message.taskId,
            status: 'COMPLETE'
          });
        }
      }

      // Track when tasks fail
      else if (eventType === 'task:failed') {
        console.log(`[ORCHESTRATOR] Task failed: ${message.taskId} - ${message.error}`);
        if (this.socketServer && this.context.projectId) {
          this.socketServer.emitTaskFailed(this.context.projectId, message.taskId, message.error);
        }
      }

      // Track task execution started
      else if (eventType === 'task:execution:started') {
        const agentName = this.getAgentDisplayName(message.agentId);
        const taskDescription = await this.getTaskDescription(message.taskId);

        console.log(`[ORCHESTRATOR] ${agentName} started task: ${message.taskId}`);
        if (this.socketServer && this.context.projectId) {
          this.socketServer.emitAgentProgress(
            this.context.projectId,
            agentName,
            'started',
            `Started working on: ${taskDescription}`
          );
        }
      }

      // Track task execution completed
      else if (eventType === 'task:execution:completed') {
        const agentName = this.getAgentDisplayName(message.agentId);
        const taskDescription = await this.getTaskDescription(message.taskId);

        console.log(`[ORCHESTRATOR] ${agentName} completed task: ${message.taskId}`);
        if (this.socketServer && this.context.projectId) {
          this.socketServer.emitAgentProgress(
            this.context.projectId,
            agentName,
            'completed',
            `Finished: ${taskDescription}`
          );
        }
      }

      // Track execution progress
      else if (eventType === 'task:progress') {
        const agentName = this.getAgentDisplayName(message.agentId);

        if (this.socketServer && this.context.projectId) {
          this.socketServer.emitAgentProgress(
            this.context.projectId,
            agentName,
            'progress',
            message.message
          );
        }
      }
    });
  }

  /**
   * Get human-readable agent display name from agentId
   */
  private getAgentDisplayName(agentId: string): string {
    if (agentId.includes('layout')) return 'Layout Agent';
    if (agentId.includes('styling')) return 'Styling Agent';
    if (agentId.includes('logic')) return 'Logic Agent';
    if (agentId.includes('frontend')) return 'Frontend Agent';
    if (agentId.includes('backend')) return 'Backend Agent';
    if (agentId.includes('research')) return 'Research Agent';
    if (agentId.includes('qa')) return 'QA Agent';
    return agentId;
  }

  /**
   * Get task description from database
   */
  private async getTaskDescription(taskId: string): Promise<string> {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { description: true, taskId: true }
      });

      if (task) {
        const shortDesc = task.description.substring(0, 80);
        return shortDesc + (task.description.length > 80 ? '...' : '');
      }
    } catch (error) {
      console.error('[ORCHESTRATOR] Error fetching task description:', error);
    }
    return 'task';
  }

  /**
   * Emit to both SocketServer and MessageBus
   * Maintains backward compatibility with WebSocket while introducing event-driven architecture
   */
  private emitEvent(eventName: string, data: any): void {
    if (this.messageBus) {
      this.messageBus.broadcast({
        event: eventName,
        projectId: this.context.projectId,
        timestamp: new Date(),
        ...data
      });
    }
  }

  /**
   * Start the project planning conversation
   */
  async startProjectPlanning(userRequest: string): Promise<ProjectContext> {
    console.log('Starting project planning...\n');
    console.log('='.repeat(60));
    console.log('USER REQUEST:', userRequest);
    console.log('='.repeat(60));
    console.log('\n');

    this.context.initialRequest = userRequest;
    this.context.currentStatus = 'planning';
    this.context.conversationRound = 1;

    // Emit to MessageBus that planning started
    this.emitEvent('project:planning:started', {
      userRequest
    });

    try {
      // Step 0: Design Director creates design brief (for web projects) - non-streaming, can take 1–2 min
      const isWebProject = /website|web page|html|calculator|app|ui|frontend|page|landing/i.test(userRequest);
      if (isWebProject) {
        console.log('[ORCHESTRATOR] STEP 0: Design Director creating brief (non-streaming, may take 1–2 min)\n');
        if (this.socketServer && this.context.projectId) {
          this.socketServer.emitProjectStatus(this.context.projectId, 'in_progress', 'Design Director creating brief…');
          this.socketServer.emitAgentActivity(this.context.projectId, 'DESIGN_DIRECTOR', 'Creating design brief… (no streaming—waiting for Ollama)');
        }
        this.context.designBrief = await this.designDirectorAgent.createDesignBrief(userRequest);
        console.log('Design brief:', this.context.designBrief.aesthetic, '\n');
      }

      // Step 1: Get PM's project plan with retry logic
      console.log('STEP 1: Project Manager creates project plan\n');
      const pmMessageId = this.generateMessageId();
      const designBriefRaw = this.context.designBrief?.raw;
      let pmPlan = await this.pmAgent.generateProjectPlan(
        userRequest,
        (chunk) => this.emitStreamChunk('PROJECT_MANAGER', pmMessageId, chunk),
        designBriefRaw
      );

      this.addPMMessageToContext(pmPlan, pmMessageId);
      this.emitMessageComplete(pmMessageId);

      // Check if we got a valid plan - retry if 0 tasks extracted
      if (!pmPlan.tasks || pmPlan.tasks.length === 0) {
        console.warn('[ORCHESTRATOR] 0 tasks extracted from PM response - attempting retry with simpler prompt');
        this.emitParsingError(pmMessageId, 'No tasks extracted from PM response, retrying with simpler prompt...');

        // Retry once with a simpler prompt
        try {
          const retryMessageId = this.generateMessageId();
          pmPlan = await this.pmAgent.generateProjectPlan(
            `${userRequest} - Please respond with EXACTLY 3 simple tasks for this project.`,
            (chunk) => this.emitStreamChunk('PROJECT_MANAGER', retryMessageId, chunk),
            designBriefRaw
          );
          this.addPMMessageToContext(pmPlan, retryMessageId);
          this.emitMessageComplete(retryMessageId);

          console.log(`[ORCHESTRATOR] Retry result: ${pmPlan.tasks?.length || 0} tasks extracted`);

          // If still no tasks, use fallback
          if (!pmPlan.tasks || pmPlan.tasks.length === 0) {
            console.warn('[ORCHESTRATOR] Retry also failed - using fallback tasks');
            this.emitParsingError(pmMessageId, 'Task extraction failed after retry. Using fallback generic tasks.');
            pmPlan.tasks = MessageParser.generateFallbackTasks(userRequest);
          }
        } catch (retryError) {
          console.error('[ORCHESTRATOR] Retry attempt failed:', retryError);
          this.emitParsingError(pmMessageId, `Retry failed with error: ${retryError instanceof Error ? retryError.message : String(retryError)}`);
          pmPlan.tasks = MessageParser.generateFallbackTasks(userRequest);
        }
      }

      if (!pmPlan.tasks || pmPlan.tasks.length === 0) {
        console.error('[ORCHESTRATOR] No tasks available even after retry and fallback - critical failure');
        this.emitParsingError(pmMessageId, 'Critical: Could not extract or generate any tasks. Aborting project planning.');
        this.context.currentStatus = 'error';
        return this.context;
      }

      console.log(`[ORCHESTRATOR] Successfully extracted ${pmPlan.tasks.length} tasks from PM plan\n`);
      this.context.tasks = pmPlan.tasks;

      // Emit tasks immediately so UI shows them during conversation
      if (this.socketServer && this.context.projectId) {
        for (const t of pmPlan.tasks) {
          this.socketServer.emitTaskStreamed(this.context.projectId, {
            taskId: t.taskId,
            description: t.description,
            status: t.status,
            priority: t.priority,
            estimatedHours: t.estimatedHours,
            dependencies: t.dependencies,
          });
        }
      }

      // Emit to MessageBus that tasks were extracted
      this.emitEvent('tasks:extracted', {
        count: pmPlan.tasks.length,
        tasks: pmPlan.tasks
      });

      // Step 2: Get Engineer's response
      console.log('STEP 2: Engineer reviews project plan\n');
      const engMessageId1 = this.generateMessageId();
      const engineerResponse = await this.engineerAgent.respondToProjectPlan(
        pmPlan.content,
        (chunk) => this.emitStreamChunk('ENGINEER', engMessageId1, chunk)
      );

      this.addEngineerMessageToContext(engineerResponse);

      // Step 3: Loop for clarifications if needed
      if (engineerResponse.questions.length > 0 || engineerResponse.blockers.length > 0) {
        console.log(
          `\nEngineer has ${engineerResponse.questions.length} questions and ${engineerResponse.blockers.length} blockers\n`
        );

        for (let round = 2; round <= this.context.maxRounds; round++) {
          this.context.conversationRound = round;

          // Force exit if we've reached the max rounds - CHECK FIRST before generating any steps
          if (round > this.context.maxRounds) {
            console.log(`\n[ORCHESTRATOR] Reached max conversation rounds (${this.context.maxRounds}) - ending planning\n`);
            break;
          }

          // Check if we should stop
          if (engineerResponse.blockers.length === 0 && engineerResponse.questions.length === 0) {
            console.log('\n[ORCHESTRATOR] No more questions/blockers from Engineer - planning complete\n');
            break;
          }

          console.log(`\nSTEP ${round * 2}: Project Manager addresses concerns\n`);

          const pmMessageId2 = this.generateMessageId();
          const pmResponse = await this.pmAgent.respondToEngineer(
            engineerResponse.content,
            (chunk) => this.emitStreamChunk('PROJECT_MANAGER', pmMessageId2, chunk)
          );
          this.addPMMessageToContext(pmResponse, pmMessageId2);
          this.emitMessageComplete(pmMessageId2);

          console.log(`\nSTEP ${round * 2 + 1}: Engineer confirms understanding\n`);

          const engMessageId2 = this.generateMessageId();
          const engineerConfirm = await this.engineerAgent.respondToProjectManager(
            pmResponse.content,
            (chunk) => this.emitStreamChunk('ENGINEER', engMessageId2, chunk)
          );
          this.addEngineerMessageToContext(engineerConfirm, engMessageId2);
          this.emitMessageComplete(engMessageId2);

          // If no more blockers/questions, we're done clarifying
          if (engineerConfirm.blockers.length === 0 && engineerConfirm.questions.length === 0) {
            console.log('\n[ORCHESTRATOR] No more questions/blockers from Engineer - planning complete\n');
            break;
          }
        }
      }

      this.context.currentStatus = 'complete';
      console.log('\n' + '='.repeat(60));
      console.log('PROJECT PLANNING COMPLETE');
      console.log('='.repeat(60));

      // Emit to MessageBus that planning completed
      this.emitEvent('project:planning:completed', {
        taskCount: this.context.tasks.length,
        status: 'complete'
      });
    } catch (error) {
      console.error('Error during project planning:', error);
      this.context.currentStatus = 'error';

      // Emit to MessageBus that planning failed
      this.emitEvent('project:planning:failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return this.context;
  }

  /**
   * Start autonomous parallel agent execution
   * Phase A3: Agents autonomously claim and execute tasks from TaskQueue
   * Returns when all agents are started and listening, not when execution completes
   */
  async startParallelAgentExecution(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('STARTING PARALLEL AGENT EXECUTION (Phase A3)');
    console.log('='.repeat(60) + '\n');

    if (!this.messageBus || !this.parallelExecutionEngine) {
      console.error('[ORCHESTRATOR] MessageBus and ParallelExecutionEngine required for parallel execution');
      return;
    }

    try {
      // Register agents with the execution engine
      const agents = [
        { id: 'agent-research-1', type: 'RESEARCH', caps: ['research', 'analysis', 'architecture'], agent: this.researchAgent },
        { id: 'agent-frontend-1', type: 'FRONTEND', caps: ['html', 'css', 'javascript', 'react', 'typescript'], agent: this.frontendAgent },
        { id: 'agent-backend-1', type: 'BACKEND', caps: ['nodejs', 'express', 'typescript', 'restapi'], agent: this.backendAgent },
        { id: 'agent-layout-1', type: 'LAYOUT', caps: ['html', 'semantic-html', 'accessibility'], agent: this.layoutAgent },
        { id: 'agent-styling-1', type: 'STYLING', caps: ['css', 'design', 'responsive'], agent: this.stylingAgent },
        { id: 'agent-logic-1', type: 'LOGIC', caps: ['javascript', 'event-handling', 'state-management'], agent: this.logicAgent },
        { id: 'agent-qa-1', type: 'QA', caps: ['testing', 'quality-assurance'], agent: this.qaAgent }
      ];

      // Register all agents with execution engine
      console.log('[ORCHESTRATOR] Registering agents with ParallelExecutionEngine...');
      for (const agent of agents) {
        await this.parallelExecutionEngine.registerAgent(agent.id, agent.type, agent.caps);
      }

      // Start execution for the project
      if (this.context.projectId) {
        await this.parallelExecutionEngine.startExecuting(this.context.projectId);
      }

      // Start all agents listening for tasks
      console.log('[ORCHESTRATOR] Starting all agents in listening mode...');
      for (const agent of agents) {
        await (agent.agent as any).startListening();
        console.log(`[ORCHESTRATOR] Agent ${agent.id} (${agent.type}) started listening for tasks`);
      }

      // Emit event that parallel execution has started
      this.emitEvent('execution:parallel:started', {
        agentCount: agents.length,
        projectId: this.context.projectId
      });

      if (this.socketServer && this.context.projectId) {
        this.socketServer.emitProjectStatus(
          this.context.projectId,
          'in_progress',
          `Parallel execution started with ${agents.length} agents listening...`
        );
      }

      console.log('[ORCHESTRATOR] All agents started and listening for tasks');
      console.log('[ORCHESTRATOR] Execution will proceed autonomously based on TaskQueue\n');
    } catch (error) {
      console.error('[ORCHESTRATOR] Error starting parallel agent execution:', error);
      this.emitEvent('execution:parallel:failed', {
        error: error instanceof Error ? error.message : String(error)
      });

      if (this.socketServer && this.context.projectId) {
        this.socketServer.emitProjectStatus(
          this.context.projectId,
          'error',
          `Failed to start parallel execution: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Get execution metrics for the current project
   * Phase A3: Returns metrics from ParallelExecutionEngine
   */
  async getExecutionMetrics(): Promise<any> {
    if (!this.parallelExecutionEngine || !this.context.projectId) {
      return null;
    }

    try {
      return await this.parallelExecutionEngine.getProjectProgress(this.context.projectId);
    } catch (error) {
      console.error('[ORCHESTRATOR] Error getting execution metrics:', error);
      return null;
    }
  }

  /**
   * Execute the multi-agent workflow for enhanced code generation
   */
  async executeMultiAgentWorkflow(): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('EXECUTING MULTI-AGENT WORKFLOW');
    console.log('='.repeat(60) + '\n');

    try {
      // Phase 1: Research
      console.log('PHASE 1: Research Agent analyzes requirements\n');
      if (this.socketServer && this.context.projectId) {
        this.socketServer.emitProjectStatus(this.context.projectId, 'in_progress', 'Research Agent analyzing requirements…');
        this.socketServer.emitAgentActivity(this.context.projectId, 'RESEARCH', 'Analyzing project requirements…');
      }

      const researchOutput = await this.researchAgent.analyzeProject(
        this.context.initialRequest,
        this.context.tasks.map((t) => t.description)
      );

      this.context.researchOutput = researchOutput;

      if (this.socketServer && this.context.projectId) {
        this.socketServer.emitAgentActivity(
          this.context.projectId,
          'RESEARCH',
          `Analysis complete: ${researchOutput.projectType} project with ${researchOutput.requirements.functional.length} functional requirements`
        );
      }

      console.log(`Research complete: ${researchOutput.projectType} project\n`);

      // Phase 2: Code Generation (parallel or sequential based on project type)
      console.log('PHASE 2: Generating code based on project type\n');

      const generatedCode: { frontend?: string; backend?: string } = {};

      if (researchOutput.projectType === 'web') {
        // Frontend only
        if (this.socketServer && this.context.projectId) {
          this.socketServer.emitAgentActivity(this.context.projectId, 'FRONTEND', 'Generating frontend code…');
        }

        generatedCode.frontend = await this.frontendAgent.generateCode(
          this.context.initialRequest,
          researchOutput,
          this.context.designBrief?.raw,
          (msg) => {
            if (this.socketServer && this.context.projectId) {
              this.socketServer.emitAgentActivity(this.context.projectId, 'FRONTEND', msg);
            }
          }
        );

        if (this.socketServer && this.context.projectId) {
          this.socketServer.emitAgentActivity(this.context.projectId, 'FRONTEND', `Frontend complete: ${generatedCode.frontend?.length || 0} bytes of code`);
        }
      } else if (researchOutput.projectType === 'fullstack') {
        // Frontend + Backend parallel
        if (this.socketServer && this.context.projectId) {
          this.socketServer.emitAgentActivity(this.context.projectId, 'FRONTEND', 'Generating frontend code…');
          this.socketServer.emitAgentActivity(this.context.projectId, 'BACKEND', 'Generating backend code…');
        }

        const [frontendCode, backendCode] = await Promise.all([
          this.frontendAgent.generateCode(
            this.context.initialRequest,
            researchOutput,
            this.context.designBrief?.raw,
            (msg) => {
              if (this.socketServer && this.context.projectId) {
                this.socketServer.emitAgentActivity(this.context.projectId, 'FRONTEND', msg);
              }
            }
          ),
          this.backendAgent.generateCode(
            this.context.initialRequest,
            researchOutput,
            (msg) => {
              if (this.socketServer && this.context.projectId) {
                this.socketServer.emitAgentActivity(this.context.projectId, 'BACKEND', msg);
              }
            }
          ),
        ]);

        generatedCode.frontend = frontendCode;
        generatedCode.backend = backendCode;

        if (this.socketServer && this.context.projectId) {
          this.socketServer.emitAgentActivity(this.context.projectId, 'FRONTEND', `Frontend complete: ${frontendCode.length} bytes`);
          this.socketServer.emitAgentActivity(this.context.projectId, 'BACKEND', `Backend complete: ${backendCode.length} bytes`);
        }
      } else if (researchOutput.projectType === 'api') {
        // Backend only
        if (this.socketServer && this.context.projectId) {
          this.socketServer.emitAgentActivity(this.context.projectId, 'BACKEND', 'Generating API code…');
        }

        generatedCode.backend = await this.backendAgent.generateCode(
          this.context.initialRequest,
          researchOutput,
          (msg) => {
            if (this.socketServer && this.context.projectId) {
              this.socketServer.emitAgentActivity(this.context.projectId, 'BACKEND', msg);
            }
          }
        );

        if (this.socketServer && this.context.projectId) {
          this.socketServer.emitAgentActivity(this.context.projectId, 'BACKEND', `API complete: ${generatedCode.backend?.length || 0} bytes`);
        }
      }

      this.context.generatedCode = generatedCode;
      console.log('Code generation complete\n');

      // Phase 3: QA Validation
      console.log('PHASE 3: QA Agent validating code\n');
      if (this.socketServer && this.context.projectId) {
        this.socketServer.emitAgentActivity(this.context.projectId, 'QA', 'Validating generated code…');
      }

      const qaReport = await this.qaAgent.validateProject(
        this.context.initialRequest,
        researchOutput,
        generatedCode,
        (msg) => {
          if (this.socketServer && this.context.projectId) {
            this.socketServer.emitAgentActivity(this.context.projectId, 'QA', msg);
          }
        }
      );

      this.context.qaReport = qaReport;

      if (this.socketServer && this.context.projectId) {
        this.socketServer.emitAgentActivity(
          this.context.projectId,
          'QA',
          `Validation complete: ${qaReport.functionalTests.filter((t) => t.status === 'PASS').length}/${qaReport.functionalTests.length} tests passed`
        );
      }

      console.log(`QA validation complete: ${qaReport.status}\n`);

      console.log('='.repeat(60));
      console.log('MULTI-AGENT WORKFLOW COMPLETE');
      console.log('='.repeat(60) + '\n');
    } catch (error) {
      console.error('Error during multi-agent workflow:', error);
      if (this.socketServer && this.context.projectId) {
        this.socketServer.emitAgentActivity(
          this.context.projectId,
          'ORCHESTRATOR',
          `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  /**
   * Add PM message to context
   */
  private addPMMessageToContext(parsed: ParsedMessage, streamingMessageId?: string): void {
    this.context.allMessages.push({
      fromAgent: 'PROJECT_MANAGER',
      toAgent: 'ENGINEER',
      messageType: parsed.messageType,
      content: parsed.content,
      metadata: {
        tasks: parsed.tasks,
        questions: parsed.questions,
        streamingMessageId,
      },
    });
  }

  /**
   * Add Engineer message to context
   */
  private addEngineerMessageToContext(parsed: ParsedMessage, streamingMessageId?: string): void {
    this.context.allMessages.push({
      fromAgent: 'ENGINEER',
      toAgent: 'PROJECT_MANAGER',
      messageType: parsed.messageType,
      content: parsed.content,
      metadata: {
        questions: parsed.questions,
        blockers: parsed.blockers,
        streamingMessageId,
      },
    });
  }

  /**
   * Emit message_complete when a streaming message finishes
   */
  private emitMessageComplete(messageId: string): void {
    if (this.socketServer && this.context.projectId) {
      this.socketServer.emitMessageComplete(this.context.projectId, messageId);
    }
  }

  /**
   * Get the current context
   */
  getContext(): ProjectContext {
    return this.context;
  }

  /**
   * Get all messages in conversation
   */
  getAllMessages(): ConversationMessage[] {
    return this.context.allMessages;
  }

  /**
   * Get extracted tasks
   */
  getTasks(): any[] {
    return this.context.tasks;
  }

  /**
   * Get design brief from Design Director
   */
  getDesignBrief(): DesignBrief | undefined {
    return this.context.designBrief;
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emit a streaming chunk via WebSocket
   */
  private emitStreamChunk(agent: string, messageId: string, chunk: string): void {
    if (this.socketServer && this.context.projectId) {
      this.socketServer.emitMessageChunk(
        this.context.projectId,
        messageId,
        agent,
        chunk
      );
    }
  }

  /**
   * Emit parsing error to frontend
   */
  private emitParsingError(messageId: string, errorMessage: string): void {
    if (this.socketServer && this.context.projectId) {
      this.socketServer.emitParsingError(this.context.projectId, messageId, errorMessage);
    }
  }

  /**
   * Distribute queued tasks for a project
   * Used by Phase A3 to trigger task distribution after agents start listening
   */
  async distributeQueuedTasksForProject(projectId: string): Promise<void> {
    if (!this.taskDistributionService) {
      console.error('[ORCHESTRATOR] TaskDistributionService not initialized');
      return;
    }
    await this.taskDistributionService.distributeQueuedTasksInParallel(projectId);
  }
}
