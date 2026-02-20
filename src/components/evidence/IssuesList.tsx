import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { AlertTriangle, AlertCircle, Info, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdmissibilityIssue } from "@/lib/evidence-api";

interface IssuesListProps {
  issues: AdmissibilityIssue[];
}

export function IssuesList({ issues }: IssuesListProps) {
  if (issues.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Admissibility Issues
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No admissibility issues identified
          </div>
        </CardContent>
      </Card>
    );
  }

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case 'fatal':
        return {
          icon: XCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          label: 'Fatal',
        };
      case 'serious':
        return {
          icon: AlertTriangle,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
          label: 'Serious',
        };
      case 'minor':
        return {
          icon: Info,
          color: 'text-blue-500',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30',
          label: 'Minor',
        };
      default:
        return {
          icon: Info,
          color: 'text-gray-500',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/30',
          label: severity,
        };
    }
  };

  const XCircle = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Admissibility Issues
          <Badge variant="secondary" className="ml-2">{issues.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Accordion type="multiple" className="w-full">
          {issues.map((issue, index) => {
            const config = getSeverityConfig(issue.severity);
            const Icon = config.icon;
            return (
              <AccordionItem key={index} value={`issue-${index}`} className="px-6">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left">
                    <Badge
                      variant="outline"
                      className={cn("gap-1", config.color, config.borderColor)}
                    >
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                    <span className="font-medium capitalize">{issue.type}</span>
                    <Badge variant="outline" className="gap-1 text-xs">
                      <BookOpen className="h-3 w-3" />
                      {issue.rule}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pb-4">
                    <div>
                      <h4 className="text-sm font-semibold mb-1">Explanation</h4>
                      <p className="text-sm text-muted-foreground">{issue.explanation}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold mb-1 text-green-600 dark:text-green-400">Potential Cure</h4>
                      <p className="text-sm text-muted-foreground">{issue.potentialCure}</p>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
