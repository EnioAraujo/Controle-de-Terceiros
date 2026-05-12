import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useFornecedorAtual } from "./useFornecedorAtual";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn() },
}));

// User estável (referência fixa) — ID trocado no beforeEach para evitar reuso do cache de módulo.
const authState: { user: { id: string; email: string } } = {
  user: { id: "user-fornecedor-default", email: "f@x.com" },
};
vi.mock("@/hooks/useAuthStatus", () => ({
  useAuthStatus: () => ({
    user: authState.user,
    isAuthenticated: true,
    session: null,
    loading: false,
    tokenExpired: false,
    isBlocked: false,
    isApproved: true,
    error: null,
    refreshSession: vi.fn(),
    signOut: vi.fn(),
  }),
}));

const mockFrom = vi.mocked(supabase.from);

function setupFetch(impl: () => Promise<{ data: unknown; error: unknown }>) {
  const single = vi.fn(impl);
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  mockFrom.mockReturnValue({ select } as ReturnType<typeof supabase.from>);
  return { single };
}

describe("useFornecedorAtual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: `user-${Math.random().toString(36).slice(2)}`, email: "f@x.com" };
  });

  it("retorna fornecedor após fetch bem-sucedido", async () => {
    setupFetch(() => Promise.resolve({ data: { fornecedor: "ACME" }, error: null }));
    const { result } = renderHook(() => useFornecedorAtual());
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });
    expect(result.current.fornecedor).toBe("ACME");
    expect(result.current.isFornecedorUser).toBe(true);
  });

  it("retry com backoff: 1ª falha, 2ª sucesso", async () => {
    let calls = 0;
    const { single } = setupFetch(() => {
      calls++;
      if (calls === 1) return Promise.resolve({ data: null, error: { message: "rede" } });
      return Promise.resolve({ data: { fornecedor: "ACME" }, error: null });
    });
    const { result } = renderHook(() => useFornecedorAtual());
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });
    expect(single).toHaveBeenCalledTimes(2);
    expect(result.current.fornecedor).toBe("ACME");
  });

  it("falha persistente após 3 tentativas: fornecedor=null, sem bloquear", async () => {
    setupFetch(() => Promise.resolve({ data: null, error: { message: "rede" } }));
    const { result } = renderHook(() => useFornecedorAtual());
    await waitFor(() => expect(result.current.loading).toBe(false), { timeout: 5000 });
    expect(result.current.fornecedor).toBeNull();
    expect(result.current.isFornecedorUser).toBe(false);
  });
});
