import { useParams, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { AzureBotChat } from "@/components/AzureBotChat";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Bot } from "lucide-react";

export default function AzureBotChatPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" asChild className="h-8 gap-1 text-muted-foreground">
            <Link to={`/cases/${id}`}>
              <ChevronLeft className="h-4 w-4" />
              Case Details
            </Link>
          </Button>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm font-medium">AI Assistant</span>
        </div>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bot className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">GLM-5 AI Assistant</h1>
              <p className="text-muted-foreground mt-1">
                Your legal AI assistant powered by Azure AI Foundry. Get help with legal research, document analysis, and trial preparation.
              </p>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className="bg-card rounded-xl shadow-sm border overflow-hidden">
          <div className="bg-muted/50 px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Active Session</span>
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              </div>
              <div className="text-xs text-muted-foreground">
                GLM-5 Bot Service
              </div>
            </div>
          </div>
          <div className="h-[calc(100vh-300px)] min-h-[600px]">
            <AzureBotChat
              directLineSecret={import.meta.env.VITE_AZURE_BOT_DIRECT_LINE_SECRET}
              botAvatarInitials="GLM"
              userAvatarInitials="ME"
            />
          </div>
        </div>

        {/* Features */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card p-4 rounded-lg border shadow-sm">
            <h3 className="font-medium text-foreground mb-2">Legal Research</h3>
            <p className="text-sm text-muted-foreground">
              Get instant access to legal precedents, statutes, and case law relevant to your case.
            </p>
          </div>
          <div className="bg-card p-4 rounded-lg border shadow-sm">
            <h3 className="font-medium text-foreground mb-2">Document Analysis</h3>
            <p className="text-sm text-muted-foreground">
              Analyze legal documents, extract key facts, and identify potential issues.
            </p>
          </div>
          <div className="bg-card p-4 rounded-lg border shadow-sm">
            <h3 className="font-medium text-foreground mb-2">Trial Preparation</h3>
            <p className="text-sm text-muted-foreground">
              Prepare for trials with strategy suggestions, objection tips, and witness questioning guidance.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
