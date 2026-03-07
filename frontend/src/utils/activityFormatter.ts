/**
 * Formats technical agent activity into human-readable messages
 */

interface FormattedActivity {
  speaker: string;
  action: string;
  message: string;
  style: 'info' | 'success' | 'working' | 'waiting' | 'error';
}

export function formatAgentActivity(event: any): FormattedActivity {
  const type = event.type;
  const data = event.data || {};

  // Task Created
  if (type === 'task_streamed' && data.taskId) {
    const taskNumber = data.taskId.split('-')[1] || '?';
    const description = data.description || '';

    return {
      speaker: 'Project Manager',
      action: 'created task',
      message: `Task #${taskNumber}: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`,
      style: 'info'
    };
  }

  // Task Status Updates
  if (type === 'task_updated' && data.status) {
    const taskId = data.taskId || event.taskId || '';
    const taskNumber = taskId.split('-')[1] || taskId;
    const status = data.status;

    if (status === 'IN_PROGRESS') {
      const agentType = getAgentName(data.claimedBy || '');
      return {
        speaker: agentType,
        action: 'started working',
        message: `Now working on Task #${taskNumber}`,
        style: 'working'
      };
    }

    if (status === 'COMPLETE') {
      const agentType = getAgentName(data.completedBy || '');
      return {
        speaker: agentType,
        action: 'completed task',
        message: `Finished Task #${taskNumber}${getTaskTypeDescription(taskId)}`,
        style: 'success'
      };
    }

    if (status === 'TODO') {
      return {
        speaker: 'System',
        action: 'waiting',
        message: `Task #${taskNumber} is waiting for dependencies to complete`,
        style: 'waiting'
      };
    }
  }

  // Agent Progress
  if (type === 'agent_progress') {
    const agent = getAgentName(event.agent || '');
    const message = event.message || '';

    return {
      speaker: agent,
      action: 'progress update',
      message: message,
      style: 'working'
    };
  }

  // Agent Activity
  if (type === 'agent_activity') {
    const agent = getAgentName(event.agent || '');
    const message = event.message || '';

    return {
      speaker: agent,
      action: 'working',
      message: message,
      style: 'working'
    };
  }

  // Project Status
  if (type === 'project_status') {
    return {
      speaker: 'System',
      action: 'status update',
      message: event.message || 'Project status changed',
      style: 'info'
    };
  }

  // Research Complete
  if (type === 'research_complete') {
    const projectType = data.projectType || 'application';
    return {
      speaker: 'Research Agent',
      action: 'completed analysis',
      message: `Identified project type as "${projectType}" and gathered requirements`,
      style: 'success'
    };
  }

  // QA Report
  if (type === 'qa_report') {
    const status = data.status || 'unknown';
    const summary = data.summary || 'QA validation completed';
    return {
      speaker: 'QA Agent',
      action: 'validated code',
      message: `${summary} (Status: ${status})`,
      style: status.toLowerCase() === 'passed' ? 'success' : 'error'
    };
  }

  // Error
  if (type === 'error') {
    return {
      speaker: 'System',
      action: 'error',
      message: event.message || 'An error occurred',
      style: 'error'
    };
  }

  // Default fallback
  return {
    speaker: 'System',
    action: 'update',
    message: event.message || event.title || 'Activity update',
    style: 'info'
  };
}

/**
 * Convert agent IDs like "agent-layout-1" to "Layout Agent"
 */
function getAgentName(agentId: string): string {
  if (!agentId) return 'Agent';

  const typeMatch = agentId.match(/agent-(\w+)-/);
  if (typeMatch) {
    const type = typeMatch[1];
    return type.charAt(0).toUpperCase() + type.slice(1) + ' Agent';
  }

  // Handle direct type names
  if (agentId.includes('layout')) return 'Layout Agent';
  if (agentId.includes('styling')) return 'Styling Agent';
  if (agentId.includes('logic')) return 'Logic Agent';
  if (agentId.includes('frontend')) return 'Frontend Agent';
  if (agentId.includes('backend')) return 'Backend Agent';
  if (agentId.includes('research')) return 'Research Agent';
  if (agentId.includes('qa')) return 'QA Agent';
  if (agentId.includes('pm') || agentId.includes('manager')) return 'Project Manager';

  return agentId;
}

/**
 * Add context about what task type was completed
 */
function getTaskTypeDescription(taskId: string): string {
  if (taskId.includes('PM-001')) return ' - HTML structure is ready';
  if (taskId.includes('PM-002')) return ' - CSS styling is complete';
  if (taskId.includes('PM-003')) return ' - JavaScript logic is implemented';
  return '';
}

/**
 * Get emoji for agent type
 */
export function getAgentEmoji(speaker: string): string {
  if (speaker.includes('Layout')) return '🏗️';
  if (speaker.includes('Styling')) return '🎨';
  if (speaker.includes('Logic')) return '⚡';
  if (speaker.includes('Frontend')) return '💻';
  if (speaker.includes('Backend')) return '🔧';
  if (speaker.includes('Research')) return '🔍';
  if (speaker.includes('QA')) return '✅';
  if (speaker.includes('Manager')) return '📋';
  if (speaker.includes('System')) return '⚙️';
  return '🤖';
}
