import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "./LoginPage";

// ── Mocks ─────────────────────────────────────────────────────────
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => {
      const p = Promise.resolve({ data: [], error: null });
      return { select: () => ({ order: () => p }), then: p.then.bind(p) };
    },
    rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
      mfa: {
        listFactors: vi.fn().mockResolvedValue({ data: { totp: [] }, error: null }),
        challenge: vi.fn(),
        verify: vi.fn(),
      },
    },
  },
  authReady: Promise.resolve(),
}));

vi.mock("@/lib/audit", () => ({
  uuid: () => "test-id",
  sanitize: (v: string) => v,
  logAudit: vi.fn(),
}));

vi.mock("@/hooks/use-i18n", () => ({
  useI18n: () => ({ lang: "pt-BR", setLang: vi.fn(), t: (k: string) => k }),
}));

// ── Testes ────────────────────────────────────────────────────────
describe("LoginPage (smoke)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderiza sem crash", () => {
    expect(() =>
      render(
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>,
      ),
    ).not.toThrow();
  });

  it("exibe título 'Controle de Terceiros'", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Controle de Terceiros")).toBeInTheDocument();
  });

  it("exibe seleção de dispositivo (Mobile / Desktop)", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Mobile")).toBeInTheDocument();
    expect(screen.getByText("Desktop")).toBeInTheDocument();
  });

  it("exibe seletor de idioma", () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Português")).toBeInTheDocument();
  });
});
