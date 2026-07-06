import { Layout } from "@/components/Layout";
import { RequestsManager } from "@/components/requests/RequestsManager";
import { useQuery } from "@tanstack/react-query";
import { getCases } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";

export default function RecordsRequests() {
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
          <h1 className="text-2xl font-serif font-bold">Records &amp; Requests</h1>
          <p className="text-muted-foreground mt-1">
            Draft and track public-records/FOIA requests, discovery demands, preservation
            letters, and subpoenas — with statutory deadlines on your smart case timeline.
          </p>
        </div>
        <RequestsManager cases={cases} selectedCaseId={caseIdFromUrl || undefined} />
      </div>
    </Layout>
  );
}
