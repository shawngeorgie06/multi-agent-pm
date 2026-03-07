import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Activity, AlertCircle, Clock, X, Code2, Zap } from "lucide-react";
import { useState } from "react";
import { PreviewModal } from "./PreviewModal";
import type { Task } from "@/hooks/useProjects";

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TaskDetailModal({ task, isOpen, onClose }: TaskDetailModalProps) {
  const [showPreview, setShowPreview] = useState(false);

  if (!task) return null;

  const getStatusIcon = (status: string) => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETE":
        return "bg-green-100 text-green-900 border-2 border-green-900";
      case "IN_PROGRESS":
        return "bg-yellow-100 text-yellow-900 border-2 border-yellow-900";
      case "BLOCKED":
      case "FAILED":
        return "bg-red-100 text-red-900 border-2 border-red-900";
      case "TODO":
        return "bg-gray-100 text-gray-900 border-2 border-gray-900";
      default:
        return "bg-gray-100 text-gray-900 border-2 border-gray-900";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return "bg-red-100 text-red-900";
      case "MEDIUM":
        return "bg-yellow-100 text-yellow-900";
      case "LOW":
        return "bg-green-100 text-green-900";
      default:
        return "bg-gray-100 text-gray-900";
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white border-2 border-black max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              {getStatusIcon(task.status)}
              <div>
                <DialogTitle className="text-2xl font-bold">{task.taskId}</DialogTitle>
                <DialogDescription className="text-gray-600 mt-1 font-medium">
                  {task.description}
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-black transition-colors flex-shrink-0"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </DialogHeader>

        {/* No tabs needed - only showing DETAILS */}

        {/* Content - Details Only */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 py-6 px-6 border-t-2 border-black">
          {/* Status and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">STATUS</p>
              <Badge className={`${getStatusColor(task.status)} font-bold`}>
                {task.status}
              </Badge>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">PRIORITY</p>
              <Badge className={`${getPriorityColor(task.priority)} font-bold`}>
                {task.priority}
              </Badge>
            </div>
          </div>

          {/* Estimated and Actual Hours */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
            <div>
              <p className="text-xs font-bold text-gray-600 mb-1">ESTIMATED HOURS</p>
              <p className="text-lg font-bold">
                {task.estimatedHours ? `${task.estimatedHours}h` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-600 mb-1">ACTUAL HOURS</p>
              <p className="text-lg font-bold">
                {task.actualHours ? `${task.actualHours}h` : "—"}
              </p>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-gray-600 mb-1">CREATED</p>
              <p className="text-sm font-medium">{formatDate(task.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-600 mb-1">UPDATED</p>
              <p className="text-sm font-medium">{formatDate(task.updatedAt)}</p>
            </div>
          </div>

          {/* Dependencies */}
          {task.dependencies && task.dependencies.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">DEPENDENCIES</p>
              <div className="flex flex-wrap gap-2">
                {task.dependencies.map((dep) => (
                  <Badge key={dep} variant="outline" className="border-2 border-black">
                    {dep}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Blocker Message */}
          {task.blockerMessage && (
            <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
              <p className="text-xs font-bold text-red-900 mb-1">BLOCKER</p>
              <p className="text-sm text-red-900">{task.blockerMessage}</p>
            </div>
          )}

          {/* Generated Code */}
          {task.generatedCode && (
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-2">
                <Code2 className="w-4 h-4" />
                GENERATED CODE
              </p>
              <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto border-2 border-black">
                <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                  {task.generatedCode.substring(0, 500)}
                  {task.generatedCode.length > 500 && "..."}
                </pre>
              </div>
            </div>
          )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t-2 border-black">
                {task.generatedCode && (
                  <Button
                    onClick={() => setShowPreview(true)}
                    className="flex-1 bg-black text-white font-bold hover:bg-gray-900"
                  >
                    Open Preview
                  </Button>
                )}
                {task.status === "TODO" && (
                  <Button className="flex-1 bg-black text-white font-bold hover:bg-gray-900">
                    Start Task
                  </Button>
                )}
              </div>
            </div>
        </div>

        {/* Preview Modal */}
        {task.generatedCode && (
          <PreviewModal
            isOpen={showPreview}
            onClose={() => setShowPreview(false)}
            code={task.generatedCode}
            taskId={task.taskId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
