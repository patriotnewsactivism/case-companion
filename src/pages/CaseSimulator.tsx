import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { TrialSimulatorV2 } from "@/components/simulator/TrialSimulatorV2";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, AlertTriangle } from "lucide-react";

export default function CaseSimulator() {
  const { id } = useParams<{ id: string }>();

  const {
    data: caseData,
    isLoading: caseLoading,
    error: caseError,
  } = useQuery({
    queryKey: ['case', id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('cases')
        .select('id, name, case_type, case_theory, key_issues, winning_factors')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents', id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('documents')
        .select('id, name, summary')
        .eq('case_id', id!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" asChild className="h-8 gap-1 text-muted-foreground">
            <Link to={`/cases/${id}`}>
              <ChevronLeft className="h-4 w-4" />
              {caseData?.name ?? 'Case'}
            </Link>
          </Button>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm font-medium">Trial Simulator</span>
        </div>

        {/* Loading skeleton */}
        {caseLoading && (
          <div className="space-y-4">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {/* Error state */}
        {caseError && !caseLoading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <p className="font-semibold text-lg">Could not load case data</p>
            <p className="text-muted-foreground text-sm max-w-xs">
              The case may not exist or you may not have access to it.
            </p>
            <Button variant="outline" asChild>
              <Link to="/cases">Back to Cases</Link>
            </Button>
          </div>
        )}

        {/* Simulator */}
        {!caseLoading && !caseError && (
          <TrialSimulatorV2
            caseId={id!}
            caseData={
              caseData
                ? {
                    name: caseData.name,
                    case_type: caseData.case_type,
                    case_theory: caseData.case_theory ?? null,
                    key_issues: Array.isArray(caseData.key_issues)
                      ? (caseData.key_issues as string[])
                      : null,
                    winning_factors: Array.isArray(caseData.winning_factors)
                      ? (caseData.winning_factors as string[])
                      : null,
                  }
                : null
            }
            documents={documents.map((d) => ({
              id: d.id,
              name: d.name,
              summary: d.summary ?? null,
            }))}
          />
        )}
      </div>
    </Layout>
  );
}
