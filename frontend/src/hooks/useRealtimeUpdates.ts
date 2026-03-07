import { useEffect, useState, useCallback } from "react";

export interface AgentUpdate {
  agentId: string;
  agentName: string;
  status: "active" | "idle" | "working";
  efficiency: number;
  tasksCompleted: number;
}

export interface TaskUpdate {
  taskId: string;
  taskTitle: string;
  agentName: string;
  status: "completed" | "in-progress" | "pending";
  progress?: number;
  timestamp: string;
}

export interface RealtimeEvent {
  type: "agent-status" | "task-completed" | "task-started" | "efficiency-update";
  data: AgentUpdate | TaskUpdate;
}

export function useRealtimeUpdates(onUpdate: (event: RealtimeEvent) => void) {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Simulate real-time updates with random intervals
    const intervals: NodeJS.Timeout[] = [];

    // Agent status changes
    const agentStatusInterval = setInterval(() => {
      const agents = [
        { id: "1", name: "Data Analyst", statuses: ["active", "working"] as const },
        { id: "2", name: "Code Writer", statuses: ["working", "idle"] as const },
        { id: "3", name: "Content Creator", statuses: ["idle", "active"] as const },
        { id: "4", name: "Web Crawler", statuses: ["active", "working"] as const },
      ];

      const randomAgent = agents[Math.floor(Math.random() * agents.length)];
      const randomStatus = randomAgent.statuses[Math.floor(Math.random() * randomAgent.statuses.length)];
      const randomEfficiency = Math.floor(Math.random() * 20) + 80; // 80-100%

      onUpdate({
        type: "agent-status",
        data: {
          agentId: randomAgent.id,
          agentName: randomAgent.name,
          status: randomStatus,
          efficiency: randomEfficiency,
          tasksCompleted: Math.floor(Math.random() * 50) + 100,
        },
      });
    }, 8000); // Every 8 seconds

    intervals.push(agentStatusInterval);

    // Task completions
    const taskCompletionInterval = setInterval(() => {
      const tasks = [
        { id: "t1", title: "Analyze Market Data", agent: "Data Analyst" },
        { id: "t2", title: "Optimize Database Queries", agent: "Code Writer" },
        { id: "t3", title: "Write Blog Post", agent: "Content Creator" },
        { id: "t4", title: "Crawl Competitor Sites", agent: "Web Crawler" },
        { id: "t5", title: "Generate Report", agent: "Data Analyst" },
        { id: "t6", title: "Fix Bug in API", agent: "Code Writer" },
      ];

      const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
      const eventType = Math.random() > 0.5 ? "task-completed" : "task-started";

      onUpdate({
        type: eventType as "task-completed" | "task-started",
        data: {
          taskId: randomTask.id,
          taskTitle: randomTask.title,
          agentName: randomTask.agent,
          status: eventType === "task-completed" ? "completed" : "in-progress",
          progress: eventType === "task-completed" ? 100 : Math.floor(Math.random() * 80) + 20,
          timestamp: new Date().toLocaleTimeString(),
        },
      });
    }, 6000); // Every 6 seconds

    intervals.push(taskCompletionInterval);

    // Efficiency updates
    const efficiencyInterval = setInterval(() => {
      const agentNames = ["Data Analyst", "Code Writer", "Content Creator", "Web Crawler"];
      const randomAgent = agentNames[Math.floor(Math.random() * agentNames.length)];

      onUpdate({
        type: "efficiency-update",
        data: {
          agentId: Math.random().toString(),
          agentName: randomAgent,
          status: "active",
          efficiency: Math.floor(Math.random() * 15) + 85, // 85-100%
          tasksCompleted: 0,
        },
      });
    }, 10000); // Every 10 seconds

    intervals.push(efficiencyInterval);

    return () => {
      intervals.forEach((interval) => clearInterval(interval));
    };
  }, [onUpdate]);

  return { isConnected };
}
