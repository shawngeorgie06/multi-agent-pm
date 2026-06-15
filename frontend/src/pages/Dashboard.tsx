import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Zap,
  Activity,
  TrendingUp,
  Cpu,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  ChevronRight,
  ExternalLink,
  Pause,
  Play,
  Code2,
  Palette,
  Search,
  MoreHorizontal,
  Rocket,
  Layers,
  Box,
  Cloud,
  Terminal,
  BookOpen,
  Headphones,
  Trash2,
  FileCode2,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { io, Socket } from "socket.io-client";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import { LiveActivityFeed } from "@/components/LiveActivityFeed";
import { AgentStatusBar } from "@/components/AgentStatusBar";
import { ResearchPanel } from "@/components/ResearchPanel";
import { QAReportPanel } from "@/components/QAReportPanel";
import { useProjects, ProjectDetail, Task } from "@/hooks/useProjects";
import { API_URL, WS_URL } from "@/lib/api";
import { toast } from "sonner";

/* ── Material Symbol helper ───────────────────────────── */
function MIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { projects, loading, error, fetchProjects: refetchProjects, fetchProjectDetail } = useProjects();
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [loadingProject, setLoadingProject] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"fleet" | "tasks">("fleet");
  const [aiService, setAiService] = useState<"github" | "gemini" | "groq" | "nvidia">("gemini");
  const [switchingAi, setSwitchingAi] = useState(false);
  const [taskFilter, setTaskFilter] = useState("");
  const [previewTab, setPreviewTab] = useState<"preview" | "source">("preview");

  // ── AI provider ─────────────────────────────────────
  useEffect(() => {
    fetch(`${API_URL}/api/settings`)
      .then(r => r.json())
      .then(d => { if (d.aiService) setAiService(d.aiService); })
      .catch(() => {});
  }, []);

  const handleAiSwitch = async (next: "github" | "gemini" | "groq" | "nvidia") => {
    if (next === aiService || switchingAi) return;
    setSwitchingAi(true);
    try {
      const res = await fetch(`${API_URL}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiService: next }),
      });
      if (res.ok) {
        setAiService(next);
        const label = next === "github" ? "GitHub Models" : next === "groq" ? "Groq" : next === "nvidia" ? "NVIDIA" : "Gemini";
        toast.success(`Switched to ${label}`);
      } else {
        const err = await res.json();
        toast.error("Switch failed", { description: err.error });
      }
    } catch {
      toast.error("Could not reach backend");
    } finally {
      setSwitchingAi(false);
    }
  };

  // ── Socket ──────────────────────────────────────────
  useEffect(() => {
    const newSocket = io(WS_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });
    setSocket(newSocket);
    return () => { newSocket.disconnect(); };
  }, []);

  // ── Auto-select project ─────────────────────────────
  useEffect(() => {
    if (projects.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const projectIdFromUrl = params.get("projectId");
    if (projectIdFromUrl) {
      const inList = projects.some((p) => p.id === projectIdFromUrl);
      if (inList) {
        setLoadingProject(true);
        fetchProjectDetail(projectIdFromUrl)
          .then((data) => { setSelectedProject(data); window.history.replaceState(null, "", "/dashboard"); })
          .catch(() => {})
          .finally(() => setLoadingProject(false));
        return;
      }
      refetchProjects();
      return;
    }
    if (selectedProject) {
      const projectStillExists = projects.find((p) => p.id === selectedProject.id);
      if (!projectStillExists) {
        setLoadingProject(true);
        fetchProjectDetail(projects[0].id).then(setSelectedProject).catch(() => {}).finally(() => setLoadingProject(false));
      }
    } else {
      setLoadingProject(true);
      fetchProjectDetail(projects[0].id).then(setSelectedProject).catch(() => {}).finally(() => setLoadingProject(false));
    }
  }, [projects, fetchProjectDetail, refetchProjects]);

  // ── WebSocket events ────────────────────────────────
  useEffect(() => {
    if (!socket || !selectedProject) return;
    const handleTaskUpdate = (data: { projectId: string; task: Task }) => {
      if (data.projectId === selectedProject.id) {
        setSelectedProject((prev) => {
          if (!prev) return prev;
          const existingIndex = prev.tasks.findIndex((t) => t.id === data.task.id);
          if (existingIndex >= 0) {
            const updatedTasks = [...prev.tasks];
            updatedTasks[existingIndex] = { ...updatedTasks[existingIndex], ...data.task };
            return { ...prev, tasks: updatedTasks };
          } else {
            if (data.task.createdAt && data.task.updatedAt) {
              return { ...prev, tasks: [...prev.tasks, data.task] };
            }
            return prev;
          }
        });
      }
    };
    const handleResearchComplete = (data: { projectId: string; research: any }) => {
      if (data.projectId === selectedProject.id) {
        setSelectedProject((prev) => prev ? { ...prev, researchOutput: JSON.stringify(data.research) } : prev);
      }
    };
    const handleQAReport = (data: { projectId: string; report: any }) => {
      if (data.projectId === selectedProject.id) {
        setSelectedProject((prev) => prev ? { ...prev, qaReport: JSON.stringify(data.report) } : prev);
      }
    };
    const handleProjectStatusChanged = (data: { projectId: string; status: string }) => {
      if (data.projectId === selectedProject.id) {
        setSelectedProject((prev) => (prev ? { ...prev, status: data.status as ProjectDetail["status"] } : prev));
        if (data.status === "completed") {
          fetchProjectDetail(selectedProject.id).then(setSelectedProject).catch(() => {});
        }
      }
    };
    const handleBlockerAlert = (data: { projectId: string; blocker: string }) => {
      if (data.projectId === selectedProject.id) toast.error("Project alert", { description: data.blocker });
    };
    const handleTaskFailed = (data: { projectId: string; taskId: string; reason: string }) => {
      if (data.projectId === selectedProject.id) toast.error(`Task ${data.taskId} failed`, { description: data.reason });
    };
    const handleTasksReady = (data: { projectId: string; taskCount: number }) => {
      if (data.projectId === selectedProject.id) {
        fetchProjectDetail(selectedProject.id).then((updated) => setSelectedProject(updated)).catch(() => {});
      }
    };
    socket.on("task_updated", handleTaskUpdate);
    socket.on("research_complete", handleResearchComplete);
    socket.on("qa_report", handleQAReport);
    socket.on("project_status_changed", handleProjectStatusChanged);
    socket.on("blocker_alert", handleBlockerAlert);
    socket.on("task_failed", handleTaskFailed);
    socket.on("tasks_ready", handleTasksReady);
    return () => {
      socket.off("task_updated", handleTaskUpdate);
      socket.off("research_complete", handleResearchComplete);
      socket.off("qa_report", handleQAReport);
      socket.off("project_status_changed", handleProjectStatusChanged);
      socket.off("blocker_alert", handleBlockerAlert);
      socket.off("task_failed", handleTaskFailed);
      socket.off("tasks_ready", handleTasksReady);
    };
  }, [socket, selectedProject?.id, fetchProjectDetail]);

  // ── Handlers ────────────────────────────────────────
  const handleSelectProject = async (projectId: string) => {
    setLoadingProject(true);
    try {
      const projectDetail = await fetchProjectDetail(projectId);
      setSelectedProject(projectDetail);
    } catch (err) {
      console.error("Failed to load project:", err);
    } finally {
      setLoadingProject(false);
    }
  };

  const handleTaskClick = (task: Task) => { setSelectedTask(task); setIsTaskModalOpen(true); };

  const handleTaskCreated = async (newProjectId: string) => {
    await refetchProjects();
    if (socket) {
      const tasksReadyHandler = (data: { projectId: string; taskCount: number }) => {
        if (data.projectId === newProjectId) {
          socket.off("tasks_ready", tasksReadyHandler);
          handleSelectProject(newProjectId);
        }
      };
      socket.on("tasks_ready", tasksReadyHandler);
      const timeout = setTimeout(() => { socket.off("tasks_ready", tasksReadyHandler); handleSelectProject(newProjectId); }, 90000);
      socket.once("tasks_ready", () => clearTimeout(timeout));
    } else {
      handleSelectProject(newProjectId);
    }
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this project? This cannot be undone.")) return;
    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Project deleted");
      await refetchProjects();
      if (selectedProject?.id === projectId) setSelectedProject(null);
    } catch {
      toast.error("Failed to delete project");
    }
  };

  // ── Helpers ─────────────────────────────────────────
  const getStatusDot = (status: string) => {
    switch (status) {
      case "COMPLETE": return "bg-ds-tertiary";
      case "IN_PROGRESS": return "bg-ds-primary animate-pulse";
      case "BLOCKED": case "FAILED": return "bg-ds-error";
      default: return "bg-ds-outline/30";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "COMPLETE": return <span className="text-[8px] text-ds-tertiary font-bold tracking-widest uppercase">Complete</span>;
      case "IN_PROGRESS": return <span className="text-[8px] text-ds-primary font-bold tracking-widest uppercase">Active</span>;
      case "BLOCKED": return <span className="text-[8px] text-ds-error font-bold tracking-widest uppercase">Blocked</span>;
      case "FAILED": return <span className="text-[8px] text-ds-error font-bold tracking-widest uppercase">Failed</span>;
      default: return <span className="text-[8px] text-ds-outline font-bold tracking-widest uppercase">Queued</span>;
    }
  };

  const getProjectStatusChip = (status: string) => {
    switch (status) {
      case "completed": return "bg-ds-tertiary/10 text-ds-tertiary";
      case "in_progress": return "bg-ds-primary/10 text-ds-primary";
      case "failed": return "bg-ds-error/10 text-ds-error";
      case "paused": return "bg-ds-outline/10 text-ds-outline";
      default: return "bg-ds-outline/10 text-ds-outline";
    }
  };

  const calculateStats = (tasks: Task[]) => {
    const completed = tasks.filter((t) => t.status === "COMPLETE").length;
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const blocked = tasks.filter((t) => t.status === "BLOCKED").length;
    const failed = tasks.filter((t) => t.status === "FAILED").length;
    const total = tasks.length;
    const efficiency = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, inProgress, blocked, failed, total, efficiency };
  };

  const stats = selectedProject && Array.isArray(selectedProject.tasks) && selectedProject.tasks.length > 0
    ? calculateStats(selectedProject.tasks) : null;

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     RENDER
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  return (
    <div className="min-h-screen bg-ds-surface text-ds-on-surface font-['Inter',sans-serif] antialiased selection:bg-ds-primary/30">
      {/* ── Top Nav ────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-6 h-16 bg-ds-surface-container-lowest/80 backdrop-blur-xl border-b border-ds-outline-variant/10">
        <div className="flex items-center gap-8">
          <button onClick={() => setLocation("/")} className="text-xl font-extrabold tracking-tighter text-ds-on-surface font-['Manrope',sans-serif] uppercase hover:opacity-75 transition-opacity">
            Orchestrator
          </button>
          <div className="hidden md:flex gap-6 font-['Manrope',sans-serif] font-bold tracking-tight text-xs uppercase">
            <button onClick={() => setLocation("/")} className="text-ds-on-surface-variant hover:text-ds-on-surface transition-colors duration-200">Projects</button>
            <button className="text-ds-primary border-b-2 border-ds-primary pb-1">Mainframe</button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative hidden sm:block">
            <input
              className="bg-ds-surface-container-low text-xs border border-ds-outline-variant/20 rounded-lg px-4 py-2 w-64 focus:ring-1 focus:ring-ds-primary outline-none text-ds-on-surface placeholder-ds-outline"
              placeholder="Filter tasks..."
              type="text"
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
            />
            <Search className="absolute right-3 top-2 text-ds-outline w-4 h-4" />
          </div>
          {/* AI Provider toggle */}
          <div className="hidden sm:flex items-center gap-1 bg-ds-surface-container-low border border-ds-outline-variant/20 rounded-lg p-1">
            <button
              onClick={() => handleAiSwitch("github")}
              disabled={switchingAi}
              className={`px-2.5 py-1 rounded text-[9px] font-extrabold uppercase tracking-widest transition-all ${aiService === "github" ? "bg-ds-primary text-white" : "text-ds-on-surface-variant hover:text-ds-on-surface"}`}
            >
              GitHub
            </button>
            <button
              onClick={() => handleAiSwitch("gemini")}
              disabled={switchingAi}
              className={`px-2.5 py-1 rounded text-[9px] font-extrabold uppercase tracking-widest transition-all ${aiService === "gemini" ? "bg-ds-primary text-white" : "text-ds-on-surface-variant hover:text-ds-on-surface"}`}
            >
              Gemini
            </button>
            <button
              onClick={() => handleAiSwitch("groq")}
              disabled={switchingAi}
              className={`px-2.5 py-1 rounded text-[9px] font-extrabold uppercase tracking-widest transition-all ${aiService === "groq" ? "bg-ds-primary text-white" : "text-ds-on-surface-variant hover:text-ds-on-surface"}`}
            >
              Groq
            </button>
            <button
              onClick={() => handleAiSwitch("nvidia")}
              disabled={switchingAi}
              className={`px-2.5 py-1 rounded text-[9px] font-extrabold uppercase tracking-widest transition-all ${aiService === "nvidia" ? "bg-ds-primary text-white" : "text-ds-on-surface-variant hover:text-ds-on-surface"}`}
            >
              NVIDIA
            </button>
          </div>
          <div className="w-8 h-8 rounded-full overflow-hidden bg-ds-primary/20 flex items-center justify-center border border-ds-outline-variant/30">
            <Zap className="w-4 h-4 text-ds-primary" />
          </div>
        </div>
      </nav>

      {/* ── Side Nav ───────────────────────────────── */}
      <aside className="fixed left-0 top-16 bottom-0 flex-col py-8 bg-ds-surface-container w-64 hidden lg:flex border-r border-ds-outline-variant/10 z-40">
        {/* Fleet Command header */}
        <div className="px-6 mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-ds-tertiary" />
            <span className="text-ds-on-surface font-extrabold uppercase text-[10px] tracking-[0.2em] font-['Manrope',sans-serif]">Fleet Command</span>
          </div>
          <p className="text-[10px] text-ds-outline uppercase font-bold">{projects.length} Project{projects.length !== 1 ? "s" : ""} Active</p>
        </div>

        {/* Nav items */}
        <nav className="px-3 space-y-1 mb-6">
          <button
            onClick={() => setSidebarTab("fleet")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm font-semibold ${sidebarTab === "fleet" ? "text-ds-primary bg-ds-primary/5 border-l-2 border-ds-primary" : "text-ds-on-surface-variant hover:bg-ds-surface-container-highest/20 hover:text-ds-on-surface"}`}
          >
            <Rocket className="w-5 h-5" /> Fleet
          </button>
          <button
            onClick={() => setSidebarTab("tasks")}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm font-semibold ${sidebarTab === "tasks" ? "text-ds-primary bg-ds-primary/5 border-l-2 border-ds-primary" : "text-ds-on-surface-variant hover:bg-ds-surface-container-highest/20 hover:text-ds-on-surface"}`}
          >
            <Layers className="w-5 h-5" /> Tasks
          </button>
          <span className="flex items-center gap-3 px-4 py-2.5 text-ds-on-surface-variant/40 rounded-lg text-sm font-semibold cursor-not-allowed" title="Coming soon">
            <Box className="w-5 h-5" /> Assets
          </span>
          <span className="flex items-center gap-3 px-4 py-2.5 text-ds-on-surface-variant/40 rounded-lg text-sm font-semibold cursor-not-allowed" title="Coming soon">
            <Cloud className="w-5 h-5" /> Deployments
          </span>
        </nav>

        {/* Project list */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-ds-outline px-4 mb-2">Projects</p>
          {projects.map((project) => (
            <div
              key={project.id}
              className={`group flex items-center gap-1 rounded-lg transition-all text-xs ${selectedProject?.id === project.id
                ? "bg-ds-primary/10 border-l-2 border-ds-primary"
                : "hover:bg-ds-surface-container-highest/20"
              }`}
            >
              <button
                onClick={() => handleSelectProject(project.id)}
                className={`flex-1 text-left px-4 py-2.5 min-w-0 ${selectedProject?.id === project.id ? "text-ds-primary" : "text-ds-on-surface-variant hover:text-ds-on-surface"}`}
              >
                <p className="font-semibold truncate">{project.name.substring(0, 30)}</p>
                <p className="text-[9px] text-ds-outline mt-0.5">{project._count.tasks} tasks</p>
              </button>
              <button
                onClick={(e) => handleDeleteProject(project.id, e)}
                className="opacity-0 group-hover:opacity-100 pr-3 text-ds-outline/40 hover:text-ds-error transition-all flex-shrink-0"
                title="Delete project"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="px-6 mt-auto space-y-6 pt-4">
          <button
            onClick={() => setIsCreateTaskModalOpen(true)}
            className="w-full py-3 bg-ds-primary text-ds-on-primary-container font-extrabold rounded-lg text-xs uppercase tracking-widest shadow-lg shadow-ds-primary/20 hover:brightness-110 transition-all"
          >
            New Agent Task
          </button>
          <div className="pt-4 border-t border-ds-outline-variant/10 space-y-3">
            <a className="flex items-center gap-3 text-ds-on-surface-variant hover:text-ds-on-surface text-[10px] font-bold uppercase transition-colors" href="#">
              <BookOpen className="w-3.5 h-3.5" /> Documentation
            </a>
            <a className="flex items-center gap-3 text-ds-on-surface-variant hover:text-ds-on-surface text-[10px] font-bold uppercase transition-colors" href="#">
              <Headphones className="w-3.5 h-3.5" /> Support
            </a>
          </div>
        </div>
      </aside>

      {/* ── Main Content ───────────────────────────── */}
      <main className="lg:ml-64 pt-24 px-8 pb-12 min-h-screen">
        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 bg-ds-error/10 border border-ds-error/30 rounded-lg">
            <p className="font-bold text-ds-error text-sm">Error: {error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && !selectedProject ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-ds-primary" />
            <span className="ml-3 font-bold text-ds-on-surface-variant">Initializing fleet...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-3xl font-extrabold font-['Manrope',sans-serif] tracking-tighter mb-4">No Active Missions</h2>
            <p className="text-ds-outline mb-8 text-sm">Create a new project to begin orchestration</p>
            <button onClick={() => setLocation("/")} className="px-8 py-3 bg-ds-primary text-ds-on-primary-container font-extrabold rounded-lg text-xs uppercase tracking-widest hover:brightness-110 transition-all inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Launch Mission
            </button>
          </div>
        ) : (
          <>
            {/* Header */}
            <header className="mb-10">
              {selectedProject && (
                <span className="text-ds-primary font-['Inter',sans-serif] text-[10px] uppercase tracking-[0.4em] font-extrabold">
                  Operation: {selectedProject.name.substring(0, 40)}
                </span>
              )}
              <h1 className="text-5xl font-extrabold font-['Manrope',sans-serif] tracking-tighter mt-1 text-ds-on-surface">
                Mission Control
              </h1>
              {stats && (
                <div className="mt-5 space-y-1.5 max-w-md">
                  <div className="flex justify-between text-[9px] font-extrabold uppercase tracking-widest text-ds-outline">
                    <span>Mission Progress</span>
                    <span className="text-ds-primary">{stats.efficiency}%</span>
                  </div>
                  <div className="h-1.5 bg-ds-surface-container-high rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ds-primary rounded-full transition-all duration-700"
                      style={{ width: `${stats.efficiency}%` }}
                    />
                  </div>
                  <div className="flex gap-4 pt-0.5">
                    <span className="text-[9px] text-ds-tertiary font-bold">{stats.completed} complete</span>
                    {stats.inProgress > 0 && <span className="text-[9px] text-ds-primary font-bold">{stats.inProgress} active</span>}
                    {(stats.blocked + stats.failed) > 0 && <span className="text-[9px] text-ds-error font-bold">{stats.blocked + stats.failed} blocked</span>}
                    <span className="text-[9px] text-ds-outline font-bold">{stats.total} total</span>
                  </div>
                </div>
              )}
            </header>

            {loadingProject ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-ds-primary" />
                <span className="ml-3 text-ds-on-surface-variant text-sm">Loading project data...</span>
              </div>
            ) : selectedProject && (
              <div className="ds-asymmetric-grid">
                {/* ── Left Column ────────────────────── */}
                <div className="space-y-6">

                  {/* Agent Fleet */}
                  <section className="bg-ds-surface-container-low rounded-xl border border-ds-outline-variant/20 overflow-hidden">
                    <div className="px-6 py-4 flex justify-between items-center border-b border-ds-outline-variant/10 bg-ds-surface-container">
                      <h2 className="text-xs font-extrabold font-['Manrope',sans-serif] uppercase tracking-[0.2em] text-ds-on-surface">Agent Fleet</h2>
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-ds-tertiary animate-pulse" />
                        <span className="text-[10px] font-extrabold text-ds-tertiary uppercase tracking-widest">Live</span>
                      </div>
                    </div>
                    <AgentStatusBar projectId={selectedProject.id} />
                  </section>

                  {/* Project Storyline (Activity Feed) */}
                  <section className="space-y-4">
                    <h2 className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-ds-outline px-1">Project Storyline</h2>
                    <div className="bg-ds-surface-container-low rounded-xl border border-ds-outline-variant/10 overflow-hidden">
                      <LiveActivityFeed projectId={selectedProject.id} />
                    </div>
                  </section>

                  {/* Agent Cards Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Architect Agent */}
                    <div className="bg-ds-surface-container p-5 rounded-lg border border-ds-outline-variant/10 group hover:border-ds-primary/30 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-ds-surface-container-highest flex items-center justify-center text-ds-primary">
                            <Code2 className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-xs uppercase tracking-tight text-ds-on-surface">Engineer</h3>
                            {getStatusLabel(selectedProject.tasks?.find(t => t.status === "IN_PROGRESS")?.status || "TODO")}
                          </div>
                        </div>
                        <MoreHorizontal className="w-4 h-4 text-ds-outline" />
                      </div>
                      <p className="text-[11px] text-ds-on-surface-variant italic mb-4 leading-relaxed">
                        {selectedProject.tasks?.find(t => t.status === "IN_PROGRESS")?.description || "Awaiting task assignment..."}
                      </p>
                      <div className="flex gap-6 border-t border-ds-outline-variant/10 pt-4">
                        <div>
                          <p className="text-[8px] text-ds-outline font-extrabold uppercase tracking-tighter">Efficiency</p>
                          <p className="text-sm font-['Manrope',sans-serif] font-extrabold text-ds-on-surface">{stats?.efficiency || 0}%</p>
                        </div>
                        <div>
                          <p className="text-[8px] text-ds-outline font-extrabold uppercase tracking-tighter">Tasks</p>
                          <p className="text-sm font-['Manrope',sans-serif] font-extrabold text-ds-on-surface">{stats?.completed || 0}/{stats?.total || 0}</p>
                        </div>
                      </div>
                    </div>
                    {/* Queue Monitor */}
                    <div className="bg-ds-surface-container p-5 rounded-lg border border-ds-outline-variant/10 group hover:border-ds-outline-variant/50 transition-colors">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-ds-surface-container-highest flex items-center justify-center text-ds-secondary">
                            <Palette className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-xs uppercase tracking-tight text-ds-on-surface">Queue</h3>
                            {(stats?.inProgress ?? 0) > 0
                              ? <span className="text-[8px] text-ds-primary font-bold tracking-widest uppercase">Processing</span>
                              : <span className="text-[8px] text-ds-outline font-bold tracking-widest uppercase">Idle</span>
                            }
                          </div>
                        </div>
                        <MoreHorizontal className="w-4 h-4 text-ds-outline" />
                      </div>
                      <p className="text-[11px] text-ds-on-surface-variant italic mb-4 leading-relaxed">
                        {(stats?.inProgress ?? 0) > 0
                          ? `${stats!.inProgress} task${stats!.inProgress > 1 ? "s" : ""} currently being processed.`
                          : stats && stats.total > 0
                            ? "All tasks resolved — queue clear."
                            : "No tasks queued yet."}
                      </p>
                      <div className="flex gap-6 border-t border-ds-outline-variant/10 pt-4">
                        <div>
                          <p className="text-[8px] text-ds-outline font-extrabold uppercase tracking-tighter">Queued</p>
                          <p className="text-sm font-['Manrope',sans-serif] font-extrabold text-ds-on-surface">
                            {selectedProject.tasks?.filter(t => t.status === "TODO" || t.status === "QUEUED").length || 0}
                          </p>
                        </div>
                        <div>
                          <p className="text-[8px] text-ds-outline font-extrabold uppercase tracking-tighter">Blocked</p>
                          <p className="text-sm font-['Manrope',sans-serif] font-extrabold text-ds-on-surface">
                            {(stats?.blocked ?? 0) + (stats?.failed ?? 0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Task List */}
                  {selectedProject.tasks && selectedProject.tasks.length > 0 && (
                    <section className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-ds-outline px-1">Task Queue</h2>
                        <button
                          onClick={() => setIsCreateTaskModalOpen(true)}
                          className="text-[9px] font-extrabold text-ds-primary uppercase tracking-widest hover:text-ds-primary-fixed-dim transition-colors flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add Task
                        </button>
                      </div>
                      <div className="space-y-1">
                        {selectedProject.tasks.filter(t =>
                          !taskFilter || t.description.toLowerCase().includes(taskFilter.toLowerCase()) || t.taskId.toLowerCase().includes(taskFilter.toLowerCase())
                        ).map((task, i) => (
                          <div
                            key={task.id}
                            onClick={() => handleTaskClick(task)}
                            className={`${i === 0 ? "rounded-t-lg" : ""} ${i === selectedProject.tasks.length - 1 ? "rounded-b-lg" : ""} bg-ds-surface-container-low/${i % 2 === 0 ? "50" : "30"} p-4 flex items-center gap-4 border-x border-ds-outline-variant/10 ${i === 0 ? "border-t" : ""} ${i === selectedProject.tasks.length - 1 ? "border-b" : ""} cursor-pointer hover:bg-ds-surface-container-high/50 transition-colors`}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getStatusDot(task.status)}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-ds-on-surface text-sm leading-relaxed">
                                <span className="font-bold text-ds-primary">{task.taskId}</span>: {task.description}
                              </p>
                              <div className="flex items-center gap-3 mt-1">
                                {getStatusLabel(task.status)}
                                <span className="text-[8px] text-ds-outline font-bold uppercase tracking-widest">{task.priority}</span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-ds-outline/30" />
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Research Analysis */}
                  {selectedProject.researchOutput && (
                    <section className="space-y-4">
                      <h2 className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-ds-outline px-1">Research Analysis</h2>
                      <div className="bg-ds-surface-container p-6 rounded-xl border border-ds-outline-variant/10">
                        <ResearchPanel research={JSON.parse(selectedProject.researchOutput)} />
                      </div>
                    </section>
                  )}

                  {/* QA Report */}
                  {selectedProject.qaReport && (
                    <section className="space-y-4">
                      <h2 className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-ds-outline px-1">QA Validation</h2>
                      <div className="bg-ds-surface-container p-6 rounded-xl border border-ds-outline-variant/10">
                        <QAReportPanel report={JSON.parse(selectedProject.qaReport)} />
                      </div>
                    </section>
                  )}
                </div>

                {/* ── Right Column ───────────────────── */}
                <div className="space-y-6">

                  {/* UI Preview Window */}
                  <section className="bg-ds-surface-container-lowest rounded-xl border border-ds-outline-variant/30 overflow-hidden shadow-2xl">
                    {/* Window chrome */}
                    <div className="bg-ds-surface-container px-4 py-2.5 flex items-center justify-between border-b border-ds-outline-variant/10">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                        <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
                      </div>
                      <div className="flex items-center gap-2 bg-ds-surface-container-low px-3 py-1 rounded border border-ds-outline-variant/10">
                        <MIcon name="lock" className="text-[10px] text-ds-outline" />
                        <span className="text-[9px] text-ds-outline font-bold tracking-tight uppercase">agent-hub.preview</span>
                      </div>
                      {selectedProject.tasks?.some((t) => t.generatedCode) && (
                        <button
                          onClick={() => window.open(`${API_URL}/apps/${selectedProject.id}/index.html`, "_blank")}
                          className="text-ds-outline hover:text-ds-primary transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Tab bar — only shown when there's code */}
                    {selectedProject.tasks?.some(t => t.generatedCode) && (
                      <div className="flex border-b border-ds-outline-variant/10 bg-ds-surface-container">
                        <button
                          onClick={() => setPreviewTab("preview")}
                          className={`px-4 py-2 text-[9px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 transition-colors ${previewTab === "preview" ? "text-ds-primary border-b-2 border-ds-primary" : "text-ds-outline/50 hover:text-ds-on-surface-variant"}`}
                        >
                          <ExternalLink className="w-3 h-3" /> Preview
                        </button>
                        <button
                          onClick={() => setPreviewTab("source")}
                          className={`px-4 py-2 text-[9px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 transition-colors ${previewTab === "source" ? "text-ds-primary border-b-2 border-ds-primary" : "text-ds-outline/50 hover:text-ds-on-surface-variant"}`}
                        >
                          <FileCode2 className="w-3 h-3" /> Source
                        </button>
                      </div>
                    )}

                    {selectedProject.tasks?.some(t => t.generatedCode) ? (
                      previewTab === "preview" ? (
                        <div className="aspect-[4/5] bg-[#0A0A0A] overflow-hidden relative">
                          <iframe
                            src={`${API_URL}/apps/${selectedProject.id}/index.html`}
                            className="w-full h-full border-0"
                            title="Generated App Preview"
                            sandbox="allow-scripts allow-same-origin allow-forms"
                          />
                          {/* Refinement overlay — shown when Phase 3 is running */}
                          {selectedProject.status === "in_progress" && (
                            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3 pointer-events-none">
                              <div className="flex items-center gap-2 px-4 py-2.5 bg-ds-surface/80 border border-ds-primary/40 rounded-lg">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-ds-primary" />
                                <span className="text-[10px] font-extrabold text-ds-primary uppercase tracking-widest">Agents refining…</span>
                              </div>
                              <p className="text-[9px] text-white/40">Preview auto-refreshes when complete</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Source code viewer */
                        <div className="aspect-[4/5] bg-[#0A0A0A] overflow-y-auto">
                          {(() => {
                            const htmlTask = selectedProject.tasks.find(t => t.taskId.startsWith("LAYOUT"));
                            const cssTask  = selectedProject.tasks.find(t => t.taskId.startsWith("STYLING"));
                            const jsTask   = selectedProject.tasks.find(t => t.taskId.startsWith("LOGIC"));
                            return (
                              <div className="p-4 space-y-4 font-mono text-[10px]">
                                {htmlTask?.generatedCode && (
                                  <div>
                                    <p className="text-[8px] font-extrabold uppercase tracking-widest text-[#f59e0b] mb-1.5">HTML (Layout)</p>
                                    <pre className="bg-ds-surface-container/60 rounded p-3 overflow-x-auto text-ds-on-surface-variant/80 leading-relaxed whitespace-pre-wrap break-words">{htmlTask.generatedCode}</pre>
                                  </div>
                                )}
                                {cssTask?.generatedCode && (
                                  <div>
                                    <p className="text-[8px] font-extrabold uppercase tracking-widest text-[#ec4899] mb-1.5">CSS (Styling)</p>
                                    <pre className="bg-ds-surface-container/60 rounded p-3 overflow-x-auto text-ds-on-surface-variant/80 leading-relaxed whitespace-pre-wrap break-words">{cssTask.generatedCode}</pre>
                                  </div>
                                )}
                                {jsTask?.generatedCode && (
                                  <div>
                                    <p className="text-[8px] font-extrabold uppercase tracking-widest text-[#6366f1] mb-1.5">JavaScript (Logic)</p>
                                    <pre className="bg-ds-surface-container/60 rounded p-3 overflow-x-auto text-ds-on-surface-variant/80 leading-relaxed whitespace-pre-wrap break-words">{jsTask.generatedCode}</pre>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )
                    ) : (
                      <div className="aspect-[4/5] bg-[#0A0A0A] flex flex-col items-center justify-center gap-4 relative">
                        <div className="w-12 h-12 rounded-full border border-ds-outline-variant/20 flex items-center justify-center">
                          <Loader2 className={`w-5 h-5 text-ds-outline/40 ${(stats?.inProgress ?? 0) > 0 ? "animate-spin" : ""}`} />
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-extrabold uppercase tracking-widest text-ds-outline/60">Awaiting Build</p>
                          <p className="text-[9px] text-ds-outline/30 mt-1">Generated app will preview here</p>
                        </div>
                        {(stats?.inProgress ?? 0) > 0 && (
                          <div className="absolute bottom-6 left-6 right-6 p-4 glass-panel rounded-lg border border-ds-primary/30 shadow-2xl bg-ds-surface/60">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-ds-primary animate-pulse" />
                              <span className="text-[9px] font-extrabold text-ds-primary tracking-[0.2em] uppercase">Active Build Log</span>
                            </div>
                            <code className="text-[9px] font-mono text-ds-primary/80 block leading-relaxed">
                              &gt; Initializing agent orchestration pipeline...<br />
                              &gt; Task distribution across {stats?.total || 0} nodes...<br />
                              &gt; {stats?.completed || 0} tasks completed. System nominal.
                            </code>
                          </div>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Telemetry Readouts */}
                  <section className="bg-ds-surface-container p-6 rounded-xl border border-ds-outline-variant/10 space-y-6">
                    <h2 className="text-[10px] font-extrabold font-['Manrope',sans-serif] uppercase tracking-[0.3em] text-ds-outline">Telemetry Readouts</h2>
                    <div className="grid grid-cols-1 gap-5">
                      {/* Total Tasks */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded bg-ds-primary/10 flex items-center justify-center border border-ds-primary/20">
                            <Cpu className="w-5 h-5 text-ds-primary" />
                          </div>
                          <div>
                            <span className="text-[8px] text-ds-outline block font-extrabold uppercase tracking-widest">Total Tasks</span>
                            <span className="text-2xl font-['Manrope',sans-serif] font-extrabold text-ds-on-surface tracking-tighter">{stats?.total || 0} <span className="text-xs font-medium text-ds-outline">nodes</span></span>
                          </div>
                        </div>
                        <span className="text-[9px] text-ds-tertiary font-extrabold tracking-tight">{stats?.efficiency || 0}%</span>
                      </div>
                      {/* Completed */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded bg-ds-tertiary/10 flex items-center justify-center border border-ds-tertiary/20">
                            <CheckCircle2 className="w-5 h-5 text-ds-tertiary" />
                          </div>
                          <div>
                            <span className="text-[8px] text-ds-outline block font-extrabold uppercase tracking-widest">Completed</span>
                            <span className="text-2xl font-['Manrope',sans-serif] font-extrabold text-ds-on-surface tracking-tighter">{stats?.completed || 0} <span className="text-xs font-medium text-ds-outline">tasks</span></span>
                          </div>
                        </div>
                        <div className="flex gap-1 h-6 items-end">
                          {(() => {
                            const r = stats ? stats.completed / Math.max(stats.total, 1) : 0;
                            return [0.4, 0.65, 1.0, 0.75].map((scale, i) => (
                              <div key={i} className="w-1 bg-ds-tertiary rounded-sm transition-all duration-500" style={{ height: `${Math.max(3, r * 24 * scale)}px`, opacity: 0.4 + scale * 0.6 }} />
                            ));
                          })()}
                        </div>
                      </div>
                      {/* In Progress */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded bg-ds-primary/10 flex items-center justify-center border border-ds-primary/20">
                            <Activity className="w-5 h-5 text-ds-primary" />
                          </div>
                          <div>
                            <span className="text-[8px] text-ds-outline block font-extrabold uppercase tracking-widest">Active Agents</span>
                            <span className="text-2xl font-['Manrope',sans-serif] font-extrabold text-ds-on-surface tracking-tighter">{stats?.inProgress || 0} <span className="text-xs font-medium text-ds-outline">active</span></span>
                          </div>
                        </div>
                        {(stats?.inProgress || 0) > 0 && (
                          <span className="px-2 py-0.5 bg-ds-primary/10 text-ds-primary text-[8px] font-extrabold uppercase rounded tracking-widest">Processing</span>
                        )}
                      </div>
                      {/* Blocked */}
                      {(stats?.blocked || 0) + (stats?.failed || 0) > 0 && (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded bg-ds-error/10 flex items-center justify-center border border-ds-error/20">
                              <AlertCircle className="w-5 h-5 text-ds-error" />
                            </div>
                            <div>
                              <span className="text-[8px] text-ds-outline block font-extrabold uppercase tracking-widest">Blocked / Failed</span>
                              <span className="text-2xl font-['Manrope',sans-serif] font-extrabold text-ds-on-surface tracking-tighter">{(stats?.blocked || 0) + (stats?.failed || 0)}</span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-ds-error/10 text-ds-error text-[8px] font-extrabold uppercase rounded tracking-widest">Alert</span>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Project Controls */}
                  <section className="bg-ds-surface-container p-5 rounded-xl border border-ds-outline-variant/10 space-y-4">
                    <h2 className="text-[10px] font-extrabold font-['Manrope',sans-serif] uppercase tracking-[0.3em] text-ds-outline">Mission Controls</h2>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ds-on-surface-variant font-semibold">Status</span>
                      <span className={`px-3 py-1 text-[8px] font-extrabold uppercase rounded tracking-widest ${getProjectStatusChip(selectedProject.status)}`}>
                        {selectedProject.status.replace("_", " ")}
                      </span>
                    </div>
                    {(selectedProject.status === "in_progress" || selectedProject.status === "paused") && (
                      <div>
                        {selectedProject.status === "in_progress" ? (
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`${API_URL}/api/projects/${selectedProject.id}/pause`, { method: "POST" });
                                if (res.ok) { setSelectedProject((p) => (p ? { ...p, status: "paused" as const } : p)); toast.success("Mission paused"); }
                                else toast.error("Failed to pause");
                              } catch { toast.error("Failed to pause"); }
                            }}
                            className="w-full py-2.5 flex items-center justify-center gap-2 bg-ds-surface-container-high rounded-lg border border-ds-outline-variant/10 text-ds-on-surface-variant text-xs font-extrabold uppercase tracking-widest hover:bg-ds-surface-container-highest transition-colors"
                          >
                            <Pause className="w-3.5 h-3.5" /> Pause Mission
                          </button>
                        ) : (
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`${API_URL}/api/projects/${selectedProject.id}/resume`, { method: "POST" });
                                if (res.ok) { setSelectedProject((p) => (p ? { ...p, status: "in_progress" as const } : p)); toast.success("Mission resumed"); }
                                else toast.error("Failed to resume");
                              } catch { toast.error("Failed to resume"); }
                            }}
                            className="w-full py-2.5 flex items-center justify-center gap-2 bg-ds-primary text-ds-on-primary-container rounded-lg text-xs font-extrabold uppercase tracking-widest hover:brightness-110 transition-all"
                          >
                            <Play className="w-3.5 h-3.5" /> Resume Mission
                          </button>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setIsCreateTaskModalOpen(true)}
                      className="bg-ds-surface-container-high py-4 rounded-lg flex flex-col items-center justify-center gap-2 border border-ds-outline-variant/10 hover:bg-ds-surface-container-highest transition-colors group"
                    >
                      <Terminal className="w-6 h-6 text-ds-primary group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-ds-outline">New Task</span>
                    </button>
                    {selectedProject.tasks?.some(t => t.generatedCode) ? (
                      <button
                        onClick={() => window.open(`${API_URL}/apps/${selectedProject.id}/index.html`, "_blank")}
                        className="bg-ds-surface-container-high py-4 rounded-lg flex flex-col items-center justify-center gap-2 border border-ds-outline-variant/10 hover:bg-ds-surface-container-highest transition-colors group"
                      >
                        <ExternalLink className="w-6 h-6 text-ds-secondary group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-ds-outline">Preview</span>
                      </button>
                    ) : (
                      <div className="bg-ds-surface-container-high/40 py-4 rounded-lg flex flex-col items-center justify-center gap-2 border border-ds-outline-variant/10 cursor-not-allowed" title="No generated app yet">
                        <ExternalLink className="w-6 h-6 text-ds-outline/30" />
                        <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-ds-outline/30">Preview</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── FAB ────────────────────────────────────── */}
      <div className="fixed bottom-8 right-8 z-50 lg:hidden">
        <button
          onClick={() => setIsCreateTaskModalOpen(true)}
          className="w-14 h-14 rounded-full bg-ds-primary text-ds-on-primary-container shadow-2xl shadow-ds-primary/30 flex items-center justify-center hover:scale-110 transition-transform active:scale-95 group"
        >
          <Plus className="w-7 h-7 group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      {/* ── Modals ─────────────────────────────────── */}
      {isTaskModalOpen && selectedTask && (
        <TaskDetailModal task={selectedTask} isOpen={isTaskModalOpen} onClose={() => setIsTaskModalOpen(false)} />
      )}
      {selectedProject && (
        <CreateTaskModal
          projectId={selectedProject.id}
          isOpen={isCreateTaskModalOpen}
          onClose={() => setIsCreateTaskModalOpen(false)}
          onTaskCreated={handleTaskCreated}
        />
      )}
    </div>
  );
}
