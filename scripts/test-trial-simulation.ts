import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

type TrialMode =
  | "cross-examination"
  | "direct-examination"
  | "opening-statement"
  | "closing-argument"
  | "deposition"
  | "motion-hearing"
  | "objections-practice"
  | "voir-dire"
  | "evidence-foundation"
  | "deposition-prep";

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

interface TrialScenario {
  mode: TrialMode;
  prompt: string;
}

const scenarios: TrialScenario[] = [
  { mode: "cross-examination", prompt: "You testified the contract was finalized before April, correct?" },
  { mode: "direct-examination", prompt: "Please describe what you observed when you arrived at the site." },
  { mode: "opening-statement", prompt: "Help me sharpen this opening to emphasize credibility and timeline." },
  { mode: "closing-argument", prompt: "Give me feedback on tying each element to the strongest evidence." },
  { mode: "deposition", prompt: "Did you review the invoice records before giving this statement?" },
  { mode: "motion-hearing", prompt: "What authority should I lead with for a targeted evidentiary ruling?" },
  { mode: "objections-practice", prompt: "Start an objections drill focused on hearsay and speculation." },
  { mode: "voir-dire", prompt: "How should I ask about implicit bias and ability to follow instructions?" },
  { mode: "evidence-foundation", prompt: "Walk me through laying foundation for an authenticated business record." },
  { mode: "deposition-prep", prompt: "Generate strategic preparation questions tied to documentary impeachment." },
];

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

  const email = `trial.sim.${Date.now()}@example.com`;
  const password = "TrialSimTest!12345";
  let caseId: string | null = null;

  try {
    const signUp = await supabase.auth.signUp({ email, password });
    if (signUp.error || !signUp.data.user || !signUp.data.session) {
      throw new Error(signUp.error?.message || "Failed to authenticate trial simulation test user");
    }

    const userId = signUp.data.user.id;
    const accessToken = signUp.data.session.access_token;
    logStep(results, "Auth", "pass", `Signed in as temporary user ${userId}`);

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
        name: `Trial Simulation Test Case ${Date.now()}`,
        case_type: "Litigation",
        client_name: "Trial Simulation Client",
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

    for (const scenario of scenarios) {
      const response = await invokeFunction("trial-simulation", {
        caseId,
        mode: scenario.mode,
        messages: [{ role: "user", content: scenario.prompt }],
      });

      const label = `Mode: ${scenario.mode}`;
      if (!response.ok) {
        logStep(results, label, "fail", `HTTP ${response.status}: ${response.message}`);
        continue;
      }

      const payload = response.data as {
        message?: string;
        coaching?: string | null;
        objectionTypes?: unknown[];
      };

      const message = String(payload?.message || "");
      const coaching = String(payload?.coaching || "");
      const naturalFormat = message.length > 60 && !/[*#]{2,}/.test(message) && !/^\{[\s\S]*\}$/.test(message.trim());

      if (!naturalFormat) {
        logStep(results, label, "warn", `responseLength=${message.length}, naturalFormat=false`);
        continue;
      }

      if (scenario.mode === "objections-practice") {
        const objectionTypesCount = Array.isArray(payload?.objectionTypes) ? payload.objectionTypes.length : 0;
        if (objectionTypesCount === 0) {
          logStep(results, label, "warn", "objectionTypes missing in response");
          continue;
        }
        logStep(
          results,
          label,
          "pass",
          `responseLength=${message.length}, coaching=${coaching.length > 0}, objectionTypes=${objectionTypesCount}`
        );
        continue;
      }

      logStep(
        results,
        label,
        "pass",
        `responseLength=${message.length}, coaching=${coaching.length > 0}, naturalFormat=true`
      );
    }
  } finally {
    try {
      if (caseId) {
        await supabase.from("cases").delete().eq("id", caseId);
      }
    } catch (cleanupError) {
      console.warn("Cleanup warning:", shortError(cleanupError));
    }
  }

  const passCount = results.filter((result) => result.status === "pass").length;
  const warnCount = results.filter((result) => result.status === "warn").length;
  const failCount = results.filter((result) => result.status === "fail").length;

  console.log("\n--- Trial Simulation Summary ---");
  console.log(`Passed: ${passCount}`);
  console.log(`Warnings: ${warnCount}`);
  console.log(`Failed: ${failCount}`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Trial simulation test crashed:", shortError(error));
  process.exitCode = 1;
});
