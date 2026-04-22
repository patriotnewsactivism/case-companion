import { Layout } from "@/components/Layout";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Gavel,
  Search,
  Loader2,
  Star,
  AlertTriangle,
  CheckCircle,
  BookOpen,
  MessageSquare,
  TrendingUp,
  Info,
  Shield,
} from "lucide-react";

interface JudicialProfile {
  judgeName: string;
  court: string;
  appointedBy: string;
  appointmentYear: string;
  priorExperience: string[];
  lawSchool: string;
  dataConfidence: "high" | "medium" | "low";
  knowledgeNote: string;
  courtroom: {
    demeanor: string;
    oral_argument_preference: string;
    writing_style_preference: string;
    notable_rules: string[];
    pet_peeves: string[];
  };
  motionStatistics: {
    note: string;
    msjGrantRate: string;
    mtdGrantRate: string;
    motionInLimineApproach: string;
    settlementEncouragement: string;
  };
  notableRulings: Array<{
    topic: string;
    tendency: string;
    note: string;
  }>;
  appearanceTips: string[];
  briefWritingTips: string[];
  caseTypeNotes: {
    criminal: string;
    civil: string;
    summary: string;
  };
}

const confidenceColors = {
  high: "bg-green-100 text-green-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-orange-100 text-orange-700",
};

export default function JudicialIntelligence() {
  const [judgeName, setJudgeName] = useState("");
  const [court, setCourt] = useState("");
  const [caseType, setCaseType] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<JudicialProfile | null>(null);
  const [cached, setCached] = useState(false);

  const handleSearch = async () => {
    if (!judgeName.trim()) {
      toast.error("Please enter a judge's name");
      return;
    }
    setLoading(true);
    setProfile(null);
    try {
      const { data, error } = await supabase.functions.invoke("judicial-research", {
        body: { judgeName: judgeName.trim(), court: court.trim(), caseType: caseType.trim() },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Research failed");
      setProfile(data.profile);
      setCached(data.cached || false);
      toast.success(`Profile loaded for ${judgeName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to research judge");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <Gavel className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Judicial Intelligence</h1>
            <p className="text-muted-foreground text-sm">
              AI-powered judge profiles — tendencies, preferences, and appearance tips
            </p>
          </div>
        </div>

        {/* Search */}
        <Card className="glass-card">
          <CardContent className="pt-6">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Judge Name *</Label>
                <Input
                  placeholder="e.g. Hon. Jane Smith"
                  value={judgeName}
                  onChange={(e) => setJudgeName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Court / District</Label>
                <Input
                  placeholder="e.g. SDNY, Travis County"
                  value={court}
                  onChange={(e) => setCourt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Case Type</Label>
                <Input
                  placeholder="e.g. civil rights, contract"
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button onClick={handleSearch} disabled={loading || !judgeName.trim()}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                {loading ? "Researching..." : "Research Judge"}
              </Button>
              {profile && (
                <p className="text-xs text-muted-foreground self-center">
                  {cached ? "Loaded from cache" : "Fresh AI research"}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Profile */}
        {loading && (
          <Card className="glass-card">
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center space-y-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Researching judicial profile...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {profile && !loading && (
          <div className="space-y-4">
            {/* Profile Header */}
            <Card className="glass-card">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">{profile.judgeName}</h2>
                    <p className="text-muted-foreground">{profile.court}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {profile.appointedBy && profile.appointedBy !== "Unknown" && (
                        <Badge variant="outline" className="text-xs">
                          Appointed by: {profile.appointedBy} ({profile.appointmentYear})
                        </Badge>
                      )}
                      {profile.lawSchool && profile.lawSchool !== "Unknown" && (
                        <Badge variant="outline" className="text-xs">{profile.lawSchool}</Badge>
                      )}
                      <Badge className={`text-xs ${confidenceColors[profile.dataConfidence || "medium"]}`}>
                        {profile.dataConfidence?.toUpperCase() || "MEDIUM"} confidence
                      </Badge>
                    </div>
                    {profile.knowledgeNote && (
                      <div className="flex items-start gap-2 mt-3 p-3 bg-muted/50 rounded-lg">
                        <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground">{profile.knowledgeNote}</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="courtroom">
              <TabsList className="mb-4">
                <TabsTrigger value="courtroom">Courtroom Style</TabsTrigger>
                <TabsTrigger value="motions">Motion Stats</TabsTrigger>
                <TabsTrigger value="rulings">Rulings & Tendencies</TabsTrigger>
                <TabsTrigger value="tips">Appearance Tips</TabsTrigger>
              </TabsList>

              {/* Courtroom Style */}
              <TabsContent value="courtroom" className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        Courtroom Demeanor
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{profile.courtroom?.demeanor || "Not available"}</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" />
                        Writing Style Preference
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{profile.courtroom?.writing_style_preference || "Not available"}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Oral Argument Preference</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{profile.courtroom?.oral_argument_preference || "Not available"}</p>
                  </CardContent>
                </Card>

                {profile.courtroom?.notable_rules?.length > 0 && (
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-500" />
                        Notable Local Rules / Preferences
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {profile.courtroom.notable_rules.map((rule, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <CheckCircle className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                            {rule}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {profile.courtroom?.pet_peeves?.length > 0 && (
                  <Card className="glass-card border-red-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                        Pet Peeves — Avoid These
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {profile.courtroom.pet_peeves.map((peeve, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                            {peeve}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Motion Statistics */}
              <TabsContent value="motions" className="space-y-4">
                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Info className="h-4 w-4 text-muted-foreground" />
                      Data Note
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{profile.motionStatistics?.note || "Data based on AI knowledge base."}</p>
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { label: "Motion for Summary Judgment", value: profile.motionStatistics?.msjGrantRate },
                    { label: "Motion to Dismiss (12(b)(6))", value: profile.motionStatistics?.mtdGrantRate },
                  ].map(({ label, value }) => (
                    <Card key={label} className="glass-card">
                      <CardContent className="pt-6">
                        <p className="text-xs text-muted-foreground mb-1">{label}</p>
                        <p className="text-sm font-medium">{value || "Not available"}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Motions in Limine Approach</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{profile.motionStatistics?.motionInLimineApproach || "Not available"}</p>
                  </CardContent>
                </Card>

                <Card className="glass-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Settlement Encouragement</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{profile.motionStatistics?.settlementEncouragement || "Not available"}</p>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Rulings & Tendencies */}
              <TabsContent value="rulings" className="space-y-4">
                {profile.caseTypeNotes?.summary && (
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">{profile.caseTypeNotes.summary}</p>
                    </CardContent>
                  </Card>
                )}

                {profile.notableRulings?.length > 0 && (
                  <div className="space-y-3">
                    {profile.notableRulings.map((ruling, i) => (
                      <Card key={i} className="glass-card">
                        <CardContent className="pt-4 pb-4">
                          <div className="flex items-start gap-3">
                            <Badge variant="outline" className="text-xs shrink-0 mt-0.5">{ruling.topic}</Badge>
                            <div>
                              <p className="text-sm font-medium">{ruling.tendency}</p>
                              {ruling.note && <p className="text-xs text-muted-foreground mt-1">{ruling.note}</p>}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Appearance Tips */}
              <TabsContent value="tips" className="space-y-4">
                {profile.appearanceTips?.length > 0 && (
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Star className="h-4 w-4 text-amber-500" />
                        Courtroom Appearance Tips
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {profile.appearanceTips.map((tip, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {profile.briefWritingTips?.length > 0 && (
                  <Card className="glass-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-blue-500" />
                        Brief Writing Tips
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {profile.briefWritingTips.map((tip, i) => (
                          <li key={i} className="text-sm flex items-start gap-2">
                            <CheckCircle className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {!profile && !loading && (
          <Card className="glass-card">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Gavel className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="font-medium mb-2">Research Any Judge</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Enter a judge's name above to get an AI-generated intelligence profile including courtroom preferences, motion tendencies, and strategic tips.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
