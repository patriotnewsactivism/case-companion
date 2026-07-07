import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

interface FunctionInvokeResult {
  ok: boolean;
  status: number;
  data: unknown;
  message: string;
}

function shortError(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return JSON.stringify(err);
}

function buildPdfWithText(lines: string[]): Buffer {
  const escapedLines = lines.map((line) =>
    line
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
  );

  let contentStream = "BT\n/F1 14 Tf\n72 720 Td\n";
  for (let i = 0; i < escapedLines.length; i += 1) {
    if (i > 0) {
      contentStream += "0 -22 Td\n";
    }
    contentStream += `(${escapedLines[i]}) Tj\n`;
  }
  contentStream += "ET\n";

  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(contentStream, "latin1")} >>\nstream\n${contentStream}endstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += object;
  }

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in environment");
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const email = `azure.ocr.${Date.now()}@example.com`;
  const password = "AzureOcrTest!12345";

  let caseId: string | null = null;
  let documentId: string | null = null;
  let uploadedPath: string | null = null;

  try {
    const signUp = await supabase.auth.signUp({ email, password });
    if (signUp.error || !signUp.data.user || !signUp.data.session) {
      throw new Error(signUp.error?.message || "Failed to authenticate Azure OCR test user");
    }

    const userId = signUp.data.user.id;
    const accessToken = signUp.data.session.access_token;
    console.log(`[PASS] Auth: Signed in as temporary user ${userId}`);

    const invokeFunction = async (name: string, body: Record<string, unknown>): Promise<FunctionInvokeResult> => {
      const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: anonKey,
        },
        body: JSON.stringify(body),
      });

      const rawText = await response.text();
      let parsed: unknown = rawText;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        // keep plain text
      }

      const parsedRecord = parsed as Record<string, unknown>;
      const message = String(parsedRecord?.error || parsedRecord?.message || rawText || `HTTP ${response.status}`);

      return {
        ok: response.ok,
        status: response.status,
        data: parsed,
        message,
      };
    };

    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .insert({
        user_id: userId,
        name: `Azure OCR Validation Case ${Date.now()}`,
        case_type: "Litigation",
        client_name: "Azure OCR Client",
        status: "active",
        representation: "plaintiff",
      })
      .select()
      .single();

    if (caseError || !caseData) {
      throw new Error(caseError?.message || "Failed to create case");
    }

    caseId = caseData.id;
    console.log(`[PASS] Case Creation: ${caseId}`);

    const pdfContent = buildPdfWithText([
      "AZURE OCR VALIDATION DOCUMENT",
      `CaseBuddy integration test run: ${new Date().toISOString()}`,
      "This paragraph confirms upload, OCR extraction, and persistence into the documents table.",
    ]);

    uploadedPath = `${userId}/${caseId}/azure-ocr-${Date.now()}.pdf`;
    const uploadBlob = new Blob([pdfContent], { type: "application/pdf" });

    const { data: storageData, error: storageError } = await supabase.storage
      .from("case-documents")
      .upload(uploadedPath, uploadBlob, {
        cacheControl: "3600",
        upsert: false,
      });

    if (storageError || !storageData) {
      throw new Error(storageError?.message || "Failed to upload PDF");
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("case-documents").getPublicUrl(storageData.path);
    console.log(`[PASS] Upload: ${storageData.path}`);

    const { data: docData, error: docError } = await supabase
      .from("documents")
      .insert({
        case_id: caseId,
        user_id: userId,
        name: "azure-ocr-validation.pdf",
        file_url: publicUrl,
        file_type: "application/pdf",
        file_size: pdfContent.byteLength,
      })
      .select()
      .single();

    if (docError || !docData) {
      throw new Error(docError?.message || "Failed to create document record");
    }

    documentId = docData.id;
    console.log(`[PASS] Document Record: ${documentId}`);

    const ocrInvoke = await invokeFunction("ocr-document", {
      documentId,
      fileUrl: publicUrl,
    });

    if (!ocrInvoke.ok) {
      throw new Error(`OCR invoke failed (${ocrInvoke.status}): ${ocrInvoke.message}`);
    }

    const ocrResult = ocrInvoke.data as { ocrProvider?: string; textLength?: number };
    const provider = String(ocrResult?.ocrProvider || "");
    const textLength = Number(ocrResult?.textLength || 0);

    if (!provider.startsWith("azure")) {
      throw new Error(`Expected Azure OCR provider but got "${provider || "unknown"}"`);
    }
    if (textLength < 30) {
      throw new Error(`Expected OCR text length >= 30 but got ${textLength}`);
    }
    console.log(`[PASS] OCR Invoke: provider=${provider}, textLength=${textLength}`);

    const { data: updatedDoc, error: updatedDocError } = await supabase
      .from("documents")
      .select("ocr_text, summary, key_facts, ai_analyzed")
      .eq("id", documentId)
      .maybeSingle();

    if (updatedDocError || !updatedDoc) {
      throw new Error(updatedDocError?.message || "Failed to fetch updated document");
    }

    const persistedText = String(updatedDoc.ocr_text || "");
    if (persistedText.length < 30) {
      throw new Error("OCR text was not persisted to documents table");
    }
    if (!/azure|casebuddy|validation/i.test(persistedText)) {
      throw new Error("Persisted OCR text does not match expected content markers");
    }
    console.log(
      `[PASS] OCR Data Propagation: ocr_text=${persistedText.length} chars, summary=${Boolean(updatedDoc.summary)}`
    );

    console.log("\nAzure OCR validation completed successfully.");
  } finally {
    try {
      if (documentId) {
        await supabase.from("documents").delete().eq("id", documentId);
      }
      if (caseId) {
        await supabase.from("cases").delete().eq("id", caseId);
      }
      if (uploadedPath) {
        await supabase.storage.from("case-documents").remove([uploadedPath]);
      }
    } catch (cleanupError) {
      console.warn("Cleanup warning:", shortError(cleanupError));
    }
  }
}

main().catch((error) => {
  console.error("Azure OCR validation failed:", shortError(error));
  process.exitCode = 1;
});
