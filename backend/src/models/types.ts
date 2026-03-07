export type MessageType =
  | 'PROJECT_PLAN'
  | 'TASK_ASSIGNMENT'
  | 'STATUS_CHECK'
  | 'BLOCKER_RESPONSE'
  | 'CLARIFICATION_REQUEST'
  | 'PROGRESS_UPDATE'
  | 'ESTIMATE_REQUEST'
  | 'BLOCKER_ALERT'
  | 'IMPLEMENTATION_COMPLETE'
  | 'CLARIFICATION_NEEDED'
  | 'CLARIFICATION_RESPONSE';

export type AgentType = 'PROJECT_MANAGER' | 'ENGINEER' | 'USER';

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETE' | 'BLOCKED' | 'FAILED';

export type TaskPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface AgentMessage {
  messageType: MessageType;
  taskId?: string;
  content: string;
  codeOutput?: string;
  questions?: string[];
  blockers?: string[];
  timeline?: {
    started?: string;
    expectedCompletion?: string;
    currentProgress?: number;
  };
  metadata?: Record<string, any>;
}

export interface TaskInfo {
  taskId: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedHours?: number;
  dependencies?: string[];
  blockerMessage?: string;
}

export interface ParsedMessage {
  messageType: MessageType;
  taskId?: string;
  content: string;
  tasks: TaskInfo[];
  questions: string[];
  blockers: string[];
  codeOutput?: string;
}

export interface ConversationMessage {
  fromAgent: AgentType;
  toAgent: AgentType;
  messageType: MessageType;
  content: string;
  taskId?: string;
  codeOutput?: string;
  metadata?: Record<string, any>;
}

export interface OllamaStreamChunk {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

export interface OllamaStreamResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}
