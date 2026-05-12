import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useTerceirosDoFornecedor } from "./useTerceirosDoFornecedor";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
  authReady: Promise.resolve(),
}));

vi.mock("@/hooks/useFornecedorAtual", () => ({
  useFornecedorAtual: () => ({ fornecedor: "ACME", isFornecedorUser: true, loading: false }),
}));

const mockFrom = vi.mocked(supabase.from);
const TIMEOUT = { timeout: 8000 };

interface QueryResult { data: { id: number; nome: string; cargo: string; fornecedor: string }[] | null; error: { message: string } | null }

function mockSelect(result: () => Promise<QueryResult>) {
  const eq = vi.fn(() => result());
  const select = vi.fn(() => ({ eq }));
  mockFrom.mockReturnValue({ select } as unknown as ReturnType<typeof supabase.from>);
  return { select, eq };
}

describe("useTerceirosDoFornecedor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reload sucesso popula pessoas e zera erro", async () => {
    mockSelect(() => Promise.resolve({
      data: [{ id: 1, nome: "Ana", cargo: "Op", fornecedor: "ACME" }],
      error: null,
    }));
    const { result } = renderHook(() => useTerceirosDoFornecedor());
    await waitFor(() => expect(result.current.loading).toBe(false), TIMEOUT);
    expect(result.current.pessoas).toHaveLength(1);
    expect(result.current.pessoas[0].nome).toBe("Ana");
    expect(result.current.error).toBeNull();
  });

  it("retry-then-success: 1ª falha, 2ª sucesso", async () => {
    let calls = 0;
    const { eq } = mockSelect(() => {
      calls++;
      if (calls === 1) return Promise.resolve({ data: null, error: { message: "rede" } });
      return Promise.resolve({
        data: [{ id: 2, nome: "Bia", cargo: "Tec", fornecedor: "ACME" }],
        error: null,
      });
    });
    const { result } = renderHook(() => useTerceirosDoFornecedor());
    await waitFor(() => expect(result.current.loading).toBe(false), TIMEOUT);
    expect(eq).toHaveBeenCalledTimes(2);
    expect(result.current.pessoas).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it("falha persistente: mantém último snapshot + error setado", async () => {
    let calls = 0;
    mockSelect(() => {
      calls++;
      if (calls === 1) {
        return Promise.resolve({
          data: [{ id: 1, nome: "Ana", cargo: "Op", fornecedor: "ACME" }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: "queda" } });
    });
    const { result } = renderHook(() => useTerceirosDoFornecedor());
    await waitFor(() => expect(result.current.pessoas).toHaveLength(1), TIMEOUT);

    await act(async () => { await result.current.retry(); });

    expect(result.current.pessoas).toHaveLength(1);
    expect(result.current.error).toBe("queda");
  });

  it("retry() limpa erro quando sucede", async () => {
    let calls = 0;
    mockSelect(() => {
      calls++;
      if (calls <= 3) return Promise.resolve({ data: null, error: { message: "rede" } });
      return Promise.resolve({
        data: [{ id: 9, nome: "Caio", cargo: "X", fornecedor: "ACME" }],
        error: null,
      });
    });
    const { result } = renderHook(() => useTerceirosDoFornecedor());
    await waitFor(() => expect(result.current.error).toBe("rede"), TIMEOUT);

    await act(async () => { await result.current.retry(); });

    expect(result.current.error).toBeNull();
    expect(result.current.pessoas[0].nome).toBe("Caio");
  });
});
