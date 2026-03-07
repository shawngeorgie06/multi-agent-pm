import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X } from "lucide-react";

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  taskId: string;
}

export function PreviewModal({ isOpen, onClose, code, taskId }: PreviewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white border-2 border-black max-w-6xl max-h-[95vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="border-b-2 border-black px-6 py-4 flex flex-row items-center justify-between">
          <DialogTitle className="text-2xl font-bold">{taskId} - PREVIEW</DialogTitle>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {code ? (
            <iframe
              srcDoc={code}
              className="w-full h-full border-none"
              title={`Preview of ${taskId}`}
              sandbox="allow-scripts allow-same-origin"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No code generated yet
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
