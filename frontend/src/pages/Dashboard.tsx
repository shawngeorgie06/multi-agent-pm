import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Zap,
  Activity,
  TrendingUp,
  Settings,
  LogOut,
  Cpu,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Pause,
  Play,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { io, Socket } from "socket.io-client";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { CreateTaskModal } from "@/components/CreateTaskModal";
import { LiveActivityFeed } from "@/components/LiveActivityFeed";
import { ResearchPanel } from "@/components/ResearchPanel";
import { QAReportPanel } from "@/components/QAReportPanel";
import { useProjects, ProjectDetail, Task } from "@/hooks/useProjects";
import { API_URL, WS_URL } from "@/lib/api";
import { toast } from "sonner";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { projects, loading, error, fetchProjects: refetchProjects, fetchProjectDetail } = useProjects();
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [loadingProject, setLoadingProject] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  // Create persistent socket connection on mount
  useEffect(() => {
    const newSocket = io(WS_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Read ?projectId= from URL (e.g. after creating from Home) and auto-select; otherwise select first project
  useEffect(() => {
    if (projects.length === 0) return;

    const params = new URLSearchParams(window.location.search);
    const projectIdFromUrl = params.get("projectId");

    if (projectIdFromUrl) {
      const inList = projects.some((p) => p.id === projectIdFromUrl);
      if (inList) {
        setLoadingProject(true);
        fetchProjectDetail(projectIdFromUrl)
          .then((data) => {
            setSelectedProject(data);
            window.history.replaceState(null, "", "/dashboard");
          })
          .catch(() => {})
          .finally(() => setLoadingProject(false));
        return;
      }
      // New project not in list yet; refetch so it appears
      refetchProjects();
      return;
    }

    // No projectId in URL: select first or fix deleted selection
    if (selectedProject) {
      const projectStillExists = projects.find((p) => p.id === selectedProject.id);
      if (!projectStillExists) {
        setLoadingProject(true);
        fetchProjectDetail(projects[0].id)
          .then(setSelectedProject)
          .catch(() => {})
          .finally(() => setLoadingProject(false));
      }
    } else {
      setLoadingProject(true);
      fetchProjectDetail(projects[0].id)
        .then(setSelectedProject)
        .catch(() => {})
        .finally(() => setLoadingProject(false));
    }
  }, [projects, fetchProjectDetail, refetchProjects]);

  // Listen for real-time task updates via WebSocket
  useEffect(() => {
    if (!socket || !selectedProject) return;

    const handleTaskUpdate = (data: { projectId: string; task: Task }) => {
      // Update tasks if this is for our selected project
      console.log(`[FRONTEND] Task update event received:`, data);
      if (data.projectId === selectedProject.id) {
        setSelectedProject((prev) => {
          if (!prev) return prev;

          // Find if task already exists
          const existingIndex = prev.tasks.findIndex((t) => t.id === data.task.id);
          if (existingIndex >= 0) {
            // Update existing task - MERGE update to preserve existing fields like createdAt/updatedAt
            const updatedTasks = [...prev.tasks];
            updatedTasks[existingIndex] = { ...updatedTasks[existingIndex], ...data.task };
            console.log(`[FRONTEND] Updated existing task, total tasks now:`, updatedTasks.length);
            return { ...prev, tasks: updatedTasks };
          } else {
            // Only add new task if it has complete data (including timestamps)
            if (data.task.createdAt && data.task.updatedAt) {
              console.log(`[FRONTEND] Adding new task to tasks array`);
              return { ...prev, tasks: [...prev.tasks, data.task] };
            } else {
              console.warn(`[FRONTEND] Ignoring incomplete task update without timestamps:`, data.task);
              return prev;
            }
          }
        });
      }
    };

    const handleResearchComplete = (data: { projectId: string; research: any }) => {
      if (data.projectId === selectedProject.id) {
        setSelectedProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            researchOutput: JSON.stringify(data.research),
          };
        });
      }
    };

    const handleQAReport = (data: { projectId: string; report: any }) => {
      if (data.projectId === selectedProject.id) {
        setSelectedProject((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            qaReport: JSON.stringify(data.report),
          };
        });
      }
    };

    const handleProjectStatusChanged = (data: { projectId: string; status: string }) => {
      if (data.projectId === selectedProject.id) {
        setSelectedProject((prev) => (prev ? { ...prev, status: data.status as ProjectDetail["status"] } : prev));
      }
    };

    const handleBlockerAlert = (data: { projectId: string; blocker: string }) => {
      if (data.projectId === selectedProject.id) {
        toast.error("Project alert", { description: data.blocker });
      }
    };

    const handleTaskFailed = (data: { projectId: string; taskId: string; reason: string }) => {
      if (data.projectId === selectedProject.id) {
        toast.error(`Task ${data.taskId} failed`, { description: data.reason });
      }
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

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleTaskCreated = async (newProjectId: string) => {
    // Refresh all projects
    await refetchProjects();

    // Wait for tasks_ready event from backend via WebSocket
    if (socket) {
      const tasksReadyHandler = (data: { projectId: string; taskCount: number }) => {
        if (data.projectId === newProjectId) {
          console.log(`✅ Tasks ready event received: ${data.taskCount} tasks for project ${newProjectId}`);
          socket.off('tasks_ready', tasksReadyHandler);
          handleSelectProject(newProjectId);
        }
      };

      socket.on('tasks_ready', tasksReadyHandler);

      // Timeout after 90 seconds if no tasks_ready event
      const timeout = setTimeout(() => {
        socket.off('tasks_ready', tasksReadyHandler);
        console.log('⏱️ Timeout waiting for tasks_ready event - loading project anyway');
        handleSelectProject(newProjectId);
      }, 90000);

      // Store timeout ID for cleanup
      const cleanup = () => clearTimeout(timeout);
      socket.once('tasks_ready', cleanup);
    } else {
      // No socket connection, load project directly
      console.log('No socket connection - loading project immediately');
      handleSelectProject(newProjectId);
    }
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETE":
        return "bg-green-100 text-green-900 border-2 border-green-900";
      case "IN_PROGRESS":
        return "bg-yellow-100 text-yellow-900 border-2 border-yellow-900";
      case "BLOCKED":
        return "bg-red-100 text-red-900 border-2 border-red-900";
      case "FAILED":
        return "bg-red-100 text-red-900 border-2 border-red-900";
      case "TODO":
        return "bg-gray-100 text-gray-900 border-2 border-gray-900";
      default:
        return "bg-gray-100 text-gray-900 border-2 border-gray-900";
    }
  };

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETE":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "IN_PROGRESS":
        return <Activity className="w-5 h-5 text-yellow-600 animate-pulse" />;
      case "BLOCKED":
      case "FAILED":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case "TODO":
        return <Clock className="w-5 h-5 text-gray-400" />;
      default:
        return null;
    }
  };

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-900";
      case "in_progress":
        return "bg-blue-100 text-blue-900";
      case "failed":
        return "bg-red-100 text-red-900";
      case "paused":
        return "bg-gray-100 text-gray-900";
      default:
        return "bg-gray-100 text-gray-900";
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

  const stats = selectedProject && Array.isArray(selectedProject.tasks) && selectedProject.tasks.length > 0 ? calculateStats(selectedProject.tasks) : null;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b-2 border-black sticky top-0 bg-white z-50">
        <div className="container flex items-center justify-between py-6">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-3 hover:opacity-75 transition-opacity"
          >
            <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold">AGENT HUB</span>
          </button>
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold">
            <a href="#" className="hover:text-red-500 transition-colors">
              DASHBOARD
            </a>
            <a href="#" className="hover:text-red-500 transition-colors">
              PROJECTS
            </a>
            <a href="#" className="hover:text-red-500 transition-colors">
              SETTINGS
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-12">
        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 bg-red-100 border-2 border-red-600 rounded-lg">
            <p className="font-bold text-red-900">Error: {error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && !selectedProject ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="ml-2 font-bold">Loading projects...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <h2 className="text-3xl font-bold mb-4">No Projects Yet</h2>
            <p className="text-gray-600 mb-8">Create a new project to get started</p>
            <button
              onClick={() => setLocation("/")}
              className="bold-card border-2 border-black hover:bg-gray-50 inline-flex items-center gap-2 px-8 py-4 font-bold"
            >
              <Plus className="w-5 h-5" />
              Create Project
            </button>
          </div>
        ) : (
          <>
            {/* Title */}
            <div className="mb-12">
              <h1 className="text-6xl md:text-7xl font-bold mb-4">WORKSPACE</h1>
              <div className="h-1 w-20 bg-red-500 rounded-full"></div>
            </div>

            {/* Project Selector */}
            <div className="mb-12">
              <h3 className="text-sm font-bold text-gray-600 mb-3">SELECT PROJECT</h3>
              <div className="flex gap-3 overflow-x-auto pb-4">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project.id)}
                    className={`flex-shrink-0 px-6 py-3 border-2 font-bold rounded-lg transition-all ${
                      selectedProject?.id === project.id
                        ? "bg-black text-white border-black"
                        : "bg-white border-gray-300 hover:border-black"
                    }`}
                  >
                    <div className="text-left">
                      <p className="text-sm">{project.name.substring(0, 30)}</p>
                      <p className={`text-xs ${selectedProject?.id === project.id ? "text-gray-300" : "text-gray-500"}`}>
                        {project._count.tasks} tasks
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {selectedProject && (
              <>
                {/* Project Header */}
                <div className="mb-12 bold-card">
                  <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                    <div>
                      <h2 className="text-3xl font-bold mb-2">{selectedProject.name}</h2>
                      <p className="text-gray-600 text-sm">{selectedProject.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(selectedProject.status === "in_progress" || selectedProject.status === "paused") && (
                        <>
                          {selectedProject.status === "in_progress" ? (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`${API_URL}/api/projects/${selectedProject.id}/pause`, { method: "POST" });
                                  if (res.ok) {
                                    setSelectedProject((p) => (p ? { ...p, status: "paused" as const } : p));
                                    toast.success("Project paused");
                                  } else toast.error("Failed to pause");
                                } catch {
                                  toast.error("Failed to pause");
                                }
                              }}
                              className="flex items-center gap-2 px-4 py-2 border-2 border-amber-600 text-amber-700 font-bold rounded-lg hover:bg-amber-50 transition-colors"
                            >
                              <Pause className="w-4 h-4" />
                              Pause
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`${API_URL}/api/projects/${selectedProject.id}/resume`, { method: "POST" });
                                  if (res.ok) {
                                    setSelectedProject((p) => (p ? { ...p, status: "in_progress" as const } : p));
                                    toast.success("Project resumed");
                                  } else toast.error("Failed to resume");
                                } catch {
                                  toast.error("Failed to resume");
                                }
                              }}
                              className="flex items-center gap-2 px-4 py-2 border-2 border-green-600 text-green-700 font-bold rounded-lg hover:bg-green-50 transition-colors"
                            >
                              <Play className="w-4 h-4" />
                              Resume
                            </button>
                          )}
                        </>
                      )}
                      <Badge className={`${getProjectStatusColor(selectedProject.status)} font-bold whitespace-nowrap`}>
                        {selectedProject.status.replace("_", " ").toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Preview Button */}
                {selectedProject.tasks && selectedProject.tasks.some((task) => task.generatedCode) && (
                  <div className="mb-12">
                    <button
                      onClick={() => {
                        const taskWithCode = selectedProject.tasks.find((task) => task.generatedCode);
                        if (taskWithCode) {
                          window.open(
                            `${API_URL}/api/projects/${selectedProject.id}/tasks/${taskWithCode.id}/preview`,
                            "_blank"
                          );
                        }
                      }}
                      className="w-full bold-card border-2 border-black hover:bg-black hover:text-white transition-colors py-8 px-8 flex items-center justify-center gap-4 group"
                    >
                      <ExternalLink className="w-8 h-8" />
                      <div className="text-left">
                        <p className="text-3xl font-bold">PREVIEW</p>
                        <p className="text-sm text-gray-600 group-hover:text-gray-300">View generated code in full screen</p>
                      </div>
                    </button>
                  </div>
                )}

                {/* Stats Grid */}
                {stats && (
                  <div className="grid md:grid-cols-4 gap-6 mb-12">
                    <div className="bold-card">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-xs font-bold text-gray-600 mb-2">TOTAL TASKS</p>
                          <p className="text-5xl font-bold">{stats.total}</p>
                        </div>
                        <Cpu className="w-8 h-8" />
                      </div>
                    </div>

                    <div className="bold-card">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-xs font-bold text-gray-600 mb-2">COMPLETED</p>
                          <p className="text-5xl font-bold">{stats.completed}</p>
                        </div>
                        <CheckCircle2 className="w-8 h-8 text-green-600" />
                      </div>
                    </div>

                    <div className="bold-card">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-xs font-bold text-gray-600 mb-2">IN PROGRESS</p>
                          <p className="text-5xl font-bold">{stats.inProgress}</p>
                        </div>
                        <Activity className="w-8 h-8 text-yellow-600" />
                      </div>
                    </div>

                    <div className="bold-card">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-xs font-bold text-gray-600 mb-2">EFFICIENCY</p>
                          <p className="text-5xl font-bold">{stats.efficiency}%</p>
                        </div>
                        <TrendingUp className="w-8 h-8" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Tasks Section */}
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-5xl font-bold">TASKS</h2>
                    <button
                      onClick={() => setIsCreateTaskModalOpen(true)}
                      className="bold-card border-2 border-black hover:bg-gray-50 flex items-center gap-2 px-6 py-3 font-bold transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      Create Task
                    </button>
                  </div>

                  {(!selectedProject.tasks || selectedProject.tasks.length === 0) ? (
                    <div className="bold-card text-center py-12">
                      <p className="text-gray-600 font-medium">No tasks yet</p>
                    </div>
                  ) : (
                    <div className="bold-card">
                      <Tabs defaultValue="all" className="w-full">
                        <TabsList className="grid w-full grid-cols-5 bg-gray-100 rounded-lg p-1 mb-8 border-2 border-black">
                          <TabsTrigger value="all" className="rounded-md data-[state=active]:bg-black data-[state=active]:text-white font-bold text-xs">
                            ALL ({selectedProject.tasks?.length || 0})
                          </TabsTrigger>
                          <TabsTrigger value="TODO" className="rounded-md data-[state=active]:bg-black data-[state=active]:text-white font-bold text-xs">
                            TODO ({selectedProject.tasks?.filter((t) => t.status === "TODO").length || 0})
                          </TabsTrigger>
                          <TabsTrigger value="IN_PROGRESS" className="rounded-md data-[state=active]:bg-black data-[state=active]:text-white font-bold text-xs">
                            IN PROGRESS ({selectedProject.tasks?.filter((t) => t.status === "IN_PROGRESS").length || 0})
                          </TabsTrigger>
                          <TabsTrigger value="COMPLETE" className="rounded-md data-[state=active]:bg-black data-[state=active]:text-white font-bold text-xs">
                            COMPLETE ({selectedProject.tasks?.filter((t) => t.status === "COMPLETE").length || 0})
                          </TabsTrigger>
                          <TabsTrigger value="BLOCKED" className="rounded-md data-[state=active]:bg-black data-[state=active]:text-white font-bold text-xs">
                            BLOCKED ({selectedProject.tasks?.filter((t) => t.status === "BLOCKED" || t.status === "FAILED").length || 0})
                          </TabsTrigger>
                        </TabsList>

                        <TabsContent value="all" className="space-y-3">
                          {selectedProject.tasks?.map((task) => (
                            <div
                              key={task.id}
                              onClick={() => handleTaskClick(task)}
                              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer border-2 border-gray-200 hover:border-black"
                            >
                              <div className="flex items-center gap-4 flex-1 min-w-0">
                                {getTaskStatusIcon(task.status)}
                                <div className="min-w-0 flex-1">
                                  <p className="font-bold text-sm">{task.taskId}: {task.description}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className={`text-xs ${getTaskStatusColor(task.status)}`}>
                                      {task.status}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs bg-gray-100">
                                      {task.priority}
                                    </Badge>
                                    {task.estimatedHours && <span className="text-xs text-gray-600">{task.estimatedHours}h</span>}
                                  </div>
                                </div>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-400" />
                            </div>
                          ))}
                        </TabsContent>

                        {["TODO", "IN_PROGRESS", "COMPLETE", "BLOCKED"].map((status) => (
                          <TabsContent key={status} value={status} className="space-y-3">
                            {(selectedProject.tasks || [])
                              .filter((task) => status === "BLOCKED" ? task.status === "BLOCKED" || task.status === "FAILED" : task.status === status)
                              .map((task) => (
                                <div
                                  key={task.id}
                                  onClick={() => handleTaskClick(task)}
                                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer border-2 border-gray-200 hover:border-black"
                                >
                                  <div className="flex items-center gap-4 flex-1 min-w-0">
                                    {getTaskStatusIcon(task.status)}
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold text-sm">{task.taskId}: {task.description}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className={`text-xs ${getTaskStatusColor(task.status)}`}>
                                          {task.status}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs bg-gray-100">
                                          {task.priority}
                                        </Badge>
                                        {task.estimatedHours && <span className="text-xs text-gray-600">{task.estimatedHours}h</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <ChevronRight className="w-5 h-5 text-gray-400" />
                                </div>
                              ))}
                          </TabsContent>
                        ))}
                      </Tabs>
                    </div>
                  )}
                </div>

                {/* Agent Communication Feed */}
                <div className="mt-12">
                  <h2 className="text-5xl font-bold mb-8">AGENT COMMUNICATION</h2>
                  <div className="bold-card">
                    <LiveActivityFeed projectId={selectedProject.id} />
                  </div>
                </div>

                {/* Research Analysis */}
                {selectedProject.researchOutput && (
                  <div className="mt-12">
                    <h2 className="text-5xl font-bold mb-8">RESEARCH ANALYSIS</h2>
                    <div className="bold-card p-8">
                      <ResearchPanel research={JSON.parse(selectedProject.researchOutput)} />
                    </div>
                  </div>
                )}

                {/* QA Report */}
                {selectedProject.qaReport && (
                  <div className="mt-12">
                    <h2 className="text-5xl font-bold mb-8">QA VALIDATION</h2>
                    <div className="bold-card p-8">
                      <QAReportPanel report={JSON.parse(selectedProject.qaReport)} />
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Task Detail Modal */}
      {isTaskModalOpen && selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
        />
      )}

      {/* Create Task Modal */}
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
