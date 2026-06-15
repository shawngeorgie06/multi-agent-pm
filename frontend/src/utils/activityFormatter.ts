/**
 * Formats technical agent activity into human-readable messages
 */

interface FormattedActivity {
  speaker: string;
  action: string;
  message: string;
  style: 'info' | 'success' | 'working' | 'waiting' | 'error';
  agentBadge?: {
    abbreviation: string;
    color: string;
    bgColor: string;
  };
}

export function formatAgentActivity(event: any): FormattedActivity {
  const type = event.type;
  const data = event.data || {};

  // Task Created
  if (type === 'task_streamed' && data.taskId) {
    const taskNumber = data.taskId.split('-')[1] || '?';
    const description = data.description || '';
    const speaker = 'Project Manager';

    return {
      speaker: speaker,
      action: 'created task',
      message: `Task #${taskNumber}: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`,
      style: 'info',
      agentBadge: getAgentBadge(speaker)
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
        style: 'working',
        agentBadge: getAgentBadge(agentType)
      };
    }

    if (status === 'COMPLETE') {
      const agentType = getAgentName(data.completedBy || '');
      return {
        speaker: agentType,
        action: 'completed task',
        message: `Finished Task #${taskNumber}${getTaskTypeDescription(taskId)}`,
        style: 'success',
        agentBadge: getAgentBadge(agentType)
      };
    }

    if (status === 'TODO') {
      return {
        speaker: 'System',
        action: 'waiting',
        message: `Task #${taskNumber} is waiting for dependencies to complete`,
        style: 'waiting',
        agentBadge: getAgentBadge('System')
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
      style: 'working',
      agentBadge: getAgentBadge(agent)
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
      style: 'working',
      agentBadge: getAgentBadge(agent)
    };
  }

  // Project Status
  if (type === 'project_status') {
    return {
      speaker: 'System',
      action: 'status update',
      message: event.message || 'Project status changed',
      style: 'info',
      agentBadge: getAgentBadge('System')
    };
  }

  // Research Complete
  if (type === 'research_complete') {
    const projectType = data.projectType || 'application';
    const speaker = 'Research Agent';
    return {
      speaker: speaker,
      action: 'completed analysis',
      message: `Identified project type as "${projectType}" and gathered requirements`,
      style: 'success',
      agentBadge: getAgentBadge(speaker)
    };
  }

  // QA Report
  if (type === 'qa_report') {
    const status = data.status || 'unknown';
    const summary = data.summary || 'QA validation completed';
    const speaker = 'QA Agent';
    return {
      speaker: speaker,
      action: 'validated code',
      message: `${summary} (Status: ${status})`,
      style: status.toLowerCase() === 'passed' ? 'success' : 'error',
      agentBadge: getAgentBadge(speaker)
    };
  }

  // Error
  if (type === 'error') {
    return {
      speaker: 'System',
      action: 'error',
      message: event.message || 'An error occurred',
      style: 'error',
      agentBadge: getAgentBadge('System')
    };
  }

  // Default fallback
  return {
    speaker: 'System',
    action: 'update',
    message: event.message || event.title || 'Activity update',
    style: 'info',
    agentBadge: getAgentBadge('System')
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
 * Get colored badge info for agent type
 */
export function getAgentBadge(speaker: string): { abbreviation: string; color: string; bgColor: string } {
  if (speaker.includes('Layout')) {
    return { abbreviation: 'LA', color: 'text-yellow-600', bgColor: 'bg-yellow-100 border-yellow-300' };
  }
  if (speaker.includes('Styling')) {
    return { abbreviation: 'ST', color: 'text-pink-600', bgColor: 'bg-pink-100 border-pink-300' };
  }
  if (speaker.includes('Logic')) {
    return { abbreviation: 'LG', color: 'text-indigo-600', bgColor: 'bg-indigo-100 border-indigo-300' };
  }
  if (speaker.includes('Frontend')) {
    return { abbreviation: 'FE', color: 'text-green-600', bgColor: 'bg-green-100 border-green-300' };
  }
  if (speaker.includes('Backend')) {
    return { abbreviation: 'BE', color: 'text-purple-600', bgColor: 'bg-purple-100 border-purple-300' };
  }
  if (speaker.includes('Research')) {
    return { abbreviation: 'RS', color: 'text-teal-600', bgColor: 'bg-teal-100 border-teal-300' };
  }
  if (speaker.includes('QA')) {
    return { abbreviation: 'QA', color: 'text-orange-600', bgColor: 'bg-orange-100 border-orange-300' };
  }
  if (speaker.includes('Manager') || speaker.includes('Project')) {
    return { abbreviation: 'PM', color: 'text-blue-600', bgColor: 'bg-blue-100 border-blue-300' };
  }
  if (speaker.includes('System')) {
    return { abbreviation: 'SYS', color: 'text-gray-600', bgColor: 'bg-gray-100 border-gray-300' };
  }
  return { abbreviation: 'AG', color: 'text-slate-600', bgColor: 'bg-slate-100 border-slate-300' };
}

/**
 * Get emoji for agent type (legacy - kept for backward compatibility)
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
