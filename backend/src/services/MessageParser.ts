import { ParsedMessage, TaskInfo, MessageType, TaskStatus, TaskPriority } from '../models/types.js';

export class MessageParser {
  /**
   * Parse agent message and extract structured data with error handling
   */
  static parseMessage(rawMessage: string, fromAgent: string): ParsedMessage {
    try {
      const messageType = this.extractMessageType(rawMessage);
      const taskId = this.extractTaskId(rawMessage);
      const tasks = this.extractTasks(rawMessage);
      const questions = this.extractQuestions(rawMessage);
      const blockers = this.extractBlockers(rawMessage);
      const codeOutput = this.extractCodeBlock(rawMessage);

      // Log parsing result for debugging
      console.log(`[PARSER] From ${fromAgent}: extracted ${tasks.length} tasks, ${questions.length} questions, ${blockers.length} blockers`);

      return {
        messageType,
        taskId,
        content: rawMessage,
        tasks,
        questions,
        blockers,
        codeOutput,
      };
    } catch (error) {
      console.error(`[PARSER_ERROR] Failed to parse message from ${fromAgent}:`, error);
      // Return minimal valid response instead of throwing
      return {
        messageType: 'STATUS_CHECK',
        taskId: undefined,
        content: rawMessage,
        tasks: [],
        questions: [],
        blockers: [],
        codeOutput: undefined,
      };
    }
  }

  /**
   * Extract message type from message
   */
  private static extractMessageType(message: string): MessageType {
    const typeMatch = message.match(/\*\*MESSAGE_TYPE:\*?\s*(\w+)/i);
    if (typeMatch) {
      const type = typeMatch[1].toUpperCase();
      const validTypes: MessageType[] = [
        'PROJECT_PLAN',
        'TASK_ASSIGNMENT',
        'STATUS_CHECK',
        'BLOCKER_RESPONSE',
        'CLARIFICATION_REQUEST',
        'PROGRESS_UPDATE',
        'ESTIMATE_REQUEST',
        'BLOCKER_ALERT',
        'IMPLEMENTATION_COMPLETE',
        'CLARIFICATION_NEEDED',
        'CLARIFICATION_RESPONSE',
      ];
      if (validTypes.includes(type as MessageType)) {
        return type as MessageType;
      }
    }
    return 'STATUS_CHECK';
  }

  /**
   * Extract task ID from message
   */
  private static extractTaskId(message: string): string | undefined {
    const taskMatch = message.match(/\*\*TASK_ID:\*?\s*([\w-]+)/i);
    return taskMatch ? taskMatch[1] : undefined;
  }

  /**
   * Extract all tasks mentioned in the message
   */
  private static extractTasks(message: string): TaskInfo[] {
    const tasks: TaskInfo[] = [];
    const seenTaskNumbers = new Set<number>(); // Prevent duplicate task numbers

    // More flexible task delimiters: handle "Subtask 1:", "Task 1:", "**Task 1:**", "### Task 1", "1. Task Name", "- Task Name", etc.
    // Also look for "**Task**: Description" patterns
    const taskSections = message.split(/(?:^|\n)(?:(?:\*\*\s*)?(?:#{1,3}\s+)?(?:Sub)?[Tt]ask\s+(\d+)[:\s*]*|(\d+)\.\s+(?=[A-Z])|\*\*[Tt]ask\*\*:|^-\s+(?=[A-Z]))/m);

    let taskCounter = 0;
    for (let i = 1; i < taskSections.length; i += 3) {
      // Regex can capture in group 1 or 2
      let taskNumber = taskSections[i] || taskSections[i + 1];

      // If no explicit number found, use counter for numbered lists
      if (!taskNumber) {
        taskCounter++;
        taskNumber = String(taskCounter);
      } else {
        taskCounter = parseInt(taskNumber);
      }

      // Skip if we've already seen this task number
      if (seenTaskNumbers.has(parseInt(taskNumber))) {
        continue;
      }
      seenTaskNumbers.add(parseInt(taskNumber));

      const taskContent = taskSections[i + 2] || '';
      if (!taskContent.trim()) continue;

      // Get first line as title (strip markdown)
      const lines = taskContent.split('\n');
      let taskTitle = (lines[0] || '').replace(/^\*\*/, '').replace(/\*\*$/, '').trim();

      // If first line is empty or just punctuation, try next line
      if (!taskTitle || taskTitle.length < 3) {
        taskTitle = (lines[1] || '').replace(/^\*\*/, '').replace(/\*\*$/, '').trim();
      }

      const taskDetails = lines.slice(1).join('\n');

      // Extract effort (handle various formats: "5 hours", "5h", "10 minutes", "30 mins", etc.)
      const effortMatch = taskDetails.match(/Effort:\s*([0-9.]+)\s*(hours?|h|minutes?|mins?)?/i);
      let estimatedHours: number | undefined;
      if (effortMatch) {
        const value = parseFloat(effortMatch[1]);
        const unit = (effortMatch[2] || '').toLowerCase();
        // Convert to hours
        if (unit.includes('min')) {
          estimatedHours = value / 60; // Convert minutes to hours
        } else {
          estimatedHours = value; // Already in hours
        }
      }

      // Extract priority
      const priorityMatch = taskDetails.match(/Priority:\s*(HIGH|MEDIUM|LOW)/i);
      const priority = (priorityMatch ? priorityMatch[1] : 'MEDIUM') as TaskPriority;

      // Extract dependencies (temporarily store as strings, will resolve to task IDs later)
      const depsMatch = taskDetails.match(/Dependencies?:\s*([^\n]+)/i);
      const depsText = depsMatch ? depsMatch[1].toLowerCase() : '';
      const dependencyRefs: string[] = [];

      // Extract task ID references (e.g., "PM-001")
      const taskIdMatches = depsText.match(/[A-Z]+-\d+/gi);
      if (taskIdMatches) {
        dependencyRefs.push(...taskIdMatches);
      }

      // Extract "Subtask X" or "Task X" references
      const subtaskMatches = depsText.match(/(?:sub)?task\s+(\d+)/gi);
      if (subtaskMatches) {
        subtaskMatches.forEach(match => {
          const num = match.match(/(\d+)/);
          if (num) {
            dependencyRefs.push(`SUBTASK_${num[1]}`); // Temporary marker
          }
        });
      }

      // Extract acceptance criteria
      const criteriaMatch = taskDetails.match(/Acceptance Criteria:\s*([^\n]+(?:\n[^\n]+)*)/i);
      const criteria = criteriaMatch ? criteriaMatch[1] : '';

      const taskId = `PM-${String(parseInt(taskNumber)).padStart(3, '0')}`;

      // Only add if we have a reasonable title
      if (taskTitle && taskTitle.length > 2) {
        tasks.push({
          taskId,
          description: `${taskTitle}${criteria ? `\n\nCriteria: ${criteria}` : ''}`,
          status: 'TODO' as TaskStatus,
          priority,
          estimatedHours,
          dependencies: dependencyRefs.length > 0 ? dependencyRefs : undefined,
        });
      }
    }

    // Second pass: resolve "SUBTASK_X" references to actual task IDs
    tasks.forEach(task => {
      if (task.dependencies && task.dependencies.length > 0) {
        task.dependencies = task.dependencies.map(dep => {
          const subtaskMatch = dep.match(/^SUBTASK_(\d+)$/);
          if (subtaskMatch) {
            const subtaskNum = parseInt(subtaskMatch[1]);
            // Find the task with this number (PM-001 for Subtask 1, PM-002 for Subtask 2, etc.)
            const targetTask = tasks.find(t => t.taskId === `PM-${String(subtaskNum).padStart(3, '0')}`);
            return targetTask ? targetTask.taskId : dep;
          }
          return dep;
        }).filter(dep => dep && !dep.startsWith('SUBTASK_')); // Remove unresolved markers
      }
    });

    return tasks;
  }

  /**
   * Extract questions from the message
   */
  private static extractQuestions(message: string): string[] {
    const questions: string[] = [];

    // Look for questions in dedicated sections
    const questionSectionMatch = message.match(
      /(?:\*\*)?Questions?(?:\*\*)?.*?:?\s*\n([\s\S]*?)(?=\n\n|\*\*|$)/i
    );

    if (questionSectionMatch) {
      const questionText = questionSectionMatch[1];
      // Extract bullet points and numbered items
      const questionMatches = questionText.match(/(?:^|\n)\s*[-•*]\s+(.+?)(?=\n|$)/gm);
      if (questionMatches) {
        questionMatches.forEach((q) => {
          const cleaned = q.replace(/^[-•*]\s+/, '').trim();
          if (cleaned) questions.push(cleaned);
        });
      }
    }

    // Also look for inline questions (lines ending with ?)
    const inlineQuestions = message.match(/(?:^|\n)\s*[-•*]?\s*(.+\?)\s*$/gm);
    if (inlineQuestions) {
      inlineQuestions.forEach((q) => {
        const cleaned = q.replace(/^[-•*]\s+/, '').trim();
        if (cleaned && !questions.includes(cleaned)) {
          questions.push(cleaned);
        }
      });
    }

    return questions;
  }

  /**
   * Extract blockers from the message
   */
  private static extractBlockers(message: string): string[] {
    const blockers: string[] = [];

    // Look for blocker sections
    const blockerSectionMatch = message.match(
      /(?:\*\*)?BLOCKERS?(?:\*\*)?.*?:?\s*\n([\s\S]*?)(?=\n\n|\*\*|$)/i
    );

    if (blockerSectionMatch) {
      const blockerText = blockerSectionMatch[1];
      const blockerMatches = blockerText.match(/(?:^|\n)\s*[-•*]\s+(.+?)(?=\n|$)/gm);
      if (blockerMatches) {
        blockerMatches.forEach((b) => {
          const cleaned = b.replace(/^[-•*]\s+/, '').trim();
          if (cleaned && !cleaned.toLowerCase().includes('none')) {
            blockers.push(cleaned);
          }
        });
      }
    }

    // Look for inline BLOCKER patterns
    const inlineBlocers = message.match(/BLOCKER:\s*(.+?)(?:\n|$)/gi);
    if (inlineBlocers) {
      inlineBlocers.forEach((b) => {
        const cleaned = b.replace(/^BLOCKER:\s*/, '').trim();
        if (cleaned && !blockers.includes(cleaned)) {
          blockers.push(cleaned);
        }
      });
    }

    return blockers;
  }

  /**
   * Extract code block from message
   */
  private static extractCodeBlock(message: string): string | undefined {
    // Look for markdown code blocks
    const codeMatch = message.match(/```[\w]*\n([\s\S]*?)\n```/);
    if (codeMatch) {
      return codeMatch[1];
    }

    // Look for indented code blocks
    const indentedMatch = message.match(/(?:^|\n)((?:\s{4}.*(?:\n|$))+)/m);
    if (indentedMatch) {
      return indentedMatch[1].replace(/^\s{4}/gm, '');
    }

    return undefined;
  }

  /**
   * Format a message into the standard agent message format
   */
  static formatAgentMessage(
    messageType: MessageType,
    content: string,
    taskId?: string
  ): string {
    let formatted = `**MESSAGE_TYPE:** ${messageType}\n`;

    if (taskId) {
      formatted += `**TASK_ID:** ${taskId}\n`;
    }

    formatted += `**STATUS:** Pending\n\n`;
    formatted += content;

    return formatted;
  }

  /**
   * Generate fallback tasks when parsing fails completely
   * Used as a last-resort safety net to avoid silent failures
   */
  static generateFallbackTasks(projectDescription: string): TaskInfo[] {
    console.log('[PARSER] Generating fallback tasks due to parsing failure');

    // Detect project type for more relevant fallback tasks
    const isWebProject = /website|web page|html|calculator|app|ui|frontend|page|landing|interface|form/i.test(projectDescription);
    const isAPI = /api|backend|server|database|integration/i.test(projectDescription);

    if (isWebProject) {
      return [
        {
          taskId: 'PM-001',
          description: 'Code Generation - HTML/Layout Structure\n\nFallback task: Generate basic HTML layout and structure for the project.',
          status: 'TODO' as TaskStatus,
          priority: 'HIGH' as TaskPriority,
          estimatedHours: 0.5,
          dependencies: undefined,
        },
        {
          taskId: 'PM-002',
          description: 'Code Generation - CSS Styling\n\nFallback task: Add CSS styling and visual design to the generated HTML.',
          status: 'TODO' as TaskStatus,
          priority: 'MEDIUM' as TaskPriority,
          estimatedHours: 0.5,
          dependencies: ['PM-001'],
        },
        {
          taskId: 'PM-003',
          description: 'Code Generation - JavaScript Logic\n\nFallback task: Implement JavaScript interactivity and dynamic behavior.',
          status: 'TODO' as TaskStatus,
          priority: 'HIGH' as TaskPriority,
          estimatedHours: 0.5,
          dependencies: ['PM-001', 'PM-002'],
        },
      ];
    } else if (isAPI) {
      return [
        {
          taskId: 'PM-001',
          description: 'Code Generation - API Endpoints\n\nFallback task: Design and implement core API endpoints.',
          status: 'TODO' as TaskStatus,
          priority: 'HIGH' as TaskPriority,
          estimatedHours: 1,
          dependencies: undefined,
        },
        {
          taskId: 'PM-002',
          description: 'Code Generation - Database Schema\n\nFallback task: Set up database models and schema.',
          status: 'TODO' as TaskStatus,
          priority: 'HIGH' as TaskPriority,
          estimatedHours: 1,
          dependencies: undefined,
        },
        {
          taskId: 'PM-003',
          description: 'Code Generation - Error Handling & Validation\n\nFallback task: Add input validation and error handling.',
          status: 'TODO' as TaskStatus,
          priority: 'MEDIUM' as TaskPriority,
          estimatedHours: 0.5,
          dependencies: ['PM-001', 'PM-002'],
        },
      ];
    } else {
      // Generic fallback for unknown project type
      return [
        {
          taskId: 'PM-001',
          description: 'Code Generation - Core Implementation\n\nFallback task: Generate core functionality for the project.',
          status: 'TODO' as TaskStatus,
          priority: 'HIGH' as TaskPriority,
          estimatedHours: 1,
          dependencies: undefined,
        },
        {
          taskId: 'PM-002',
          description: 'Code Generation - Testing & Validation\n\nFallback task: Add tests and validation logic.',
          status: 'TODO' as TaskStatus,
          priority: 'MEDIUM' as TaskPriority,
          estimatedHours: 0.5,
          dependencies: ['PM-001'],
        },
        {
          taskId: 'PM-003',
          description: 'Code Generation - Documentation & Polish\n\nFallback task: Document code and add final touches.',
          status: 'TODO' as TaskStatus,
          priority: 'LOW' as TaskPriority,
          estimatedHours: 0.5,
          dependencies: ['PM-001', 'PM-002'],
        },
      ];
    }
  }
}
