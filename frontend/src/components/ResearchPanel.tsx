import { Code2, Database, Zap, CheckCircle2, AlertCircle, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface ResearchOutput {
  projectType: 'web' | 'fullstack' | 'api' | 'mobile';
  techStack: {
    frontend?: string[];
    backend?: string[];
    database?: string[];
    testing?: string[];
  };
  architecturePatterns: string[];
  requirements: {
    functional: string[];
    nonFunctional: string[];
  };
  successCriteria: string[];
  summary?: string;
}

interface ResearchPanelProps {
  research: ResearchOutput | null;
}

export function ResearchPanel({ research }: ResearchPanelProps) {
  if (!research) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No research data available</p>
      </div>
    );
  }

  const getProjectTypeColor = (type: string) => {
    switch (type) {
      case "web":
        return "bg-blue-500/20 text-blue-300 border-blue-500/50";
      case "fullstack":
        return "bg-purple-500/20 text-purple-300 border-purple-500/50";
      case "api":
        return "bg-green-500/20 text-green-300 border-green-500/50";
      case "mobile":
        return "bg-orange-500/20 text-orange-300 border-orange-500/50";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/50";
    }
  };

  return (
    <div className="space-y-8">
      {/* Summary */}
      {research.summary && (
        <Card className="bg-card/60 border-border/50 p-6">
          <p className="text-foreground">{research.summary}</p>
        </Card>
      )}

      {/* Project Type */}
      <div className="space-y-3">
        <h3 className="font-mono font-bold text-sm text-muted-foreground flex items-center gap-2">
          <Package className="w-4 h-4" />
          PROJECT TYPE
        </h3>
        <Badge className={`${getProjectTypeColor(research.projectType)} border text-base py-2 px-4`}>
          {research.projectType.toUpperCase()}
        </Badge>
      </div>

      {/* Tech Stack */}
      <div className="space-y-4">
        <h3 className="font-mono font-bold text-sm text-muted-foreground flex items-center gap-2">
          <Code2 className="w-4 h-4" />
          TECH STACK
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {research.techStack.frontend && research.techStack.frontend.length > 0 && (
            <Card className="bg-card/60 border-border/50 p-4">
              <h4 className="text-xs text-muted-foreground font-mono mb-3">FRONTEND</h4>
              <div className="flex flex-wrap gap-2">
                {research.techStack.frontend.map((tech, i) => (
                  <Badge key={i} variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                    {tech}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
          {research.techStack.backend && research.techStack.backend.length > 0 && (
            <Card className="bg-card/60 border-border/50 p-4">
              <h4 className="text-xs text-muted-foreground font-mono mb-3">BACKEND</h4>
              <div className="flex flex-wrap gap-2">
                {research.techStack.backend.map((tech, i) => (
                  <Badge key={i} variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">
                    {tech}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
          {research.techStack.database && research.techStack.database.length > 0 && (
            <Card className="bg-card/60 border-border/50 p-4">
              <h4 className="text-xs text-muted-foreground font-mono mb-3">
                <Database className="w-3 h-3 inline mr-1" />
                DATABASE
              </h4>
              <div className="flex flex-wrap gap-2">
                {research.techStack.database.map((tech, i) => (
                  <Badge key={i} variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                    {tech}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
          {research.techStack.testing && research.techStack.testing.length > 0 && (
            <Card className="bg-card/60 border-border/50 p-4">
              <h4 className="text-xs text-muted-foreground font-mono mb-3">TESTING</h4>
              <div className="flex flex-wrap gap-2">
                {research.techStack.testing.map((tech, i) => (
                  <Badge key={i} variant="secondary" className="bg-orange-500/20 text-orange-300 border-orange-500/30">
                    {tech}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Architecture Patterns */}
      {research.architecturePatterns && research.architecturePatterns.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-mono font-bold text-sm text-muted-foreground flex items-center gap-2">
            <Zap className="w-4 h-4" />
            ARCHITECTURE PATTERNS
          </h3>
          <div className="flex flex-wrap gap-2">
            {research.architecturePatterns.map((pattern, i) => (
              <Badge key={i} className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 border">
                {pattern}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Functional Requirements */}
      {research.requirements.functional && research.requirements.functional.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-mono font-bold text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            FUNCTIONAL REQUIREMENTS
          </h3>
          <ul className="space-y-2">
            {research.requirements.functional.map((req, i) => (
              <li key={i} className="flex gap-3 p-3 rounded-lg border border-border/50 bg-card/40">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Non-Functional Requirements */}
      {research.requirements.nonFunctional && research.requirements.nonFunctional.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-mono font-bold text-sm text-muted-foreground flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            NON-FUNCTIONAL REQUIREMENTS
          </h3>
          <ul className="space-y-2">
            {research.requirements.nonFunctional.map((req, i) => (
              <li key={i} className="flex gap-3 p-3 rounded-lg border border-border/50 bg-card/40">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{req}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Success Criteria */}
      {research.successCriteria && research.successCriteria.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-mono font-bold text-sm text-muted-foreground flex items-center gap-2">
            <Zap className="w-4 h-4" />
            SUCCESS CRITERIA
          </h3>
          <ul className="space-y-2">
            {research.successCriteria.map((criteria, i) => (
              <li key={i} className="flex gap-3 p-3 rounded-lg border border-border/50 bg-card/40">
                <Zap className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{criteria}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
