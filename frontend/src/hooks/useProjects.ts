import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL, WS_URL } from "@/lib/api";

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "in_progress" | "completed" | "failed" | "paused";
  designBrief?: string | null;
  researchOutput?: string | null;
  qaReport?: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    messages: number;
    tasks: number;
  };
}

export interface Task {
  id: string;
  projectId: string;
  taskId: string;
  description: string;
  status: "TODO" | "IN_PROGRESS" | "COMPLETE" | "BLOCKED" | "FAILED";
  priority: "HIGH" | "MEDIUM" | "LOW";
  estimatedHours: number | null;
  actualHours: number | null;
  dependencies: string[];
  blockerMessage: string | null;
  generatedCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDetail extends Project {
  messages: any[];
  tasks: Task[];
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Fetch all projects
  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/projects`);
      if (!response.ok) throw new Error("Failed to fetch projects");
      const data = await response.json();
      setProjects(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch projects";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch single project with details
  const fetchProjectDetail = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/projects/${projectId}`);
      if (!response.ok) throw new Error("Failed to fetch project");
      const data = (await response.json()) as ProjectDetail;
      console.log(`[FRONTEND] Fetched project ${projectId}:`, {
        name: data.name,
        taskCount: data.tasks?.length || 0,
        tasksArray: data.tasks,
      });
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch project";
      throw new Error(message);
    }
  }, []);

  // Initialize WebSocket for real-time updates
  useEffect(() => {
    const newSocket = io(WS_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      console.log("Connected to WebSocket");
    });

    newSocket.on("task_updated", (data: { projectId: string }) => {
      if (data.projectId) fetchProjects();
    });

    newSocket.on("project_status_changed", (data: { projectId: string }) => {
      if (data.projectId) fetchProjects();
    });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from WebSocket");
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [fetchProjects]);

  // Initial fetch
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    loading,
    error,
    fetchProjects,
    fetchProjectDetail,
    socket,
  };
}
