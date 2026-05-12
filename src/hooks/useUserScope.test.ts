import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useUserScope } from "./useUserScope";
import { supabase } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: vi.fn(), from: vi.fn() },
}));

// Estado estável compartilhado entre renders — evita recriar `user` e
// disparar o effect em loop.
const authState: { user: { id: string; email: string } } = {
  user: { id: "user-default", email: "a@x.com" },
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

vi.mock("@/hooks/useFornecedorAtual", () => ({
  useFornecedorAtual: () => ({ fornecedor: null, isFornecedorUser: false, loading: false }),
}));

const mockRpc = vi.mocked(supabase.rpc);
const TIMEOUT = { timeout: 5000 };

describe("useUserScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ID único por teste — evita reuso do adminCache (estado de módulo).
    authState.user = { id: `user-${Math.random().toString(36).slice(2)}`, email: "a@x.com" };
  });

  it("RPC sucesso → isAdmin=true e sem erro", async () => {
    mockRpc.mockResolvedValue({ data: true, error: null } as unknown as ReturnType<typeof supabase.rpc>);
    const { result } = renderHook(() => useUserScope());
    await waitFor(() => expect(result.current.loading).toBe(false), TIMEOUT);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.adminCheckError).toBe(false);
  });

  it("RPC erro persistente: isAdmin=false (fail-closed) + adminCheckError=true, sem cachear", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "rede" } } as unknown as ReturnType<typeof supabase.rpc>);
    const { result, unmount } = renderHook(() => useUserScope());
    await waitFor(() => expect(result.current.adminCheckError).toBe(true), TIMEOUT);
    expect(result.current.isAdmin).toBe(false);
    expect(mockRpc).toHaveBeenCalledTimes(3); // 3 retries com backoff

    unmount();
    mockRpc.mockResolvedValue({ data: true, error: null } as unknown as ReturnType<typeof supabase.rpc>);
    const { result: r2 } = renderHook(() => useUserScope());
    await waitFor(() => expect(r2.current.loading).toBe(false), TIMEOUT);
    expect(r2.current.isAdmin).toBe(true);
    // +1 chamada: erro não foi cacheado
    expect(mockRpc).toHaveBeenCalledTimes(4);
  });

  it("retry-then-success: 1ª falha, 2ª sucesso", async () => {
    let calls = 0;
    mockRpc.mockImplementation((() => {
      calls++;
      if (calls === 1) return Promise.resolve({ data: null, error: { message: "rede" } });
      return Promise.resolve({ data: true, error: null });
    }) as unknown as typeof supabase.rpc);
    const { result } = renderHook(() => useUserScope());
    await waitFor(() => expect(result.current.loading).toBe(false), TIMEOUT);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.adminCheckError).toBe(false);
  });
});
