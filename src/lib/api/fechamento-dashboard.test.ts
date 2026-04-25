import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  selecionarFechamentosAprovadosCanonicos,
  buscarResumoFechamentosSalvosPorPeriodo,
  type FechamentoAprovadoCabecalho,
} from "./fechamento-dashboard";

describe("selecionarFechamentosAprovadosCanonicos", () => {
  it("mantem somente fechamentos do periodo e escolhe a versao mais recente por fornecedor+periodo", () => {
    const base: FechamentoAprovadoCabecalho[] = [
      {
        id: "f-antigo",
        fornecedor: "LIDER MASTER",
        data_inicio: "2026-04-11",
        data_fim: "2026-04-20",
        updated_at: "2026-04-20T10:00:00Z",
        created_at: "2026-04-20T09:00:00Z",
      },
      {
        id: "f-recente",
        fornecedor: "LIDER MASTER",
        data_inicio: "2026-04-11",
        data_fim: "2026-04-20",
        updated_at: "2026-04-20T12:00:00Z",
        created_at: "2026-04-20T11:00:00Z",
      },
      {
        id: "f-fora-intervalo",
        fornecedor: "JSS",
        data_inicio: "2026-03-01",
        data_fim: "2026-03-10",
        updated_at: "2026-03-10T10:00:00Z",
        created_at: "2026-03-10T09:00:00Z",
      },
      {
        id: "f-jss",
        fornecedor: "JSS",
        data_inicio: "2026-04-11",
        data_fim: "2026-04-20",
        updated_at: "2026-04-20T08:00:00Z",
        created_at: "2026-04-20T07:00:00Z",
      },
    ];

    const result = selecionarFechamentosAprovadosCanonicos(base, "2026-04-01", "2026-04-30");

    expect(result).toHaveLength(2);
    expect(result.map((f) => f.id).sort()).toEqual(["f-jss", "f-recente"]);
  });
});

// ── buscarResumoFechamentosSalvosPorPeriodo ──────────────────────────────────

vi.mock("@/lib/supabase", () => {
  const builder = {
    select: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  return { supabase: { from: vi.fn(() => builder) }, authReady: Promise.resolve() };
});

const getBuilder = async () => {
  const mod = await import("@/lib/supabase");
  const from = mod.supabase.from as ReturnType<typeof vi.fn>;
  return from.mock.results[from.mock.results.length - 1]?.value as {
    select: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
  };
};

describe("buscarResumoFechamentosSalvosPorPeriodo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna total e count para multiplos fechamentos", async () => {
    const rows = [
      { valor_total: 1000 },
      { valor_total: 2000 },
      { valor_total: 500 },
    ];

    const { supabase: sb } = await import("@/lib/supabase");
    const from = sb.from as ReturnType<typeof vi.fn>;
    from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ data: rows, error: null }),
    });

    const result = await buscarResumoFechamentosSalvosPorPeriodo("2026-04-01", "2026-04-30");

    expect(result.success).toBe(true);
    expect(result.data?.total).toBe(3500);
    expect(result.data?.count).toBe(3);
  });

  it("retorna zeros quando nao ha fechamentos no periodo", async () => {
    const { supabase: sb } = await import("@/lib/supabase");
    const from = sb.from as ReturnType<typeof vi.fn>;
    from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const result = await buscarResumoFechamentosSalvosPorPeriodo("2026-04-01", "2026-04-30");

    expect(result.success).toBe(true);
    expect(result.data?.total).toBe(0);
    expect(result.data?.count).toBe(0);
  });

  it("retorna error quando supabase falha", async () => {
    const { supabase: sb } = await import("@/lib/supabase");
    const from = sb.from as ReturnType<typeof vi.fn>;
    from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gte: vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } }),
    });

    const result = await buscarResumoFechamentosSalvosPorPeriodo("2026-04-01", "2026-04-30");

    expect(result.success).toBe(false);
    expect(result.error).toBe("DB error");
  });
});
