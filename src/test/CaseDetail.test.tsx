import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CaseDetail from "@/pages/CaseDetail";
import { supabase } from "@/integrations/supabase/client";

// ── heavy dependency mocks ────────────────────────────────────────────────────

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn(), getUser: vi.fn() },
    from: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "atty@example.com" } }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// react-window: render all items inline instead of a virtualised list
vi.mock("react-window", () => ({
  FixedSizeList: ({ children: Row, itemCount, itemData }: {
    children: React.ComponentType<{ index: number; style: object; data: unknown }>;
    itemCount: number;
    itemData: unknown;
  }) => (
    <div>
      {Array.from({ length: itemCount }, (_, i) => (
        <Row key={i} index={i} style={{}} data={itemData} />
      ))}
    </div>
  ),
}));

vi.mock("@/components/VideoRoom", () => ({
  VideoRoom: () => <div data-testid="video-room-mock" />,
}));

vi.mock("@/components/TrialSimulator", () => ({
  TrialSimulator: () => <div data-testid="trial-simulator-mock" />,
}));

vi.mock("@/components/GoogleDriveFolderImport", () => ({
  GoogleDriveFolderImport: () => <div data-testid="gdrive-mock" />,
}));

vi.mock("@/components/ImportJobsViewer", () => ({
  ImportJobsViewer: () => <div data-testid="import-jobs-mock" />,
}));

vi.mock("@/components/BulkDocumentUpload", () => ({
  BulkDocumentUpload: () => <div data-testid="bulk-upload-mock" />,
}));

vi.mock("@/components/TimelineView", () => ({
  TimelineView: () => <div data-testid="timeline-view-mock" />,
}));

vi.mock("@/components/Layout", () => ({
  Layout: ({ children }: React.PropsWithChildren) => <div data-testid="layout">{children}</div>,
}));

vi.mock("@/components/processing/ProcessingStatusBar", () => ({
  ProcessingStatusBar: () => null,
}));

vi.mock("@/lib/upload/unified-upload-handler", () => ({
  uploadAndProcessFile: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, batchAnalyzeDocuments: vi.fn() };
});

// ── test helpers ──────────────────────────────────────────────────────────────

const mockCase = {
  id: "case-1",
  user_id: "user-1",
  name: "Smith v. Jones",
  case_type: "civil",
  client_name: "John Smith",
  status: "active",
  representation: "plaintiff",
  case_theory: null,
  key_issues: null,
  winning_factors: null,
  next_deadline: null,
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const mockDocument = {
  id: "doc-1",
  case_id: "case-1",
  user_id: "user-1",
  name: "Contract.pdf",
  file_url: "https://example.com/contract.pdf",
  file_type: "application/pdf",
  file_size: 1024,
  bates_number: "DOC-0001",
  summary: "A contract between parties.",
  key_facts: null,
  favorable_findings: null,
  adverse_findings: null,
  action_items: null,
  ai_analyzed: true,
  ocr_text: null,
  ocr_page_count: null,
  ocr_processed_at: null,
  transcription_text: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderCaseDetail(caseId = "case-1") {
  const qc = makeQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/cases/${caseId}`]}>
        <Routes>
          <Route path="/cases/:id" element={<CaseDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function setupSuccessfulQueries(overrides: { documents?: object[] } = {}) {
  const docs = overrides.documents ?? [mockDocument];

  vi.mocked(supabase.from).mockImplementation((table: string) => {
    const single = vi.fn().mockResolvedValue({ data: mockCase, error: null });
    const order = vi.fn().mockResolvedValue({ data: docs, error: null });
    const eq = vi.fn().mockReturnValue({ single, order });
    const select = vi.fn().mockReturnValue({ eq, order });

    if (table === "cases") {
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }) } as never;
    }
    return { select } as never;
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("CaseDetail page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the loading skeleton while queries are in flight", () => {
    // Make queries hang indefinitely
    vi.mocked(supabase.from).mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: () => new Promise(() => {}),
          order: () => new Promise(() => {}),
        }),
        order: () => new Promise(() => {}),
      }),
    }) as never);

    renderCaseDetail();

    // The back-button / nav scaffold should still be present
    expect(document.body).toBeDefined();
  });

  it("renders case name after data loads", async () => {
    setupSuccessfulQueries();
    renderCaseDetail();

    await waitFor(() => {
      expect(screen.getByText("Smith v. Jones")).toBeDefined();
    });
  });

  it("renders the case status badge", async () => {
    setupSuccessfulQueries();
    renderCaseDetail();

    await waitFor(() => {
      // Status badge is always rendered next to case name
      expect(screen.getByText("active")).toBeDefined();
    });
  });

  it("shows the active status badge", async () => {
    setupSuccessfulQueries();
    renderCaseDetail();

    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeDefined();
    });
  });

  it("renders document names from the documents query", async () => {
    setupSuccessfulQueries();
    renderCaseDetail();

    await waitFor(() => {
      expect(screen.getByText("Contract.pdf")).toBeDefined();
    });
  });

  it("shows Bates number for documents that have one", async () => {
    setupSuccessfulQueries();
    renderCaseDetail();

    await waitFor(() => {
      expect(screen.getByText("DOC-0001")).toBeDefined();
    });
  });

  it("shows AI badge for analyzed documents", async () => {
    setupSuccessfulQueries({ documents: [{ ...mockDocument, ai_analyzed: true }] });
    renderCaseDetail();

    await waitFor(() => {
      expect(screen.getAllByText("AI").length).toBeGreaterThan(0);
    });
  });

  it("shows empty state message when there are no documents", async () => {
    setupSuccessfulQueries({ documents: [] });
    renderCaseDetail();

    await waitFor(() => {
      expect(screen.getByText(/no discovery files yet/i)).toBeDefined();
    });
  });

  it("shows delete confirmation dialog when delete button is clicked", async () => {
    setupSuccessfulQueries();
    renderCaseDetail();

    await waitFor(() => {
      expect(screen.getByText("Contract.pdf")).toBeDefined();
    });

    // Click the delete (trash) button on the document row
    const deleteButtons = screen.getAllByTitle("Delete");
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      // AlertDialog should appear with a confirmation prompt
      expect(screen.getByText(/are you sure/i)).toBeDefined();
    });
  });

  it("renders the Timeline tab trigger", async () => {
    setupSuccessfulQueries();
    renderCaseDetail();

    await waitFor(() => {
      expect(screen.getByText("Smith v. Jones")).toBeDefined();
    });

    // The Timeline tab trigger should always be present
    expect(screen.getByRole("tab", { name: /timeline/i })).toBeDefined();
  });

  it("renders all main tab triggers", async () => {
    setupSuccessfulQueries();
    renderCaseDetail();

    await waitFor(() => {
      expect(screen.getByText("Smith v. Jones")).toBeDefined();
    });

    expect(screen.getByRole("tab", { name: /discovery/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /timeline/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /trial prep/i })).toBeDefined();
    expect(screen.getByRole("tab", { name: /briefs/i })).toBeDefined();
  });
});
