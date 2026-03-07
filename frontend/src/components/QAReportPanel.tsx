import { CheckCircle2, AlertCircle, AlertTriangle, XCircle, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface QAReport {
  status: 'PASS' | 'FAIL' | 'WARNING';
  summary: string;
  functionalTests: {
    test: string;
    status: 'PASS' | 'FAIL';
    issue?: string | any;
  }[];
  securityChecks: {
    check: string;
    status: 'PASS' | 'FAIL' | 'WARNING';
    severity?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    details?: string | any;
  }[];
  performanceIssues: (string | any)[];
  recommendations: (string | any)[];
  reviewedAt: string;
}

interface QAReportPanelProps {
  report: QAReport | null;
}

// Helper function to safely convert anything to string
const toString = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export function QAReportPanel({ report }: QAReportPanelProps) {
  if (!report) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No QA report available</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PASS":
        return "bg-green-500/20 text-green-300 border-green-500/50";
      case "FAIL":
        return "bg-red-500/20 text-red-300 border-red-500/50";
      case "WARNING":
        return "bg-amber-500/20 text-amber-300 border-amber-500/50";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/50";
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      case "HIGH":
        return "bg-orange-500/20 text-orange-300 border-orange-500/30";
      case "MEDIUM":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "LOW":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };

  const getTestIcon = (status: string) => {
    switch (status) {
      case "PASS":
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case "FAIL":
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return null;
    }
  };

  const passCount = report.functionalTests.filter((t) => t.status === 'PASS').length;
  const failCount = report.functionalTests.filter((t) => t.status === 'FAIL').length;
  const passRate = report.functionalTests.length > 0 ? Math.round((passCount / report.functionalTests.length) * 100) : 0;

  const securityPassCount = report.securityChecks.filter((c) => c.status === 'PASS').length;
  const securityIssueCount = report.securityChecks.filter((c) => c.status === 'FAIL').length;
  const securityWarningCount = report.securityChecks.filter((c) => c.status === 'WARNING').length;

  return (
    <div className="space-y-8">
      {/* Overall Status */}
      <Card className="bg-card/60 border-border/50 p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-mono font-bold text-lg">QA VALIDATION RESULT</h3>
          <Badge className={`${getStatusColor(report.status)} border text-base py-2 px-4`}>
            {report.status}
          </Badge>
        </div>
        <p className="text-foreground">{toString(report.summary)}</p>
        <p className="text-xs text-muted-foreground mt-4">Reviewed: {new Date(report.reviewedAt).toLocaleString()}</p>
      </Card>

      {/* Functional Tests Summary */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-mono font-bold text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            FUNCTIONAL TESTS
          </h3>
          <div className="text-sm font-mono">
            <span className="text-green-400">{passCount} passed</span>
            {failCount > 0 && <span className="text-red-400 ml-2">{failCount} failed</span>}
          </div>
        </div>

        {/* Test Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Pass Rate</span>
            <span className="font-mono font-bold text-cyan-400">{passRate}%</span>
          </div>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-cyan-400"
              style={{ width: `${passRate}%` }}
            ></div>
          </div>
        </div>

        {/* Individual Tests */}
        <div className="space-y-2">
          {report.functionalTests.map((test, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card/40">
              <div className="mt-0.5 flex-shrink-0">{getTestIcon(test.status)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-mono font-bold text-sm">{toString(test.test)}</p>
                {test.issue && (
                  <p className="text-xs text-red-300 mt-1">{toString(test.issue)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security Checks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-mono font-bold text-sm text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            SECURITY CHECKS
          </h3>
          <div className="text-sm font-mono">
            <span className="text-green-400">{securityPassCount} passed</span>
            {securityIssueCount > 0 && <span className="text-red-400 ml-2">{securityIssueCount} failed</span>}
            {securityWarningCount > 0 && <span className="text-amber-400 ml-2">{securityWarningCount} warnings</span>}
          </div>
        </div>

        <div className="space-y-2">
          {report.securityChecks.map((check, i) => (
            <div
              key={i}
              className={`p-4 rounded-lg border ${
                check.status === 'PASS'
                  ? 'border-green-500/30 bg-green-500/10'
                  : check.status === 'FAIL'
                    ? 'border-red-500/30 bg-red-500/10'
                    : 'border-amber-500/30 bg-amber-500/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-mono font-bold text-sm">{toString(check.check)}</p>
                    {check.severity && (
                      <Badge className={`${getSeverityColor(check.severity)} border text-xs py-0 px-2`}>
                        {check.severity}
                      </Badge>
                    )}
                  </div>
                  {check.details && (
                    <p className="text-xs text-muted-foreground">{toString(check.details)}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Issues */}
      {report.performanceIssues && report.performanceIssues.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-mono font-bold text-sm text-muted-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            PERFORMANCE ISSUES
          </h3>
          <ul className="space-y-2">
            {report.performanceIssues.map((issue, i) => (
              <li key={i} className="flex gap-3 p-3 rounded-lg border border-border/50 bg-card/40">
                <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{toString(issue)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations && report.recommendations.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-mono font-bold text-sm text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            RECOMMENDATIONS
          </h3>
          <ul className="space-y-2">
            {report.recommendations.map((rec, i) => (
              <li key={i} className="flex gap-3 p-3 rounded-lg border border-border/50 bg-card/40">
                <TrendingUp className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-foreground">{toString(rec)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
