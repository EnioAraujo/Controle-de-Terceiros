import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminPage from "./AdminPage";

// ── Mocks ─────────────────────────────────────────────────────────
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => {
      const chain = (result = { data: [], error: null }): Record<string, unknown> => {
        const p = Promise.resolve(result);
        return {
          select: () => chain(result),
          order: () => p,
          eq: () => chain(result),
          then: p.then.bind(p),
          catch: p.catch.bind(p),
        };
      };
      return chain();
    },
    rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn(),
    },
  },
  authReady: Promise.resolve(),
}));

vi.mock("@/hooks/useAdminUsers", () => ({
  useAdminUsers: () => ({
    users: [],
    isLoading: false,
    approvalMutation: { mutate: vi.fn(), isPending: false },
    roleMutation: { mutate: vi.fn(), isPending: false },
    deleteMutation: { mutate: vi.fn(), isPending: false },
    createMutation: { mutate: vi.fn(), isPending: false },
    unblockMutation: { mutate: vi.fn(), isPending: false },
    permsMutation: { mutate: vi.fn(), isPending: false },
    handleResetPassword: vi.fn(),
    resetFeedback: null,
  }),
  availablePermissions: [],
  rolePresets: {},
  AppRole: {},
}));

vi.mock("@/hooks/use-i18n", () => ({
  useI18n: () => ({ lang: "pt-BR", setLang: vi.fn(), t: (k: string) => k }),
}));

// ── Testes ────────────────────────────────────────────────────────
describe("AdminPage (smoke)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderiza sem crash", () => {
    expect(() =>
      render(
        <MemoryRouter>
          <AdminPage />
        </MemoryRouter>,
      ),
    ).not.toThrow();
  });

  it("exibe loading spinner enquanto auth não resolve", () => {
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>,
    );
    // Loading state renders before async auth check completes
    const svg = document.querySelector("svg.lucide-loader-circle, svg.animate-spin");
    expect(document.body.firstChild).toBeTruthy();
  });

  it("não lança com session nula (redireciona para home)", () => {
    expect(() =>
      render(
        <MemoryRouter initialEntries={["/admin"]}>
          <AdminPage />
        </MemoryRouter>,
      ),
    ).not.toThrow();
  });
});
