import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Image,
  File,
  Eye,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Bookmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Document } from "@/lib/api";

interface ExhibitDisplayProps {
  documents: Document[];
  onShowToWitness: (document: Document) => void;
  sessionId?: string;
}

interface ExhibitState {
  [documentId: string]: {
    shown: boolean;
    admitted: boolean;
    exhibitNumber: string;
    timestamp?: string;
  };
}

const getFileIcon = (fileType: string | null) => {
  if (!fileType) return <File className="h-5 w-5" />;
  if (fileType.startsWith("image/")) return <Image className="h-5 w-5" />;
  if (fileType.includes("pdf")) return <FileText className="h-5 w-5" />;
  return <File className="h-5 w-5" />;
};

const getExhibitPrefix = (representation: 'plaintiff' | 'defendant' | 'executor' | 'petitioner' | 'respondent' | 'other'): string => {
  switch (representation) {
    case 'plaintiff':
    case 'petitioner':
      return 'P';
    case 'defendant':
    case 'respondent':
      return 'D';
    default:
      return 'E';
  }
};

export function ExhibitDisplay({ documents, onShowToWitness, sessionId }: ExhibitDisplayProps) {
  const [exhibitStates, setExhibitStates] = useState<ExhibitState>({});
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [exhibitCounter, setExhibitCounter] = useState({ P: 0, D: 0, E: 0 });

  const markAsShown = (doc: Document) => {
    const prefix = getExhibitPrefix('plaintiff');
    const count = exhibitCounter[prefix] + 1;
    const exhibitNumber = `${prefix}-${count}`;

    setExhibitStates(prev => ({
      ...prev,
      [doc.id]: {
        shown: true,
        admitted: false,
        exhibitNumber,
        timestamp: new Date().toISOString(),
      },
    }));

    setExhibitCounter(prev => ({
      ...prev,
      [prefix]: count,
    }));

    setSelectedDocument(doc);
    onShowToWitness(doc);
  };

  const markAsAdmitted = (docId: string) => {
    setExhibitStates(prev => ({
      ...prev,
      [docId]: {
        ...prev[docId],
        admitted: true,
      },
    }));
  };

  const markAsExcluded = (docId: string) => {
    setExhibitStates(prev => ({
      ...prev,
      [docId]: {
        ...prev[docId],
        admitted: false,
      },
    }));
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Bookmark className="h-4 w-4" />
          Exhibits ({documents.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-2 space-y-2">
            {documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No documents available</p>
                <p className="text-xs">Upload documents to use as exhibits</p>
              </div>
            ) : (
              documents.map(doc => {
                const state = exhibitStates[doc.id];
                return (
                  <div
                    key={doc.id}
                    className={cn(
                      "p-3 rounded-lg border transition-all cursor-pointer",
                      selectedDocument?.id === doc.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50",
                      state?.admitted && "border-green-500/50 bg-green-500/5"
                    )}
                    onClick={() => setSelectedDocument(doc)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 p-2 bg-muted rounded">
                        {getFileIcon(doc.file_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{doc.name}</p>
                          {state?.exhibitNumber && (
                            <Badge variant="outline" className="text-xs">
                              {state.exhibitNumber}
                            </Badge>
                          )}
                        </div>
                        {doc.summary && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                            {doc.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {state?.admitted ? (
                            <Badge className="bg-green-500 text-white text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Admitted
                            </Badge>
                          ) : state?.shown ? (
                            <Badge variant="secondary" className="text-xs">
                              <Eye className="h-3 w-3 mr-1" />
                              Shown
                            </Badge>
                          ) : null}
                          {state?.shown && !state?.admitted && (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-500">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Pending admission
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {!state?.shown ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsShown(doc);
                          }}
                          className="w-full"
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          Show to Witness
                        </Button>
                      ) : (
                        <>
                          {!state.admitted && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsAdmitted(doc.id);
                                }}
                                className="flex-1 text-green-600 border-green-500 hover:bg-green-500/10"
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Admit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsExcluded(doc.id);
                                }}
                                className="flex-1 text-red-600 border-red-500 hover:bg-red-500/10"
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Exclude
                              </Button>
                            </>
                          )}
                          {doc.file_url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(doc.file_url, '_blank');
                              }}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {selectedDocument && selectedDocument.key_facts && selectedDocument.key_facts.length > 0 && (
        <div className="border-t p-3">
          <p className="text-xs font-medium mb-2">Key Facts:</p>
          <ul className="text-xs text-muted-foreground space-y-1">
            {selectedDocument.key_facts.slice(0, 3).map((fact, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
