import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle2, MessageSquare, Zap, Clock } from "lucide-react";
import { WS_URL } from "@/lib/api";
import { formatAgentActivity, getAgentEmoji } from "@/utils/activityFormatter";

interface ActivityEvent {
  id: string;
  type: "project_status" | "agent_activity" | "message" | "task_streamed" | "task_updated" | "error" | "research_complete" | "qa_report" | "agent_progress";
  projectId: string;
  taskId?: string;
  title: string;
  message: string;
  agent?: string;
  timestamp: string;
  data?: any;
}

interface LiveActivityFeedProps {
  projectId?: string;
  taskId?: string;
  title?: string;
}

export function LiveActivityFeed({ projectId, taskId, title = "LIVE ACTIVITY" }: LiveActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Filter events based on taskId if provided
  const filteredEvents = taskId
    ? events.filter((e) => e.taskId === taskId || e.type === "agent_activity")
    : events.filter((e) => e.projectId === projectId);

  // Clear events when projectId changes
  useEffect(() => {
    setEvents([]);
  }, [projectId]);

  useEffect(() => {
    const newSocket = io(WS_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      setConnected(true);
    });

    newSocket.on("disconnect", () => {
      setConnected(false);
    });

    // Listen for project status changes
    newSocket.on("project_status_changed", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [
          ...prev,
          {
            id: `status-${Date.now()}`,
            type: "project_status",
            projectId: data.projectId,
            title: "Project Status",
            message: data.message || data.status,
            timestamp: data.timestamp,
          },
        ]);
      }
    });

    // Listen for agent activity
    newSocket.on("agent_activity", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [
          ...prev,
          {
            id: `activity-${Date.now()}`,
            type: "agent_activity",
            projectId: data.projectId,
            agent: data.agent,
            title: `${data.agent} is working...`,
            message: data.message,
            timestamp: data.timestamp,
          },
        ]);
      }
    });

    // Listen for agent messages
    newSocket.on("message_received", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [
          ...prev,
          {
            id: `message-${Date.now()}`,
            type: "message",
            projectId: data.projectId,
            title: "Agent Message",
            message: data.message?.content || JSON.stringify(data.message).substring(0, 100),
            timestamp: data.timestamp,
            data,
          },
        ]);
      }
    });

    // Listen for task streaming
    newSocket.on("task_streamed", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [
          ...prev,
          {
            id: `task-${data.task.taskId}-${Date.now()}`,
            type: "task_streamed",
            projectId: data.projectId,
            taskId: data.task.taskId,
            title: `Task Created: ${data.task.taskId}`,
            message: data.task.description,
            timestamp: data.timestamp,
            data: data.task,
          },
        ]);
      }
    });

    // Listen for task updates
    newSocket.on("task_updated", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [
          ...prev,
          {
            id: `task-update-${data.task.taskId}-${Date.now()}`,
            type: "task_updated",
            projectId: data.projectId,
            taskId: data.task.taskId,
            title: `Task Updated: ${data.task.taskId}`,
            message: `Status: ${data.task.status}`,
            timestamp: data.timestamp,
            data: data.task,
          },
        ]);
      }
    });

    // Listen for errors
    newSocket.on("parsing_error", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            type: "error",
            projectId: data.projectId,
            title: "Error",
            message: data.errorMessage,
            timestamp: data.timestamp,
          },
        ]);
      }
    });

    // Listen for research completion
    newSocket.on("research_complete", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [
          ...prev,
          {
            id: `research-${Date.now()}`,
            type: "research_complete",
            projectId: data.projectId,
            title: "Research Analysis Complete",
            message: `Project Type: ${data.research?.projectType || 'Unknown'}`,
            timestamp: data.timestamp,
            data: data.research,
          },
        ]);
      }
    });

    // Listen for QA report
    newSocket.on("qa_report", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [
          ...prev,
          {
            id: `qa-${Date.now()}`,
            type: "qa_report",
            projectId: data.projectId,
            title: `QA Validation: ${data.report?.status || 'Unknown'}`,
            message: data.report?.summary || "QA validation completed",
            timestamp: data.timestamp,
            data: data.report,
          },
        ]);
      }
    });

    // Listen for agent progress
    newSocket.on("agent_progress", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [
          ...prev,
          {
            id: `progress-${Date.now()}`,
            type: "agent_progress",
            projectId: data.projectId,
            agent: data.agent,
            title: `${data.agent} - ${data.phase}`,
            message: data.message,
            timestamp: data.timestamp,
            data,
          },
        ]);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [projectId, taskId]);

  // Auto-scroll to latest event
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const getEventColor = (style: string) => {
    switch (style) {
      case "success":
        return "border-l-4 border-green-500 bg-green-50 hover:bg-green-100";
      case "working":
        return "border-l-4 border-blue-500 bg-blue-50 hover:bg-blue-100";
      case "waiting":
        return "border-l-4 border-yellow-500 bg-yellow-50 hover:bg-yellow-100";
      case "error":
        return "border-l-4 border-red-500 bg-red-50 hover:bg-red-100";
      case "info":
      default:
        return "border-l-4 border-gray-400 bg-gray-50 hover:bg-gray-100";
    }
  };

  const getStatusIcon = (style: string) => {
    switch (style) {
      case "success":
        return <CheckCircle2 className="w-3 h-3 inline mr-1" />;
      case "working":
        return <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />;
      case "waiting":
        return <Clock className="w-3 h-3 inline mr-1" />;
      case "error":
        return <AlertCircle className="w-3 h-3 inline mr-1" />;
      default:
        return null;
    }
  };

  const getStatusBadgeColor = (style: string) => {
    switch (style) {
      case "success":
        return "bg-green-100 text-green-800 border-green-300";
      case "working":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "waiting":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "error":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "";
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="flex flex-col h-full bg-white border-2 border-black rounded-lg">
      {/* Header */}
      <div className="border-b-2 border-black p-4 flex items-center justify-between">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Zap className="w-5 h-5" />
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              connected ? "bg-green-500 animate-pulse" : "bg-red-500"
            }`}
          ></div>
          <span className="text-xs font-medium text-gray-600">
            {connected ? "CONNECTED" : "DISCONNECTED"}
          </span>
        </div>
      </div>

      {/* Feed - Chat-like conversation view */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No activity yet</p>
            <p className="text-xs text-gray-400">{taskId ? "Waiting for agent communication..." : "Create a project to see live updates"}</p>
          </div>
        ) : (
          filteredEvents.map((event) => {
            const formatted = formatAgentActivity(event);
            return (
              <div
                key={event.id}
                className={`p-3 rounded-lg transition-all ${getEventColor(formatted.style)}`}
              >
                <div className="flex items-start gap-3">
                  {/* Agent Avatar/Icon */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-lg">
                    {getAgentEmoji(formatted.speaker)}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header: Agent name + action + time */}
                    <div className="flex items-center gap-2 justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900">{formatted.speaker}</span>
                        <span className="text-xs text-gray-500">•</span>
                        <span className="text-xs text-gray-600 italic">{formatted.action}</span>
                      </div>
                      <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(event.timestamp)}
                      </span>
                    </div>

                    {/* Message content */}
                    <p className="text-sm text-gray-800 leading-relaxed break-words">
                      {formatted.message}
                    </p>

                    {/* Status indicator */}
                    {formatted.style !== 'info' && (
                      <div className="mt-2">
                        <Badge
                          variant={formatted.style === 'success' ? 'default' : 'outline'}
                          className={`text-xs ${getStatusBadgeColor(formatted.style)}`}
                        >
                          {getStatusIcon(formatted.style)}
                          {formatted.style}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Footer */}
      <div className="border-t-2 border-black p-3 bg-gray-50 text-xs text-gray-600 font-medium">
        {filteredEvents.length} events • {connected ? "Connected" : "Connecting..."}
      </div>
    </div>
  );
}
