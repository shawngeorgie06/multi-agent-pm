import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { Activity, Clock, CheckCircle2, Zap } from "lucide-react";
import { WS_URL } from "@/lib/api";

type AgentState = "IDLE" | "EXECUTING" | "DONE";

interface AgentSlot {
  agentType: string;
  state: AgentState;
  currentTask: string | null;
  lastActivity: number;
}

interface AgentStatusBarProps {
  projectId?: string;
}

const AGENT_CONFIG: Record<string, { name: string; label: string; accent: string; accentBg: string }> = {
  PROJECT_MANAGER: { name: "PM",  label: "Proj. Manager",  accent: "text-ds-primary",  accentBg: "bg-ds-primary/10 border-ds-primary/30" },
  ENGINEER:        { name: "ENG", label: "Engineer",       accent: "text-ds-primary",  accentBg: "bg-ds-primary/10 border-ds-primary/30" },
  DESIGN_DIRECTOR: { name: "DD",  label: "Design Dir.",    accent: "text-[#d946ef]",   accentBg: "bg-[#d946ef]/10 border-[#d946ef]/30" },
  RESEARCH:        { name: "RS",  label: "Research",       accent: "text-[#14b8a6]",   accentBg: "bg-[#14b8a6]/10 border-[#14b8a6]/30" },
  FRONTEND:        { name: "FE",  label: "Frontend",       accent: "text-ds-tertiary", accentBg: "bg-ds-tertiary/10 border-ds-tertiary/30" },
  BACKEND:         { name: "BE",  label: "Backend",        accent: "text-[#8b5cf6]",   accentBg: "bg-[#8b5cf6]/10 border-[#8b5cf6]/30" },
  LAYOUT:          { name: "LY",  label: "Layout",         accent: "text-[#f59e0b]",   accentBg: "bg-[#f59e0b]/10 border-[#f59e0b]/30" },
  STYLING:         { name: "ST",  label: "Styling",        accent: "text-[#ec4899]",   accentBg: "bg-[#ec4899]/10 border-[#ec4899]/30" },
  LOGIC:           { name: "LG",  label: "Logic",          accent: "text-[#6366f1]",   accentBg: "bg-[#6366f1]/10 border-[#6366f1]/30" },
  QA:              { name: "QA",  label: "QA",             accent: "text-[#f97316]",   accentBg: "bg-[#f97316]/10 border-[#f97316]/30" },
};

// All agents shown in fleet — always visible, state changes as events arrive
const FLEET_ORDER = ["PROJECT_MANAGER", "ENGINEER", "DESIGN_DIRECTOR", "RESEARCH", "FRONTEND", "BACKEND", "LAYOUT", "STYLING", "LOGIC", "QA"];

const IDLE_AFTER_MS = 6000; // clear EXECUTING → IDLE after 6s of silence

function initFleet(): AgentSlot[] {
  return FLEET_ORDER.map((t) => ({ agentType: t, state: "IDLE", currentTask: null, lastActivity: 0 }));
}

export function AgentStatusBar({ projectId }: AgentStatusBarProps) {
  const [agents, setAgents] = useState<AgentSlot[]>(initFleet);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const markExecuting = (agentType: string, message: string) => {
    const type = agentType.toUpperCase().replace(/ /g, "_");
    setAgents((prev) =>
      prev.map((a) => a.agentType === type ? { ...a, state: "EXECUTING", currentTask: message, lastActivity: Date.now() } : a)
    );
    // auto-clear back to IDLE after silence
    const existing = timers.current.get(type);
    if (existing) clearTimeout(existing);
    timers.current.set(type, setTimeout(() => {
      setAgents((prev) =>
        prev.map((a) => a.agentType === type && a.state === "EXECUTING" ? { ...a, state: "IDLE", currentTask: null } : a)
      );
    }, IDLE_AFTER_MS));
  };

  const markAllDone = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
    setAgents((prev) => prev.map((a) => a.state === "EXECUTING" ? { ...a, state: "DONE", currentTask: null } : a));
  };

  useEffect(() => {
    const socket = io(WS_URL, {
      reconnection: true, reconnectionDelay: 1000,
      reconnectionDelayMax: 5000, reconnectionAttempts: 5,
    });

    // Primary signal: agent_activity fires with { projectId, agent, message }
    socket.on("agent_activity", (data) => {
      if (projectId && data.projectId !== projectId) return;
      if (data.agent) markExecuting(data.agent, data.message ?? "Working…");
    });

    // Secondary signal: agent_progress fires with { projectId, agent, phase, message }
    socket.on("agent_progress", (data) => {
      if (projectId && data.projectId !== projectId) return;
      if (data.agent) markExecuting(data.agent, data.message ?? data.phase ?? "Working…");
    });

    // Mark done when project completes
    socket.on("project_status_changed", (data) => {
      if (projectId && data.projectId !== projectId) return;
      if (data.status === "completed") markAllDone();
    });

    return () => {
      socket.disconnect();
      timers.current.forEach((t) => clearTimeout(t));
    };
  }, [projectId]);

  const executing = agents.filter((a) => a.state === "EXECUTING");

  return (
    <div>
      <div className="grid grid-cols-5 gap-2 p-4">
        {agents.map((agent) => {
          const cfg = AGENT_CONFIG[agent.agentType];
          const isWorking = agent.state === "EXECUTING";
          const isDone = agent.state === "DONE";

          return (
            <div
              key={agent.agentType}
              className={`p-3 rounded-lg border flex flex-col items-center gap-1.5 transition-all duration-300
                ${isWorking ? `${cfg.accentBg} ring-1 ring-ds-primary/30 shadow-[0_0_14px_rgba(14,165,233,0.1)]`
                  : isDone ? "bg-ds-tertiary/5 border-ds-tertiary/20"
                  : "bg-ds-surface-container border-ds-outline-variant/10"}`}
            >
              <div className={`text-[11px] font-extrabold tracking-wider ${isWorking ? cfg.accent : isDone ? "text-ds-tertiary" : "text-ds-outline/50"}`}>
                {cfg.name}
              </div>
              <div className={`text-[8px] font-bold uppercase tracking-wider ${isWorking ? cfg.accent : isDone ? "text-ds-tertiary" : "text-ds-outline/30"}`}>
                {cfg.label}
              </div>
              <div className={`flex items-center gap-1 text-[8px] font-bold mt-0.5 ${isWorking ? "text-ds-primary" : isDone ? "text-ds-tertiary" : "text-ds-outline/30"}`}>
                {isWorking ? <Activity className="w-2.5 h-2.5 animate-pulse" />
                  : isDone ? <CheckCircle2 className="w-2.5 h-2.5" />
                  : <Clock className="w-2.5 h-2.5" />}
                {isWorking ? "Working" : isDone ? "Done" : "Idle"}
              </div>
              {agent.currentTask && isWorking && (
                <p className="text-[7px] text-ds-on-surface-variant text-center truncate w-full leading-tight mt-0.5" title={agent.currentTask}>
                  {agent.currentTask.length > 22 ? agent.currentTask.substring(0, 22) + "…" : agent.currentTask}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {executing.length > 0 ? (
        <div className="px-4 pb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-ds-primary animate-pulse" />
          <span className="text-[9px] font-extrabold text-ds-primary uppercase tracking-widest">
            {executing.length} agent{executing.length > 1 ? "s" : ""} working
          </span>
        </div>
      ) : (
        <div className="px-4 pb-3 flex items-center gap-2">
          <Zap className="w-3 h-3 text-ds-outline/30" />
          <span className="text-[9px] font-bold text-ds-outline/40 uppercase tracking-widest">Fleet standing by</span>
        </div>
      )}
    </div>
  );
}
