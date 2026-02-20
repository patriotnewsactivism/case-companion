import { Layout } from "@/components/Layout";
import { MockJury } from "@/components/jury/MockJury";

export default function MockJuryPage() {
  return (
    <Layout>
      <div className="p-6 lg:p-8">
        <MockJury />
      </div>
    </Layout>
  );
}
