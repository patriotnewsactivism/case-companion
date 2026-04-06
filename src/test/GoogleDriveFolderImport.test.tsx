import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { GoogleDriveFolderImport } from "@/components/GoogleDriveFolderImport";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" } } } }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { importJobId: "job-1" }, error: null }),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/lib/googleDrive", () => ({
  loadGoogleAPI: vi.fn().mockResolvedValue(undefined),
  getGoogleAccessToken: vi.fn().mockResolvedValue("token-123"),
  listGoogleDriveFolders: vi
    .fn()
    .mockResolvedValue([{ id: "folder-1", name: "Exhibits", isFolder: true }]),
  countFilesInFolder: vi.fn().mockResolvedValue({ total: 3, documents: 2, audio: 0, video: 0, images: 1 }),
}));

describe("GoogleDriveFolderImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets the user browse folders without a picker key and choose one", async () => {
    render(<GoogleDriveFolderImport caseId="case-1" />);

    fireEvent.click(screen.getByRole("button", { name: /import from google drive/i }));
    const browseButton = await screen.findByRole("button", { name: /browse google drive folders/i });
    fireEvent.click(browseButton);

    expect(await screen.findByText("Current location")).toBeInTheDocument();
    expect(screen.getByText("Exhibits")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /choose/i }));

    await waitFor(() => {
      expect(screen.getByText("Selected")).toBeInTheDocument();
      expect(screen.getByText(/total: 3 files/i)).toBeInTheDocument();
    });
  });
});
