import { Layout } from "@/components/Layout";
import { SessionHistory } from "@/components/sessions/SessionHistory";

export default function Sessions() {
  return (
    <Layout>
      <div className="p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-serif font-bold">Session History</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Review and analyze your past trial prep sessions
            </p>
          </div>
          <SessionHistory />
        </div>
      </div>
    </Layout>
  );
}
