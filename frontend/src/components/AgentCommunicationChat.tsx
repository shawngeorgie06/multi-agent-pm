import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";

interface Message {
  id: string;
  agent: string;
  agentColor: string;
  message: string;
  timestamp: string;
  type: "action" | "decision" | "result" | "error";
}

interface AgentCommunicationChatProps {
  taskId: string;
  taskStatus: "completed" | "in-progress" | "pending";
}

// Mock messages that simulate real agent communication
const generateMockMessages = (taskId: string): Message[] => {
  return [
    {
      id: "1",
      agent: "Data Analyst",
      agentColor: "bg-blue-500",
      message: "Starting task analysis. Initializing data processing pipeline.",
      timestamp: "12:34:05",
      type: "action",
    },
    {
      id: "2",
      agent: "Code Writer",
      agentColor: "bg-purple-500",
      message: "Standing by. Ready to generate code based on analysis results.",
      timestamp: "12:34:08",
      type: "decision",
    },
    {
      id: "3",
      agent: "Data Analyst",
      agentColor: "bg-blue-500",
      message: "Data loaded successfully. 50,000 records processed. Pattern recognition in progress.",
      timestamp: "12:34:15",
      type: "result",
    },
    {
      id: "4",
      agent: "Web Crawler",
      agentColor: "bg-yellow-500",
      message: "Crawling competitor data for market comparison. 234 sources identified.",
      timestamp: "12:34:22",
      type: "action",
    },
    {
      id: "5",
      agent: "Data Analyst",
      agentColor: "bg-blue-500",
      message: "Trend analysis complete. 3 major market opportunities identified. Sending results to Code Writer.",
      timestamp: "12:34:35",
      type: "result",
    },
    {
      id: "6",
      agent: "Code Writer",
      agentColor: "bg-purple-500",
      message: "Received analysis. Generating API endpoint for opportunity tracking. 85% complete.",
      timestamp: "12:34:42",
      type: "action",
    },
    {
      id: "7",
      agent: "Content Creator",
      agentColor: "bg-green-500",
      message: "Preparing market report documentation based on findings.",
      timestamp: "12:34:50",
      type: "action",
    },
    {
      id: "8",
      agent: "Code Writer",
      agentColor: "bg-purple-500",
      message: "API generation complete. Unit tests passing (98% coverage). Ready for deployment.",
      timestamp: "12:35:02",
      type: "result",
    },
    {
      id: "9",
      agent: "Content Creator",
      agentColor: "bg-green-500",
      message: "Documentation complete. Executive summary generated with key metrics and recommendations.",
      timestamp: "12:35:10",
      type: "result",
    },
    {
      id: "10",
      agent: "Data Analyst",
      agentColor: "bg-blue-500",
      message: "Task execution complete. All deliverables ready. Efficiency score: 94%.",
      timestamp: "12:35:15",
      type: "result",
    },
  ];
};

export function AgentCommunicationChat({ taskId, taskStatus }: AgentCommunicationChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [displayedMessages, setDisplayedMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const allMessages = generateMockMessages(taskId);
    setMessages(allMessages);

    // Simulate real-time message streaming
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < allMessages.length) {
        setDisplayedMessages((prev) => [...prev, allMessages[currentIndex]]);
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 800);

    return () => clearInterval(interval);
  }, [taskId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayedMessages]);

  const getMessageTypeColor = (type: string | undefined) => {
    if (!type) return "border-l-4 border-gray-400 bg-gray-500/10";
    switch (type) {
      case "action":
        return "border-l-4 border-cyan-400 bg-cyan-500/10";
      case "decision":
        return "border-l-4 border-purple-400 bg-purple-500/10";
      case "result":
        return "border-l-4 border-green-400 bg-green-500/10";
      case "error":
        return "border-l-4 border-red-400 bg-red-500/10";
      default:
        return "border-l-4 border-gray-400 bg-gray-500/10";
    }
  };

  const getTypeLabel = (type: string | undefined) => {
    if (!type) return "UNKNOWN";
    return type.toUpperCase();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-5 h-5 text-cyan-400" />
        <h3 className="text-sm font-mono font-bold text-foreground">AGENT COMMUNICATION</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {displayedMessages.length} / {messages.length} messages
        </span>
      </div>

      {/* Messages Container */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
        {displayedMessages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Waiting for agent communication...</p>
          </div>
        ) : (
          displayedMessages.map((msg) => {
            if (!msg) return null;
            return (
            <div
              key={msg.id}
              className={`p-3 rounded-lg text-sm space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-300 ${getMessageTypeColor(
                msg.type
              )}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${msg.agentColor}`}></div>
                  <span className="font-mono font-bold text-foreground text-xs">{msg.agent}</span>
                </div>
                <span className="text-xs text-muted-foreground">{msg.timestamp}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs font-bold text-muted-foreground px-1.5 py-0.5 bg-background/50 rounded">
                  {getTypeLabel(msg.type)}
                </span>
              </div>
              <p className="text-xs text-foreground leading-relaxed">{msg.message}</p>
            </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Status Indicator */}
      {taskStatus === "in-progress" && displayedMessages.length < messages.length && (
        <div className="flex items-center gap-2 text-xs text-cyan-400">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
          <span>Agents communicating...</span>
        </div>
      )}

      {taskStatus === "completed" && (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <div className="w-2 h-2 bg-green-400 rounded-full"></div>
          <span>Task completed. All communication archived.</span>
        </div>
      )}
    </div>
  );
}
