import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

type StepStatus = "pass" | "warn" | "fail";

interface StepResult {
  name: string;
  status: StepStatus;
  detail: string;
}

function logStep(results: StepResult[], name: string, status: StepStatus, detail: string): void {
  results.push({ name, status, detail });
  const icon = status === "pass" ? "PASS" : status === "warn" ? "WARN" : "FAIL";
  console.log(`[${icon}] ${name}: ${detail}`);
}

function shortError(err: unknown): string {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return JSON.stringify(err);
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in environment");
  }

  const results: StepResult[] = [];
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const email = `smoke.${Date.now()}@example.com`;
  const password = "SmokeTest!12345";

  let caseId: string | null = null;
  let documentId: string | null = null;
  let uploadedPath: string | null = null;

  try {
    const signUp = await supabase.auth.signUp({ email, password });
    if (signUp.error || !signUp.data.user || !signUp.data.session) {
      throw new Error(signUp.error?.message || "Failed to authenticate smoke test user");
    }
    logStep(results, "Auth", "pass", `Signed in as temporary user ${signUp.data.user.id}`);

    const userId = signUp.data.user.id;
    const accessToken = signUp.data.session.access_token;

    const invokeFunction = async (name: string, body: Record<string, unknown>) => {
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
        // Keep plain text payload
      }

      const parsedRecord = parsed as Record<string, unknown>;
      const message =
        String(parsedRecord?.error || parsedRecord?.message || rawText || `HTTP ${response.status}`);

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
        name: `Smoke Test Case ${Date.now()}`,
        case_type: "Litigation",
        client_name: "Smoke Client",
        status: "active",
        representation: "plaintiff",
      })
      .select()
      .single();

    if (caseError || !caseData) {
      throw new Error(caseError?.message || "Failed to create case");
    }
    caseId = caseData.id;
    logStep(results, "Case Creation", "pass", `Created case ${caseId}`);

    const textContent = `SMOKE TEST DOCUMENT\nDate: ${new Date().toISOString()}\nThis text should be extracted by OCR pipeline.`;
    uploadedPath = `${userId}/${caseId}/smoke-${Date.now()}.txt`;
    const uploadBlob = new Blob([textContent], { type: "text/plain" });

    const { data: storageData, error: storageError } = await supabase.storage
      .from("case-documents")
      .upload(uploadedPath, uploadBlob, {
        cacheControl: "3600",
        upsert: false,
      });

    if (storageError || !storageData) {
      throw new Error(storageError?.message || "Failed to upload document");
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("case-documents").getPublicUrl(storageData.path);
    logStep(results, "Upload", "pass", `Uploaded document to storage path ${storageData.path}`);

    const { data: docData, error: docError } = await supabase
      .from("documents")
      .insert({
        case_id: caseId,
        user_id: userId,
        name: "smoke-test.txt",
        file_url: publicUrl,
        file_type: "text/plain",
        file_size: textContent.length,
      })
      .select()
      .single();

    if (docError || !docData) {
      throw new Error(docError?.message || "Failed to create document record");
    }
    documentId = docData.id;
    logStep(results, "Document Record", "pass", `Created document ${documentId}`);

    const ocrInvoke = await invokeFunction("ocr-document", {
      documentId,
      fileUrl: publicUrl,
    });

    if (!ocrInvoke.ok) {
      logStep(results, "OCR Invoke", "fail", `HTTP ${ocrInvoke.status}: ${ocrInvoke.message}`);
    } else {
      const ocrResult = ocrInvoke.data as { textLength?: number; ocrProvider?: string; hasAnalysis?: boolean };
      logStep(
        results,
        "OCR Invoke",
        "pass",
        `textLength=${ocrResult?.textLength ?? 0}, provider=${ocrResult?.ocrProvider ?? "unknown"}`
      );
    }

    const { data: updatedDoc, error: updatedDocError } = await supabase
      .from("documents")
      .select("ocr_text, summary, key_facts, ai_analyzed")
      .eq("id", documentId)
      .maybeSingle();

    if (updatedDocError || !updatedDoc) {
      logStep(results, "OCR Data Propagation", "fail", updatedDocError?.message || "Document fetch failed");
    } else {
      const extractedLen = String(updatedDoc.ocr_text || "").length;
      const hasSummary = Boolean(updatedDoc.summary);
      const hasFacts = Array.isArray(updatedDoc.key_facts) && updatedDoc.key_facts.length > 0;
      if (extractedLen > 0) {
        logStep(
          results,
          "OCR Data Propagation",
          "pass",
          `ocr_text=${extractedLen} chars, summary=${hasSummary}, key_facts=${hasFacts}`
        );
      } else {
        logStep(results, "OCR Data Propagation", "fail", "No OCR text was persisted to documents table");
      }
    }

    const trialInvoke = await invokeFunction("trial-simulation", {
      caseId,
      mode: "deposition",
      messages: [{ role: "user", content: "Please state your name for the record." }],
    });

    if (!trialInvoke.ok) {
      logStep(results, "Trial Simulation", "fail", `HTTP ${trialInvoke.status}: ${trialInvoke.message}`);
    } else {
      const message = String((trialInvoke.data as { message?: string })?.message || "");
      const looksNatural = !/[*#-]{2,}|^\d+\./m.test(message);
      logStep(
        results,
        "Trial Simulation",
        looksNatural ? "pass" : "warn",
        `responseLength=${message.length}, naturalFormat=${looksNatural}`
      );
    }

    const createRoom = await invokeFunction("create-video-room", {
      caseId,
      name: `Smoke Video Room ${Date.now()}`,
      enableRecording: true,
      expiresInMinutes: 30,
    });

    if (!createRoom.ok) {
      const detail = `HTTP ${createRoom.status}: ${createRoom.message}`;
      const status: StepStatus = createRoom.status === 404 ? "fail" : "warn";
      logStep(results, "Video Create Room", status, detail);
    } else {
      const roomData = createRoom.data as { roomName?: string; roomId?: string };
      logStep(results, "Video Create Room", "pass", `Created room ${roomData?.roomName || "unknown"}`);

      if (roomData?.roomName && roomData?.roomId) {
        const joinRoom = await invokeFunction("join-video-room", {
          roomId: roomData.roomId,
          roomName: roomData.roomName,
          userName: "Smoke Tester",
        });

        if (!joinRoom.ok) {
          logStep(results, "Video Join Room", "warn", `HTTP ${joinRoom.status}: ${joinRoom.message}`);
        } else {
          logStep(results, "Video Join Room", "pass", "Join token issued successfully");
        }
      } else {
        logStep(results, "Video Join Room", "warn", "Create room response did not include roomId/roomName");
      }
    }

    const transcribe = await invokeFunction("transcribe-media", { documentId });

    if (!transcribe.ok) {
      const detail = `HTTP ${transcribe.status}: ${transcribe.message}`;
      const status: StepStatus = transcribe.status === 404
        ? "fail"
        : detail.includes("not audio or video")
          ? "pass"
          : "warn";
      logStep(results, "Transcribe Media Endpoint", status, detail);
    } else {
      logStep(results, "Transcribe Media Endpoint", "pass", "Function invoked successfully");
    }
  } finally {
    // Best-effort cleanup so smoke runs do not pollute user data.
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

  const passCount = results.filter((r) => r.status === "pass").length;
  const warnCount = results.filter((r) => r.status === "warn").length;
  const failCount = results.filter((r) => r.status === "fail").length;

  console.log("\n--- Smoke Summary ---");
  console.log(`Passed: ${passCount}`);
  console.log(`Warnings: ${warnCount}`);
  console.log(`Failed: ${failCount}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Smoke test crashed:", shortError(error));
  process.exitCode = 1;
});
