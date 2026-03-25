import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Dashboard from "@/pages/Dashboard";
import { getCases, getDocumentStats } from "@/lib/api";

vi.mock("@/components/Layout", () => ({
  Layout: ({ children }: React.PropsWithChildren) => <div data-testid="layout">{children}</div>,
}));

vi.mock("@/lib/api", () => ({
  getCases: vi.fn().mockResolvedValue([
    {
      id: "case-1",
      user_id: "user-1",
      name: "State v. Holloway",
      case_type: "criminal",
      client_name: "A. Holloway",
      status: "active",
      representation: "defendant",
      case_theory: null,
      key_issues: null,
      winning_factors: null,
      next_deadline: "2026-04-15T00:00:00Z",
      notes: null,
      created_at: "2026-03-01T00:00:00Z",
      updated_at: "2026-03-10T00:00:00Z",
    },
  ]),
  getDocumentStats: vi.fn().mockResolvedValue({ total: 24, analyzed: 18 }),
}));

function renderDashboard(): void {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}

const mockGetCases = vi.mocked(getCases);
const mockGetDocumentStats = vi.mocked(getDocumentStats);

describe("Dashboard page", () => {
  it("renders the strategy workspace shell", async () => {
    renderDashboard();

    expect(await screen.findByRole("heading", { name: /case strategy dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/source document: transcript_a1.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/judge's ruling patterns/i)).toBeInTheDocument();
    expect(screen.getByText(/cross-examine on the 03:00 timeline gap/i)).toBeInTheDocument();
  });

  it("switches to the witness tracker tab", async () => {
    renderDashboard();

    const tabButton = await screen.findByRole("button", { name: /witness tracker/i });
    fireEvent.click(tabButton);

    expect(screen.getByText(/witness reliability tracker/i)).toBeInTheDocument();
    expect(screen.getByText(/statement consistency/i)).toBeInTheDocument();
  });
  it("shows an honest empty state when there are no cases", async () => {
    mockGetCases.mockResolvedValueOnce([]);
    mockGetDocumentStats.mockResolvedValueOnce({ total: 0, analyzed: 0 });

    renderDashboard();

    expect(await screen.findByText(/no matters yet/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/case timeline events/i)).not.toBeInTheDocument();
    expect(screen.getByText(/build a case record to generate timeline-driven courtroom strategy recommendations/i)).toBeInTheDocument();
    expect(screen.getByText(/add a case with deadlines to populate the strategy queue/i)).toBeInTheDocument();
  });
});
