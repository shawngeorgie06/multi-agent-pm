import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle, CheckCircle2, MessageSquare, Zap, Clock } from "lucide-react";
import { WS_URL } from "@/lib/api";
import { formatAgentActivity, getAgentBadge } from "@/utils/activityFormatter";

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

  const filteredEvents = taskId
    ? events.filter((e) => e.taskId === taskId || e.type === "agent_activity")
    : events.filter((e) => e.projectId === projectId);

  useEffect(() => { setEvents([]); }, [projectId]);

  useEffect(() => {
    const newSocket = io(WS_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => setConnected(true));
    newSocket.on("disconnect", () => setConnected(false));

    newSocket.on("project_status_changed", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [...prev, { id: `status-${Date.now()}`, type: "project_status", projectId: data.projectId, title: "Project Status", message: data.message || data.status, timestamp: data.timestamp }]);
      }
    });

    newSocket.on("agent_activity", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [...prev, { id: `activity-${Date.now()}`, type: "agent_activity", projectId: data.projectId, agent: data.agent, title: `${data.agent} is working...`, message: data.message, timestamp: data.timestamp }]);
      }
    });

    newSocket.on("message_received", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [...prev, { id: `message-${Date.now()}`, type: "message", projectId: data.projectId, title: "Agent Message", message: data.message?.content || JSON.stringify(data.message).substring(0, 100), timestamp: data.timestamp, data }]);
      }
    });

    newSocket.on("task_streamed", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [...prev, { id: `task-${data.task.taskId}-${Date.now()}`, type: "task_streamed", projectId: data.projectId, taskId: data.task.taskId, title: `Task Created: ${data.task.taskId}`, message: data.task.description, timestamp: data.timestamp, data: data.task }]);
      }
    });

    newSocket.on("task_updated", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [...prev, { id: `task-update-${data.task.taskId}-${Date.now()}`, type: "task_updated", projectId: data.projectId, taskId: data.task.taskId, title: `Task Updated: ${data.task.taskId}`, message: `Status: ${data.task.status}`, timestamp: data.timestamp, data: data.task }]);
      }
    });

    newSocket.on("parsing_error", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [...prev, { id: `error-${Date.now()}`, type: "error", projectId: data.projectId, title: "Error", message: data.errorMessage, timestamp: data.timestamp }]);
      }
    });

    newSocket.on("research_complete", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [...prev, { id: `research-${Date.now()}`, type: "research_complete", projectId: data.projectId, title: "Research Analysis Complete", message: `Project Type: ${data.research?.projectType || "Unknown"}`, timestamp: data.timestamp, data: data.research }]);
      }
    });

    newSocket.on("qa_report", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [...prev, { id: `qa-${Date.now()}`, type: "qa_report", projectId: data.projectId, title: `QA Validation: ${data.report?.status || "Unknown"}`, message: data.report?.summary || "QA validation completed", timestamp: data.timestamp, data: data.report }]);
      }
    });

    newSocket.on("agent_progress", (data) => {
      if (!projectId || data.projectId === projectId) {
        setEvents((prev) => [...prev, { id: `progress-${Date.now()}`, type: "agent_progress", projectId: data.projectId, agent: data.agent, title: `${data.agent} - ${data.phase}`, message: data.message, timestamp: data.timestamp, data }]);
      }
    });

    setSocket(newSocket);
    return () => { newSocket.disconnect(); };
  }, [projectId, taskId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [events]);

  const getEventColor = (style: string) => {
    switch (style) {
      case "success":
        return "border-l-2 border-[#4edea3] bg-[#4edea3]/5";
      case "working":
        return "border-l-2 border-[#0EA5E9] bg-[#0EA5E9]/5";
      case "waiting":
        return "border-l-2 border-[#f59e0b] bg-[#f59e0b]/5";
      case "error":
        return "border-l-2 border-[#ffb4ab] bg-[#ffb4ab]/5";
      case "info":
      default:
        return "border-l-2 border-[#3e4850] bg-[#201f1f]/50";
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
        return "bg-[#4edea3]/10 text-[#4edea3] border-[#4edea3]/20";
      case "working":
        return "bg-[#0EA5E9]/10 text-[#0EA5E9] border-[#0EA5E9]/20";
      case "waiting":
        return "bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/20";
      case "error":
        return "bg-[#ffb4ab]/10 text-[#ffb4ab] border-[#ffb4ab]/20";
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
    <div className="flex flex-col h-full bg-[#131313] rounded-lg border border-[#3e4850]/20">
      {/* Header */}
      <div className="border-b border-[#3e4850]/20 px-5 py-3 flex items-center justify-between bg-[#201f1f]">
        <h3 className="font-extrabold text-xs uppercase tracking-[0.2em] text-[#e5e2e1] font-['Manrope',sans-serif] flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#0EA5E9]" />
          {title}
        </h3>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-[#4edea3] animate-pulse" : "bg-[#ffb4ab]"}`} />
          <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: connected ? "#4edea3" : "#ffb4ab" }}>
            {connected ? "Live" : "Offline"}
          </span>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5 max-h-[400px]">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-10">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 text-[#3e4850]" />
            <p className="text-sm font-semibold text-[#88929b]">No activity yet</p>
            <p className="text-xs text-[#3e4850] mt-1">
              {taskId ? "Waiting for agent communication..." : "Create a project to see live updates"}
            </p>
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
                  {/* Agent Badge */}
                  {formatted.agentBadge ? (
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs border border-[#3e4850]/30"
                      style={{
                        backgroundColor: formatted.agentBadge.bgColor?.includes("#") ? formatted.agentBadge.bgColor : undefined,
                        color: formatted.agentBadge.color?.includes("#") ? formatted.agentBadge.color : undefined,
                      }}
                    >
                      {formatted.agentBadge.abbreviation}
                    </div>
                  ) : (
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#2a2a2a] border border-[#3e4850]/30 flex items-center justify-center font-bold text-xs text-[#88929b]">
                      ?
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#e5e2e1]">{formatted.speaker}</span>
                        <span className="text-xs text-[#3e4850]">&middot;</span>
                        <span className="text-xs text-[#88929b] italic">{formatted.action}</span>
                      </div>
                      <span className="text-[10px] text-[#3e4850] whitespace-nowrap flex items-center gap-1 font-bold uppercase tracking-widest">
                        {formatTime(event.timestamp)}
                      </span>
                    </div>

                    {/* Message */}
                    <p className="text-sm text-[#bec8d2] leading-relaxed break-words">
                      {formatted.message}
                    </p>

                    {/* Status badge */}
                    {formatted.style !== "info" && (
                      <div className="mt-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase tracking-widest font-bold ${getStatusBadgeColor(formatted.style)}`}
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
      <div className="border-t border-[#3e4850]/20 px-5 py-2.5 bg-[#0e0e0e] text-[10px] text-[#88929b] font-bold uppercase tracking-widest rounded-b-lg">
        {filteredEvents.length} events &middot; {connected ? "Connected" : "Connecting..."}
      </div>
    </div>
  );
}
