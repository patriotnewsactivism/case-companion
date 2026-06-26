import React, { useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Upload, StickyNote, Eye } from "lucide-react";

export interface MeetingNote {
  id: string;
  text: string;
  timestamp: string;
  author: string;
}

export interface CaseDocument {
  id: string;
  name: string;
  file_url?: string;
  file_type?: string;
  file_size?: number;
}

interface VideoSidePanelProps {
  meetingNotes: MeetingNote[];
  currentNote: string;
  setCurrentNote: (note: string) => void;
  addNote: () => void;
  caseDocuments: CaseDocument[];
  isUploading: boolean;
  handleInCallUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  selectedCaseId: string;
}

export function VideoSidePanel({
  meetingNotes,
  currentNote,
  setCurrentNote,
  addNote,
  caseDocuments,
  isUploading,
  handleInCallUpload,
  selectedCaseId,
}: VideoSidePanelProps) {
  const [sidePanelTab, setSidePanelTab] = React.useState<"documents" | "notes">("documents");
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="w-80 lg:w-96 flex-shrink-0 bg-slate-800 border-l border-slate-700/50 flex flex-col">
      <Tabs value={sidePanelTab} onValueChange={(v) => setSidePanelTab(v as "documents" | "notes")} className="flex flex-col h-full">
        <TabsList className="mx-3 mt-3 bg-slate-700/50">
          <TabsTrigger value="documents" className="text-xs data-[state=active]:bg-slate-600">
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs data-[state=active]:bg-slate-600">
            <StickyNote className="h-3.5 w-3.5 mr-1.5" />
            Notes ({meetingNotes.length})
          </TabsTrigger>
        </TabsList>

        {/* Documents tab */}
        <TabsContent value="documents" className="flex-1 flex flex-col px-3 pb-3 mt-0 overflow-hidden">
          <div className="flex items-center justify-between py-2">
            <span className="text-xs text-slate-400">{caseDocuments.length} document{caseDocuments.length !== 1 ? "s" : ""}</span>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleInCallUpload}
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.mp3,.mp4,.wav"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || !selectedCaseId}
                className="h-7 text-xs border-slate-600 text-slate-300"
              >
                {isUploading ? (
                  <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" />Uploading...</>
                ) : (
                  <><Upload className="h-3 w-3 mr-1.5" />Upload</>
                )}
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-1.5">
              {caseDocuments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No documents in this case yet.</p>
                  <p className="mt-1">Upload files to share during the call.</p>
                </div>
              ) : caseDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 p-2 rounded-md bg-slate-700/40 hover:bg-slate-700/60 transition-colors cursor-pointer group"
                  onClick={() => {
                    if (doc.file_url) window.open(doc.file_url, "_blank");
                  }}
                >
                  <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-200 truncate">{doc.name}</p>
                    <p className="text-[10px] text-slate-500">
                      {doc.file_type || "Document"} {doc.file_size ? `• ${(doc.file_size / 1024).toFixed(0)}KB` : ""}
                    </p>
                  </div>
                  <Eye className="h-3.5 w-3.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Notes tab */}
        <TabsContent value="notes" className="flex-1 flex flex-col px-3 pb-3 mt-0 overflow-hidden">
          <div className="py-2 space-y-2 flex-shrink-0">
            <Textarea
              placeholder="Type a meeting note... (press Enter to save)"
              value={currentNote}
              onChange={e => setCurrentNote(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addNote();
                }
              }}
              className="text-xs min-h-[60px] bg-slate-700/50 border-slate-600 text-slate-200 resize-none"
              rows={2}
            />
            <Button
              size="sm"
              onClick={addNote}
              disabled={!currentNote.trim()}
              className="w-full h-7 text-xs"
            >
              <StickyNote className="h-3 w-3 mr-1.5" />
              Save Note
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {meetingNotes.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  <StickyNote className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No notes yet.</p>
                  <p className="mt-1">Notes are saved to the case file when you leave.</p>
                </div>
              ) : meetingNotes.map((note) => (
                <div key={note.id} className="p-2.5 rounded-md bg-slate-700/40 border border-slate-700/50">
                  <p className="text-xs text-slate-200 whitespace-pre-wrap">{note.text}</p>
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    {new Date(note.timestamp).toLocaleTimeString()} • {note.author}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
