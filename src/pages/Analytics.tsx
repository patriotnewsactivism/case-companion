import { Layout } from "@/components/Layout";
import { PerformanceDashboard } from "@/components/analytics/PerformanceDashboard";

export default function Analytics() {
  return (
    <Layout>
      <div className="p-6 lg:p-8">
        <PerformanceDashboard />
      </div>
    </Layout>
  );
}
