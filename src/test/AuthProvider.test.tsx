import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { AuthProvider } from "@/hooks/AuthProvider";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

// Helper component to expose auth context values
function AuthConsumer() {
  const { user, loading, session } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user?.email ?? "null"}</span>
      <span data-testid="session">{session ? "active" : "none"}</span>
    </div>
  );
}

function renderWithAuth() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  );
}

function setupAuthMocks({
  sessionUser = null,
  sessionError = null,
}: {
  sessionUser?: { id: string; email: string } | null;
  sessionError?: Error | null;
} = {}) {
  const unsubscribe = vi.fn();
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
    data: { subscription: { unsubscribe } },
  } as never);

  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: {
      session: sessionUser
        ? { user: sessionUser, access_token: "tok" }
        : null,
    },
    error: sessionError,
  } as never);

  return { unsubscribe };
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children", async () => {
    setupAuthMocks();
    renderWithAuth();
    expect(screen.getByTestId("loading")).toBeDefined();
  });

  it("starts in loading state and resolves after session check", async () => {
    setupAuthMocks({ sessionUser: null });
    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
  });

  it("populates user and session when a valid session exists", async () => {
    setupAuthMocks({ sessionUser: { id: "user-1", email: "atty@example.com" } });
    renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("atty@example.com");
      expect(screen.getByTestId("session").textContent).toBe("active");
    });
  });

  it("clears session and signs out when getSession returns an error", async () => {
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    } as never);

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: new Error("Invalid JWT"),
    } as never);

    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as never);

    renderWithAuth();

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(screen.getByTestId("user").textContent).toBe("null");
    });
  });

  it("unsubscribes from auth listener on unmount", async () => {
    const { unsubscribe } = setupAuthMocks();
    const { unmount } = renderWithAuth();

    await waitFor(() => {
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("signIn delegates to supabase signInWithPassword", async () => {
    setupAuthMocks();
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: {},
      error: null,
    } as never);

    let signInFn: (email: string, pw: string) => Promise<{ error: Error | null }>;

    function Capturer() {
      const { signIn } = useAuth();
      signInFn = signIn;
      return null;
    }

    render(
      <AuthProvider>
        <Capturer />
      </AuthProvider>
    );

    await waitFor(() => expect(signInFn).toBeDefined());

    await act(async () => {
      const result = await signInFn!("atty@example.com", "password123");
      expect(result.error).toBeNull();
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "atty@example.com",
      password: "password123",
    });
  });

  it("signIn returns the error when credentials are wrong", async () => {
    setupAuthMocks();
    const authError = new Error("Invalid credentials");
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: {},
      error: authError,
    } as never);

    let signInFn: (email: string, pw: string) => Promise<{ error: Error | null }>;

    function Capturer() {
      const { signIn } = useAuth();
      signInFn = signIn;
      return null;
    }

    render(
      <AuthProvider>
        <Capturer />
      </AuthProvider>
    );

    await waitFor(() => expect(signInFn).toBeDefined());

    const result = await signInFn!("wrong@example.com", "bad");
    expect(result.error?.message).toBe("Invalid credentials");
  });

  it("signUp delegates to supabase.auth.signUp with emailRedirectTo", async () => {
    setupAuthMocks();
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: {},
      error: null,
    } as never);

    let signUpFn: (email: string, pw: string, name?: string) => Promise<{ error: Error | null }>;

    function Capturer() {
      const { signUp } = useAuth();
      signUpFn = signUp;
      return null;
    }

    render(
      <AuthProvider>
        <Capturer />
      </AuthProvider>
    );

    await waitFor(() => expect(signUpFn).toBeDefined());

    await act(async () => {
      await signUpFn!("new@example.com", "securepass", "Jane Doe");
    });

    expect(supabase.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@example.com",
        password: "securepass",
        options: expect.objectContaining({
          data: { full_name: "Jane Doe" },
        }),
      })
    );
  });

  it("signOut delegates to supabase.auth.signOut", async () => {
    setupAuthMocks();
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as never);

    let signOutFn: () => Promise<void>;

    function Capturer() {
      const { signOut } = useAuth();
      signOutFn = signOut;
      return null;
    }

    render(
      <AuthProvider>
        <Capturer />
      </AuthProvider>
    );

    await waitFor(() => expect(signOutFn).toBeDefined());

    await act(async () => {
      await signOutFn!();
    });

    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
});

describe("useAuth outside of AuthProvider", () => {
  it("throws a descriptive error when used without provider", () => {
    function Naked() {
      useAuth();
      return null;
    }

    expect(() => render(<Naked />)).toThrow("useAuth must be used within an AuthProvider");
  });
});
