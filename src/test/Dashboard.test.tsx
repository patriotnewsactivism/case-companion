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

const mockedGetCases = vi.mocked(getCases);
const mockedGetDocumentStats = vi.mocked(getDocumentStats);

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

describe("Dashboard page", () => {
  it("renders the strategy workspace shell", async () => {
    mockedGetCases.mockResolvedValue([
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
    ]);
    mockedGetDocumentStats.mockResolvedValue({ total: 24, analyzed: 18 });

    renderDashboard();

    expect(await screen.findByRole("heading", { name: /case strategy dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/case timeline summary/i)).toBeInTheDocument();
    expect(screen.getByText(/judge's ruling patterns/i)).toBeInTheDocument();
    expect(screen.getByText(/cross-examine on the 03:00 timeline gap/i)).toBeInTheDocument();
  });

  it("switches to the witness tracker tab", async () => {
    mockedGetCases.mockResolvedValue([
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
    ]);
    mockedGetDocumentStats.mockResolvedValue({ total: 24, analyzed: 18 });

    renderDashboard();

    const tabButton = await screen.findByRole("button", { name: /witness tracker/i });
    fireEvent.click(tabButton);

    expect(screen.getByText(/witness reliability tracker/i)).toBeInTheDocument();
    expect(screen.getByText(/statement consistency/i)).toBeInTheDocument();
  });

  it("shows an empty state instead of demo strategy content when no cases are returned", async () => {
    mockedGetCases.mockResolvedValue([]);
    mockedGetDocumentStats.mockResolvedValue({ total: 0, analyzed: 0 });

    renderDashboard();

    expect(await screen.findByText(/no active case timeline yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no case record loaded/i)).toBeInTheDocument();
    expect(screen.getByText(/insights waiting for case data/i)).toBeInTheDocument();
    expect(screen.queryByText(/cross-examine on the 03:00 timeline gap/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/judge's ruling patterns/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/source document: transcript_a1.pdf/i)).not.toBeInTheDocument();
  });
});
