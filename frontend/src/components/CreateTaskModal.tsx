import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { API_URL } from "@/lib/api";

interface CreateTaskModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated: (newProjectId: string) => void;
}

export function CreateTaskModal({ projectId, isOpen, onClose, onTaskCreated }: CreateTaskModalProps) {
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!description.trim()) {
      setError("Description is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create a NEW PROJECT with this task description
      // This will trigger Ollama planning and agent communication
      const projectResponse = await fetch(`${API_URL}/api/projects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: description.trim().substring(0, 50) || "New Project",
          description: description.trim(),
        }),
      });

      if (!projectResponse.ok) {
        throw new Error("Failed to create project");
      }

      const projectData = await projectResponse.json();

      // Reset form
      setDescription("");
      setPriority("MEDIUM");
      setEstimatedHours("");

      // Close modal and refresh
      onClose();
      onTaskCreated(projectData.projectId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create project";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white border-2 border-black max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold">Create New Project</DialogTitle>
              <p className="text-xs text-gray-600 mt-1 font-medium">Each task creates a new project with AI planning</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-black transition-colors flex-shrink-0"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-6 border-t-2 border-black">
          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border-2 border-red-300 rounded-lg">
              <p className="text-sm text-red-900 font-medium">{error}</p>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-gray-600 mb-2 block">
              PROJECT DESCRIPTION *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Build an expense tracker, Create a todo app, Build a weather dashboard, etc."
              className="w-full p-3 border-2 border-gray-300 rounded-lg focus:border-black focus:outline-none font-medium resize-none"
              rows={4}
            />
          </div>


          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t-2 border-black">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1 border-2 border-gray-300 font-bold hover:bg-gray-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-black text-white font-bold hover:bg-gray-900 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Project...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
