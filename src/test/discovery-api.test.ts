import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDiscoveryRequest,
  getDiscoveryRequests,
  getUpcomingDeadlines,
  updateDiscoveryRequest,
} from "@/lib/discovery-api";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe("discovery api mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates discovery request with snake_case payload and returns camelCase model", async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    } as never);

    const single = vi.fn().mockResolvedValue({
      data: {
        id: "req-1",
        case_id: "case-1",
        user_id: "user-1",
        request_type: "interrogatory",
        request_number: "INT-001",
        question: "Identify all witnesses.",
        response: null,
        objections: ["Relevance"],
        served_date: "2026-02-24",
        response_due_date: "2026-03-25",
        response_date: null,
        status: "pending",
        privilege_log_entry: false,
        notes: null,
        created_at: "2026-02-24T00:00:00.000Z",
        updated_at: "2026-02-24T00:00:00.000Z",
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    vi.mocked(supabase.from).mockReturnValue({ insert } as never);

    const result = await createDiscoveryRequest("case-1", {
      requestType: "interrogatory",
      requestNumber: "INT-001",
      question: "Identify all witnesses.",
      responseDueDate: "2026-03-25",
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        case_id: "case-1",
        user_id: "user-1",
        request_type: "interrogatory",
        request_number: "INT-001",
        response_due_date: "2026-03-25",
      })
    );
    expect(result.requestType).toBe("interrogatory");
    expect(result.requestNumber).toBe("INT-001");
    expect(result.responseDueDate).toBe("2026-03-25");
  });

  it("loads discovery requests ordered by snake_case due date and maps to camelCase", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: "req-1",
          case_id: "case-1",
          user_id: "user-1",
          request_type: "request_for_production",
          request_number: "RFP-001",
          question: "Produce all contracts.",
          response: null,
          objections: [],
          served_date: null,
          response_due_date: "2026-03-01",
          response_date: null,
          status: "pending",
          privilege_log_entry: false,
          notes: null,
          created_at: "2026-02-24T00:00:00.000Z",
          updated_at: "2026-02-24T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

    const rows = await getDiscoveryRequests("case-1");

    expect(order).toHaveBeenCalledWith("response_due_date", {
      ascending: true,
      nullsFirst: false,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].requestType).toBe("request_for_production");
    expect(rows[0].requestNumber).toBe("RFP-001");
    expect(rows[0].responseDueDate).toBe("2026-03-01");
  });

  it("updates discovery request with mapped snake_case fields", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "req-1",
        case_id: "case-1",
        user_id: "user-1",
        request_type: "interrogatory",
        request_number: "INT-001",
        question: "Identify all witnesses.",
        response: "Response text",
        objections: ["Relevance"],
        served_date: "2026-02-24",
        response_due_date: "2026-03-25",
        response_date: "2026-03-01",
        status: "draft",
        privilege_log_entry: true,
        notes: "updated",
        created_at: "2026-02-24T00:00:00.000Z",
        updated_at: "2026-02-24T00:00:00.000Z",
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ update } as never);

    const result = await updateDiscoveryRequest("req-1", {
      response: "Response text",
      responseDate: "2026-03-01",
      requestType: "interrogatory",
      requestNumber: "INT-001",
      privilegeLogEntry: true,
      status: "draft",
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        response: "Response text",
        response_date: "2026-03-01",
        request_type: "interrogatory",
        request_number: "INT-001",
        privilege_log_entry: true,
        status: "draft",
      })
    );
    expect(result.privilegeLogEntry).toBe(true);
    expect(result.status).toBe("draft");
  });

  it("loads upcoming deadlines from snake_case fields", async () => {
    const now = new Date();
    const due = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const dueDate = due.toISOString().slice(0, 10);

    const inFn = vi.fn().mockResolvedValue({
      data: [
        {
          id: "req-1",
          request_type: "interrogatory",
          request_number: "INT-001",
          served_date: now.toISOString().slice(0, 10),
          response_due_date: dueDate,
        },
      ],
      error: null,
    });
    const not = vi.fn().mockReturnValue({ in: inFn });
    const eq = vi.fn().mockReturnValue({ not });
    const select = vi.fn().mockReturnValue({ eq });
    vi.mocked(supabase.from).mockReturnValue({ select } as never);

    const deadlines = await getUpcomingDeadlines("case-1");

    expect(deadlines).toHaveLength(1);
    expect(deadlines[0].requestType).toBe("interrogatory");
    expect(deadlines[0].requestNumber).toBe("INT-001");
    expect(deadlines[0].dueDate).toBe(dueDate);
  });
});
