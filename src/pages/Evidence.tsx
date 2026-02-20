import { Layout } from "@/components/Layout";
import { EvidenceAnalyzer } from "@/components/evidence/EvidenceAnalyzer";

export default function EvidencePage() {
  return (
    <Layout>
      <div className="p-6 lg:p-8">
        <EvidenceAnalyzer />
      </div>
    </Layout>
  );
}
