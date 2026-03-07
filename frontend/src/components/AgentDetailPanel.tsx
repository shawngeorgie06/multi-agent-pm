import { X, TrendingUp, Zap, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AgentTask {
  id: string;
  title: string;
  status: "completed" | "in-progress" | "pending";
  completedAt?: string;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  status: "active" | "idle" | "working";
  efficiency: number;
  tasksCompleted: number;
  color: string;
}

interface AgentDetailPanelProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
}

const mockAgentTasks: AgentTask[] = [
  { id: "1", title: "Analyze Q1 Market Trends", status: "completed", completedAt: "2 min ago" },
  { id: "2", title: "Generate Quarterly Report", status: "completed", completedAt: "15 min ago" },
  { id: "3", title: "Process Customer Feedback", status: "in-progress" },
  { id: "4", title: "Predict Market Movements", status: "pending" },
  { id: "5", title: "Compile Industry Analysis", status: "completed", completedAt: "1 hour ago" },
];

const performanceMetrics = [
  { label: "Avg Task Time", value: "12m 34s", icon: Clock },
  { label: "Success Rate", value: "98.5%", icon: CheckCircle2 },
  { label: "Active Tasks", value: "3", icon: Zap },
  { label: "Errors", value: "0", icon: AlertCircle },
];

export function AgentDetailPanel({ agent, isOpen, onClose }: AgentDetailPanelProps) {
  if (!agent) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/20 text-green-300 border-green-500/50";
      case "working":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/50";
      case "idle":
        return "bg-gray-500/20 text-gray-300 border-gray-500/50";
      default:
        return "";
    }
  };

  const getTaskStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case "in-progress":
        return <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />;
      case "pending":
        return <Clock className="w-4 h-4 text-gray-400" />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Side Panel */}
      <div
        className={`fixed right-0 top-0 h-screen w-full md:w-96 bg-card/95 backdrop-blur-sm border-l border-border/50 shadow-2xl transform transition-transform duration-300 z-50 overflow-y-auto ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="sticky top-0 border-b border-border/50 bg-card/95 backdrop-blur-sm p-6 flex items-center justify-between">
          <h2 className="font-mono font-bold text-lg">AGENT PROFILE</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Agent Header */}
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-mono font-bold text-xl mb-1">{agent.name}</h3>
                <p className="text-sm text-muted-foreground">{agent.role}</p>
              </div>
              <Badge className={`${getStatusColor(agent.status)} border`}>
                {agent.status.toUpperCase()}
              </Badge>
            </div>

            {/* Agent Avatar */}
            <div className={`w-16 h-16 rounded-lg bg-gradient-to-br ${agent.color} opacity-20 border border-current`}></div>
          </div>

          {/* Key Metrics */}
          <div className="space-y-3">
            <h4 className="font-mono font-bold text-sm text-muted-foreground">KEY METRICS</h4>
            <div className="grid grid-cols-2 gap-3">
              {performanceMetrics.map((metric, i) => (
                <Card key={i} className="border-glow bg-border/30 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <metric.icon className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs text-muted-foreground">{metric.label}</span>
                  </div>
                  <p className="font-mono font-bold text-sm text-cyan-400">{metric.value}</p>
                </Card>
              ))}
            </div>
          </div>

          {/* Efficiency Overview */}
          <div className="space-y-3">
            <h4 className="font-mono font-bold text-sm text-muted-foreground">EFFICIENCY RATING</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono">Overall Score</span>
                <span className="text-lg font-mono font-bold text-cyan-400">{agent.efficiency}%</span>
              </div>
              <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-purple-400"
                  style={{ width: `${agent.efficiency}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Tasks Completed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-mono font-bold text-sm text-muted-foreground">TASKS COMPLETED</h4>
              <span className="text-lg font-mono font-bold text-green-400">{agent.tasksCompleted}</span>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-300">↑ 12% increase from last week</span>
            </div>
          </div>

          {/* Task History */}
          <div className="space-y-3">
            <h4 className="font-mono font-bold text-sm text-muted-foreground">RECENT TASKS</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {mockAgentTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:border-cyan-400/30 transition-colors"
                >
                  <div className="mt-1">{getTaskStatusIcon(task.status)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-mono font-bold text-sm truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.status === "completed"
                        ? `Completed ${task.completedAt}`
                        : task.status === "in-progress"
                          ? "In Progress"
                          : "Pending"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-4 border-t border-border/50">
            <Button className="w-full bg-cyan-400 text-background hover:bg-cyan-300 font-mono">
              Configure Agent
            </Button>
            <Button
              variant="outline"
              className="w-full border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
            >
              View Full Report
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
