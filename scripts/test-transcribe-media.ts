import dotenv from "dotenv";
import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

type StepStatus = "pass" | "warn" | "fail";

interface StepResult {
  name: string;
  status: StepStatus;
  detail: string;
}

interface FunctionInvokeResult {
  ok: boolean;
  status: number;
  data: unknown;
  message: string;
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

function ensureSpeechWavExists(wavPath: string): void {
  if (existsSync(wavPath)) {
    return;
  }

  if (process.platform !== "win32") {
    throw new Error(`Missing ${wavPath}. Auto-generation is only supported on Windows.`);
  }

  const escapedPath = wavPath.replace(/'/g, "''");
  const speechCommand = [
    "Add-Type -AssemblyName System.Speech",
    "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    `$synth.SetOutputToWaveFile('${escapedPath}')`,
    "$synth.Speak('This is a CaseBuddy transcription integration test. The witness confirmed the contract was signed on February twenty fourth twenty twenty six.')",
    "$synth.Dispose()",
  ].join("; ");

  execFileSync("powershell", ["-NoProfile", "-Command", speechCommand], {
    stdio: "pipe",
  });

  if (!existsSync(wavPath)) {
    throw new Error(`Failed to generate ${wavPath}`);
  }
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const wavPath = "scripts/tmp-transcribe.wav";

  if (!supabaseUrl || !anonKey) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in environment");
  }

  ensureSpeechWavExists(wavPath);

  const wavBuffer = readFileSync(wavPath);
  if (wavBuffer.length === 0) {
    throw new Error(`${wavPath} is empty`);
  }

  const results: StepResult[] = [];
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const email = `transcribe.${Date.now()}@example.com`;
  const password = "TranscribeTest!12345";

  let caseId: string | null = null;
  let documentId: string | null = null;
  let uploadedPath: string | null = null;

  try {
    const signUp = await supabase.auth.signUp({ email, password });
    if (signUp.error || !signUp.data.user || !signUp.data.session) {
      throw new Error(signUp.error?.message || "Failed to authenticate transcription test user");
    }
    logStep(results, "Auth", "pass", `Signed in as temporary user ${signUp.data.user.id}`);

    const userId = signUp.data.user.id;
    const accessToken = signUp.data.session.access_token;

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
        name: `Transcribe Test Case ${Date.now()}`,
        case_type: "Litigation",
        client_name: "Transcribe Client",
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

    uploadedPath = `${userId}/${caseId}/transcribe-${Date.now()}.wav`;
    const uploadBlob = new Blob([wavBuffer], { type: "audio/wav" });

    const { data: storageData, error: storageError } = await supabase.storage
      .from("case-documents")
      .upload(uploadedPath, uploadBlob, {
        cacheControl: "3600",
        upsert: false,
      });

    if (storageError || !storageData) {
      throw new Error(storageError?.message || "Failed to upload media file");
    }
    logStep(results, "Upload", "pass", `Uploaded audio to ${storageData.path}`);

    const {
      data: { publicUrl },
    } = supabase.storage.from("case-documents").getPublicUrl(storageData.path);

    const { data: docData, error: docError } = await supabase
      .from("documents")
      .insert({
        case_id: caseId,
        user_id: userId,
        name: "transcribe-test.wav",
        file_url: publicUrl,
        file_type: "audio/wav",
        file_size: wavBuffer.length,
      })
      .select()
      .single();

    if (docError || !docData) {
      throw new Error(docError?.message || "Failed to create document record");
    }
    documentId = docData.id;
    logStep(results, "Document Record", "pass", `Created document ${documentId}`);

    const transcribeInvoke = await invokeFunction("transcribe-media", { documentId });
    if (!transcribeInvoke.ok) {
      logStep(
        results,
        "Transcribe Invoke",
        "fail",
        `HTTP ${transcribeInvoke.status}: ${transcribeInvoke.message}`
      );
    } else {
      const payload = transcribeInvoke.data as { transcriptionLength?: number; duration?: number };
      logStep(
        results,
        "Transcribe Invoke",
        "pass",
        `transcriptionLength=${payload?.transcriptionLength ?? 0}, duration=${payload?.duration ?? 0}s`
      );
    }

    const { data: updatedDoc, error: updatedDocError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (updatedDocError || !updatedDoc) {
      logStep(results, "Transcription Persistence", "warn", updatedDocError?.message || "Document fetch failed");
    } else {
      const docRecord = updatedDoc as Record<string, unknown>;
      const transcriptionText =
        (typeof docRecord.transcription_text === "string" ? docRecord.transcription_text : "") ||
        (typeof docRecord.transcription === "string" ? docRecord.transcription : "");
      if (transcriptionText.length > 0) {
        logStep(results, "Transcription Persistence", "pass", `transcription_text=${transcriptionText.length} chars`);
      } else {
        logStep(
          results,
          "Transcription Persistence",
          "warn",
          "No transcription_text field found or field is empty in this schema"
        );
      }
    }
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

  const passCount = results.filter((result) => result.status === "pass").length;
  const warnCount = results.filter((result) => result.status === "warn").length;
  const failCount = results.filter((result) => result.status === "fail").length;

  console.log("\n--- Transcription Summary ---");
  console.log(`Passed: ${passCount}`);
  console.log(`Warnings: ${warnCount}`);
  console.log(`Failed: ${failCount}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Transcription test crashed:", shortError(error));
  process.exitCode = 1;
});
