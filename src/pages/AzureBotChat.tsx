import { useParams, Link, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Bot, MessageSquare } from "lucide-react";

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
              <h1 className="text-2xl font-bold text-foreground">AI Assistant</h1>
              <p className="text-muted-foreground mt-1">
                Your legal AI assistant. Use the Document-Aware Chat for legal research, analysis, and trial preparation.
              </p>
            </div>
          </div>
        </div>

        {/* Redirect to Document-Aware Chat */}
        <div className="bg-card rounded-xl shadow-sm border overflow-hidden p-8">
          <div className="flex flex-col items-center justify-center gap-6 text-center min-h-[400px]">
            <div className="p-4 bg-blue-100 rounded-full">
              <MessageSquare className="h-10 w-10 text-blue-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-2">
                AI Chat Has Moved
              </h3>
              <p className="text-muted-foreground max-w-md">
                The AI assistant is now powered by Gemini and integrated directly into your case workflow. 
                Use the <strong>Document-Aware Chat</strong> on your case page for the best experience — 
                it can analyze your uploaded documents and provide context-aware legal insights.
              </p>
            </div>
            <div className="flex gap-3">
              <Button asChild>
                <Link to={`/cases/${id}`}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back to Case
                </Link>
              </Button>
            </div>
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
