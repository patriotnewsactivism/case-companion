import { Layout } from "@/components/Layout";
import { DiscoveryManager } from "@/components/discovery/DiscoveryManager";
import { useQuery } from "@tanstack/react-query";
import { getCases } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

export default function Discovery() {
  const [searchParams] = useSearchParams();
  const caseIdFromUrl = searchParams.get("caseId");

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: getCases,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-bold">Discovery Manager</h1>
          <p className="text-muted-foreground mt-1">
            Track and respond to discovery requests with AI assistance
          </p>
        </div>
        <DiscoveryManager 
          cases={cases} 
          selectedCaseId={caseIdFromUrl || undefined}
        />
      </div>
    </Layout>
  );
}
