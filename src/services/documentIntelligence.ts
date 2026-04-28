/**
 * Document Intelligence Service
 *
 * After OCR + AI analysis completes on a document, this service:
 * 1. Derives a smart document name from the analysis (replaces "IMG_2847.jpg" → "Police Report - 2024-03-15")
 * 2. Extracts the most likely document date
 * 3. Classifies the document type (police report, medical record, contract, etc.)
 * 4. Handles chronological Bates re-ordering for a case
 *
 * Designed to run client-side after the ocr-document edge function returns.
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Document Type Classification ────────────────────────────────────────────

export type DocumentType =
  | "police_report"
  | "medical_record"
  | "contract"
  | "correspondence"
  | "court_filing"
  | "deposition"
  | "financial_record"
  | "government_record"
  | "insurance_document"
  | "photograph"
  | "video_evidence"
  | "witness_statement"
  | "expert_report"
  | "discovery_response"
  | "internal_memo"
  | "public_record"
  | "foia_response"
  | "body_cam_footage"
  | "affidavit"
  | "exhibit"
  | "unknown";

const DOC_TYPE_PATTERNS: Array<{ type: DocumentType; patterns: RegExp[] }> = [
  {
    type: "police_report",
    patterns: [
      /police\s+report/i, /incident\s+report/i, /arrest\s+report/i,
      /officer\s+report/i, /use\s+of\s+force/i, /booking\s+report/i,
      /supplemental\s+report/i, /patrol\s+report/i,
    ],
  },
  {
    type: "medical_record",
    patterns: [
      /medical\s+record/i, /hospital/i, /patient/i, /diagnosis/i,
      /discharge\s+summary/i, /lab\s+result/i, /radiology/i,
      /physician/i, /treatment\s+plan/i, /emergency\s+room/i,
    ],
  },
  {
    type: "court_filing",
    patterns: [
      /complaint/i, /motion\s+(to|for)/i, /petition/i, /answer/i,
      /brief/i, /memorandum\s+of\s+law/i, /order/i, /judgment/i,
      /subpoena/i, /summons/i, /notice\s+of/i, /stipulation/i,
    ],
  },
  {
    type: "deposition",
    patterns: [
      /deposition/i, /oral\s+examination/i, /transcript\s+of/i,
      /sworn\s+testimony/i, /examination\s+before\s+trial/i,
    ],
  },
  {
    type: "contract",
    patterns: [
      /contract/i, /agreement/i, /memorandum\s+of\s+understanding/i,
      /terms\s+and\s+conditions/i, /lease/i, /settlement\s+agreement/i,
    ],
  },
  {
    type: "correspondence",
    patterns: [
      /letter\s+(to|from)/i, /email/i, /memorandum/i, /notice/i,
      /demand\s+letter/i, /cease\s+and\s+desist/i, /re:\s/i,
    ],
  },
  {
    type: "witness_statement",
    patterns: [
      /witness\s+statement/i, /sworn\s+statement/i, /declaration/i,
      /statement\s+of/i, /account\s+of\s+events/i,
    ],
  },
  {
    type: "affidavit",
    patterns: [/affidavit/i, /sworn\s+affidavit/i, /notarized/i],
  },
  {
    type: "financial_record",
    patterns: [
      /bank\s+statement/i, /invoice/i, /receipt/i, /payroll/i,
      /tax\s+return/i, /financial\s+statement/i, /ledger/i,
    ],
  },
  {
    type: "insurance_document",
    patterns: [
      /insurance/i, /policy/i, /claim/i, /coverage/i,
      /adjuster/i, /premium/i,
    ],
  },
  {
    type: "government_record",
    patterns: [
      /government/i, /agency\s+record/i, /public\s+record/i,
      /certificate/i, /permit/i, /license/i,
    ],
  },
  {
    type: "foia_response",
    patterns: [
      /foia/i, /freedom\s+of\s+information/i, /public\s+records\s+request/i,
      /open\s+records/i,
    ],
  },
  {
    type: "body_cam_footage",
    patterns: [/body\s*cam/i, /body[\s-]worn\s+camera/i, /bwc/i, /dash\s*cam/i],
  },
  {
    type: "expert_report",
    patterns: [
      /expert\s+report/i, /expert\s+opinion/i, /forensic/i,
      /analysis\s+report/i, /toxicology/i,
    ],
  },
  {
    type: "discovery_response",
    patterns: [
      /interrogator/i, /request\s+for\s+(production|admission)/i,
      /discovery\s+response/i, /response\s+to/i,
    ],
  },
];

/**
 * Classify a document type from its text content and analysis.
 */
export function classifyDocumentType(
  ocrText: string,
  summary?: string,
  keyFacts?: string[]
): DocumentType {
  const combined = [summary || "", ...(keyFacts || []), ocrText.slice(0, 5000)].join(" ");

  let bestMatch: DocumentType = "unknown";
  let bestScore = 0;

  for (const { type, patterns } of DOC_TYPE_PATTERNS) {
    let score = 0;
    for (const pattern of patterns) {
      if (pattern.test(combined)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = type;
    }
  }

  return bestMatch;
}

// ─── Date Extraction ─────────────────────────────────────────────────────────

const DATE_PATTERNS = [
  // ISO format: 2024-03-15
  /\b(\d{4}-\d{2}-\d{2})\b/,
  // US format: 03/15/2024 or 3/15/2024
  /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/,
  // Written: March 15, 2024
  /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/i,
  // Written short: Mar 15, 2024
  /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4})\b/i,
];

/**
 * Extract the most likely document date from text.
 * Priority: dates in the first 500 chars (usually document header/date line).
 */
export function extractDocumentDate(
  ocrText: string,
  timelineEvents?: Array<{ date: string; event: string }>
): string | null {
  // First try the document header (first 500 chars)
  const header = ocrText.slice(0, 500);
  for (const pattern of DATE_PATTERNS) {
    const match = header.match(pattern);
    if (match?.[1]) {
      const parsed = normalizeDate(match[1]);
      if (parsed) return parsed;
    }
  }

  // Then try timeline events (earliest date)
  if (timelineEvents && timelineEvents.length > 0) {
    const dates = timelineEvents
      .map((e) => normalizeDate(e.date))
      .filter((d): d is string => !!d)
      .sort();
    if (dates.length > 0) return dates[0];
  }

  // Finally try the full text (first match)
  for (const pattern of DATE_PATTERNS) {
    const match = ocrText.match(pattern);
    if (match?.[1]) {
      const parsed = normalizeDate(match[1]);
      if (parsed) return parsed;
    }
  }

  return null;
}

function normalizeDate(dateStr: string): string | null {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    // Don't accept dates before 1900 or after 2100
    if (d.getFullYear() < 1900 || d.getFullYear() > 2100) return null;
    return d.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

// ─── Smart Document Naming ───────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  police_report: "Police Report",
  medical_record: "Medical Record",
  contract: "Contract",
  correspondence: "Correspondence",
  court_filing: "Court Filing",
  deposition: "Deposition",
  financial_record: "Financial Record",
  government_record: "Government Record",
  insurance_document: "Insurance Document",
  photograph: "Photograph",
  video_evidence: "Video Evidence",
  witness_statement: "Witness Statement",
  expert_report: "Expert Report",
  discovery_response: "Discovery Response",
  internal_memo: "Internal Memo",
  public_record: "Public Record",
  foia_response: "FOIA Response",
  body_cam_footage: "Body Cam Footage",
  affidavit: "Affidavit",
  exhibit: "Exhibit",
  unknown: "Document",
};

/**
 * Generate a smart document name from the AI analysis.
 * Example: "Police Report - 2024-03-15" or "Deposition of John Smith - 2024-01-20"
 */
export function generateSmartName(
  docType: DocumentType,
  documentDate: string | null,
  summary?: string,
  entities?: Array<{ name: string; type: string }>
): string {
  const label = DOC_TYPE_LABELS[docType] || "Document";

  // Try to find a key person/org from entities to make the name more specific
  let qualifier = "";
  if (entities && entities.length > 0) {
    const person = entities.find((e) => e.type === "person");
    const org = entities.find((e) => e.type === "organization");
    if (person && (docType === "deposition" || docType === "witness_statement" || docType === "affidavit")) {
      qualifier = ` of ${person.name}`;
    } else if (org && (docType === "correspondence" || docType === "foia_response")) {
      qualifier = ` - ${org.name}`;
    }
  }

  // Add summary fragment for generic types
  if (!qualifier && summary && docType !== "unknown") {
    // Extract first meaningful phrase (up to 40 chars)
    const fragment = summary.replace(/^(this|the|a|an)\s+(document|record|report)\s*/i, "").slice(0, 40).trim();
    if (fragment.length > 10) {
      const truncated = fragment.replace(/\s+\S*$/, ""); // word boundary
      if (truncated.length > 10) qualifier = ` - ${truncated}`;
    }
  }

  const datePart = documentDate ? ` (${documentDate})` : "";

  return `${label}${qualifier}${datePart}`;
}

// ─── Post-Analysis Intelligence ──────────────────────────────────────────────

export interface DocumentIntelligenceResult {
  suggestedName: string;
  documentType: DocumentType;
  documentDate: string | null;
}

/**
 * Run document intelligence after OCR + AI analysis completes.
 * Call this with the edge function response data.
 */
export async function runDocumentIntelligence(
  documentId: string,
  ocrText: string,
  summary?: string,
  keyFacts?: string[],
  timelineEvents?: Array<{ date: string; event: string }>,
  entities?: Array<{ name: string; type: string }>
): Promise<DocumentIntelligenceResult> {
  const documentType = classifyDocumentType(ocrText, summary, keyFacts);
  const documentDate = extractDocumentDate(ocrText, timelineEvents);
  const suggestedName = generateSmartName(documentType, documentDate, summary, entities);

  // Persist to database
  const updateFields: Record<string, unknown> = {
    ai_suggested_name: suggestedName,
    document_type: documentType,
  };

  // Only set document_date if we found one
  if (documentDate) {
    updateFields.document_date = documentDate;
  }

  const { error } = await (supabase as any)
    .from("documents")
    .update(updateFields)
    .eq("id", documentId);

  if (error) {
    console.warn("Failed to persist document intelligence:", error.message);
    // Try without new columns (they may not exist yet)
    try {
      await (supabase as any)
        .from("documents")
        .update({ ai_suggested_name: suggestedName })
        .eq("id", documentId);
    } catch {
      // Non-fatal — the data is still returned
    }
  }

  return { suggestedName, documentType, documentDate };
}

// ─── Bates Number Management ─────────────────────────────────────────────────

export interface BatesDocument {
  id: string;
  name: string;
  bates_number: string | null;
  document_date: string | null;
  document_type: string | null;
  created_at: string;
  ai_suggested_name: string | null;
}

export interface BatesReorderResult {
  reorderedCount: number;
  changes: Array<{
    documentId: string;
    oldBates: string | null;
    newBates: string;
    name: string;
  }>;
  warnings: string[];
}

/**
 * Reorder Bates numbers chronologically for all documents in a case.
 * Documents are sorted by document_date (if available) then created_at.
 *
 * ⚠️ WARNING: Changing Bates numbers after they've been referenced in
 * filings, depositions, or correspondence can cause serious confusion.
 * This function returns warnings and a change log for the user to review.
 */
export async function reorderBatesChronologically(
  caseId: string,
  batesPrefix: string = "DOC"
): Promise<BatesReorderResult> {
  const warnings: string[] = [];

  // Fetch all documents for the case
  const { data: documents, error } = await (supabase as any)
    .from("documents")
    .select("id, name, bates_number, document_date, document_type, created_at, ai_suggested_name")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
  if (!documents || documents.length === 0) {
    return { reorderedCount: 0, changes: [], warnings: ["No documents found in this case."] };
  }

  const docs = documents as BatesDocument[];

  // Check if any docs already have Bates numbers that differ from our prefix
  const existingBatesWithDifferentPrefix = docs.filter(
    (d) => d.bates_number && !d.bates_number.startsWith(batesPrefix)
  );
  if (existingBatesWithDifferentPrefix.length > 0) {
    warnings.push(
      `⚠️ ${existingBatesWithDifferentPrefix.length} document(s) have Bates numbers with a different prefix. ` +
      `They will be renumbered with prefix "${batesPrefix}".`
    );
  }

  // Check if any docs have been referenced (have Bates numbers already)
  const docsWithExistingBates = docs.filter((d) => d.bates_number);
  if (docsWithExistingBates.length > 0) {
    warnings.push(
      `⚠️ ${docsWithExistingBates.length} document(s) already have Bates numbers. ` +
      `Renumbering will change them. If these numbers have been used in filings, ` +
      `depositions, or correspondence, this could cause confusion. Proceed with caution.`
    );
  }

  // Sort: documents with dates first (chronologically), then undated (by upload time)
  const sorted = [...docs].sort((a, b) => {
    const dateA = a.document_date || "";
    const dateB = b.document_date || "";

    if (dateA && dateB) return dateA.localeCompare(dateB);
    if (dateA && !dateB) return -1; // dated docs first
    if (!dateA && dateB) return 1;
    return a.created_at.localeCompare(b.created_at); // fallback to upload order
  });

  // Assign new Bates numbers
  const changes: BatesReorderResult["changes"] = [];
  const updates: Array<{ id: string; bates_number: string }> = [];

  for (let i = 0; i < sorted.length; i++) {
    const doc = sorted[i];
    const newBates = `${batesPrefix}-${String(i + 1).padStart(4, "0")}`;
    const displayName = doc.ai_suggested_name || doc.name;

    if (doc.bates_number !== newBates) {
      changes.push({
        documentId: doc.id,
        oldBates: doc.bates_number,
        newBates,
        name: displayName,
      });
      updates.push({ id: doc.id, bates_number: newBates });
    }
  }

  if (updates.length === 0) {
    return { reorderedCount: 0, changes: [], warnings: ["Documents are already in chronological Bates order."] };
  }

  // Undated documents warning
  const undatedCount = sorted.filter((d) => !d.document_date).length;
  if (undatedCount > 0) {
    warnings.push(
      `ℹ️ ${undatedCount} document(s) have no detected date — they were placed at the end in upload order. ` +
      `Run AI analysis on these documents first for better chronological ordering.`
    );
  }

  // Persist all changes
  for (const update of updates) {
    const { error: updateError } = await (supabase as any)
      .from("documents")
      .update({ bates_number: update.bates_number })
      .eq("id", update.id);

    if (updateError) {
      warnings.push(`Failed to update Bates for document ${update.id}: ${updateError.message}`);
    }
  }

  return {
    reorderedCount: changes.length,
    changes,
    warnings,
  };
}

/**
 * Get the next sequential Bates number for a case.
 */
export async function getNextBatesNumber(
  caseId: string,
  prefix: string = "DOC"
): Promise<string> {
  const { data, error } = await (supabase as any)
    .from("documents")
    .select("bates_number")
    .eq("case_id", caseId)
    .not("bates_number", "is", null)
    .order("bates_number", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return `${prefix}-0001`;
  }

  const lastBates = data[0].bates_number as string;
  const match = lastBates.match(/(\d+)$/);
  const nextNum = match ? parseInt(match[1], 10) + 1 : 1;
  return `${prefix}-${String(nextNum).padStart(4, "0")}`;
}
