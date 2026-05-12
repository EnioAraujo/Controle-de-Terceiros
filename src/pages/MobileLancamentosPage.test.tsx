import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MobileLancamentosPage from "./MobileLancamentosPage";

// ── Mocks ─────────────────────────────────────────────────────────
vi.mock("@/lib/supabase", () => {
  const chain = (result = { data: [], error: null }): Record<string, unknown> => {
    const p = Promise.resolve(result);
    return {
      select: () => chain(result),
      order: () => p,
      neq: () => chain(result),
      eq: () => chain(result),
      lt: () => chain(result),
      gte: () => chain(result),
      lte: () => chain(result),
      in: () => chain(result),
      single: () => p,
      maybeSingle: () => p,
      delete: () => chain(result),
      insert: () => chain(result),
      update: () => chain(result),
      upsert: () => chain(result),
      then: p.then.bind(p),
      catch: p.catch.bind(p),
    };
  };
  return {
    supabase: {
      from: () => chain(),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        refreshSession: vi.fn(),
        signOut: vi.fn(),
      },
    },
    authReady: Promise.resolve(),
  };
});

vi.mock("@/lib/audit", () => ({
  uuid: () => "test-id",
  sanitize: (v: string) => v,
  logAudit: vi.fn(),
}));

vi.mock("@/hooks/use-i18n", () => ({
  useI18n: () => ({ lang: "pt-BR", setLang: vi.fn(), t: (k: string) => k }),
}));

// ── Testes ────────────────────────────────────────────────────────
describe("MobileLancamentosPage (smoke)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderiza sem crash", () => {
    expect(() =>
      render(
        <MemoryRouter>
          <MobileLancamentosPage />
        </MemoryRouter>,
      ),
    ).not.toThrow();
  });

  it("exibe branding 'Controle de Terceiros'", () => {
    render(
      <MemoryRouter>
        <MobileLancamentosPage />
      </MemoryRouter>,
    );
    expect(screen.getByAltText("Controle de Terceiros")).toBeInTheDocument();
  });

  it("exibe status bar conectado", () => {
    render(
      <MemoryRouter>
        <MobileLancamentosPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Conectado")).toBeInTheDocument();
  });
});
