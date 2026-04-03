import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MobileLancamentosPage from "./MobileLancamentosPage";

// ── Mocks ─────────────────────────────────────────────────────────
vi.mock("@/lib/supabase", () => {
  const chain = (result = { data: [], error: null }) => ({
    select: () => chain(result),
    order: () => Promise.resolve(result),
    neq: () => chain(result),
    eq: () => chain(result),
    lt: () => chain(result),
    single: () => Promise.resolve(result),
  });
  return {
    supabase: { from: () => chain(), auth: { getSession: vi.fn() } },
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
    expect(screen.getByText("Controle de")).toBeInTheDocument();
    expect(screen.getByText("Terceiros")).toBeInTheDocument();
  });

  it("exibe badge Mobile", () => {
    render(
      <MemoryRouter>
        <MobileLancamentosPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Mobile")).toBeInTheDocument();
  });
});
