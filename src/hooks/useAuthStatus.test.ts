import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAuthStatus } from "./useAuthStatus";
import { supabase } from "@/lib/supabase";

// Mock do supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      refreshSession: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

const mockGetSession = vi.mocked(supabase.auth.getSession);
const mockOnAuthStateChange = vi.mocked(supabase.auth.onAuthStateChange);
const mockRefreshSession = vi.mocked(supabase.auth.refreshSession);
const mockSignOut = vi.mocked(supabase.auth.signOut);

function createMockSession(overrides = {}) {
  return {
    access_token: "access_token",
    refresh_token: "refresh_token",
    expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hora
    token_type: "bearer",
    user: {
      id: "user-id",
      email: "test@example.com",
      aud: "authenticated",
      ...overrides,
    },
    ...overrides,
  };
}

describe("useAuthStatus", () => {
  let mockUnsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUnsubscribe = vi.fn();
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("carregamento inicial", () => {
    it("deve carregar sessão com sucesso", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      const { result } = renderHook(() => useAuthStatus());

      // Estado inicial
      expect(result.current.loading).toBe(true);

      // Aguarda carregamento
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockSession.user);
      expect(result.current.session).toEqual(mockSession);
    });

    it("deve lidar com erro no carregamento inicial", async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: { message: "Erro de conexão" },
      });

      const { result } = renderHook(() => useAuthStatus());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBe("Erro de conexão");
    });

    it("deve lidar com sessão nula (usuário não logado)", async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      const { result } = renderHook(() => useAuthStatus());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });
  });

  describe("detecção de token expirado", () => {
    it("deve detectar token expirando em breve (< 5 minutos)", async () => {
      const mockSession = createMockSession({
        expires_at: Math.floor(Date.now() / 1000) + 120, // 2 minutos
      });
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      const { result } = renderHook(() => useAuthStatus());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.tokenExpired).toBe(true);
    });

    it("não deve marcar como expirado se token tem > 5 minutos", async () => {
      const mockSession = createMockSession({
        expires_at: Math.floor(Date.now() / 1000) + 600, // 10 minutos
      });
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      const { result } = renderHook(() => useAuthStatus());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.tokenExpired).toBe(false);
    });

    it("deve chamar refreshSession automaticamente quando TOKEN_EXPIRED", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
      mockRefreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      let authChangeCallback: ((event: string, session: unknown) => Promise<void>) | null = null;
      mockOnAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback as typeof authChangeCallback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      });

      const { result } = renderHook(() => useAuthStatus());

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Simula evento TOKEN_EXPIRED
      await act(async () => {
        await authChangeCallback?.("TOKEN_EXPIRED", null);
      });

      expect(mockRefreshSession).toHaveBeenCalled();
    });
  });

  describe("refresh de sessão", () => {
    it("deve fazer refresh da sessão com sucesso", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockRefreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null,
      });

      const { result } = renderHook(() => useAuthStatus());

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Chama refresh manual
      await act(async () => {
        await result.current.refreshSession();
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.tokenExpired).toBe(false);
    });

    it("deve falhar e fazer logout se refresh falhar (fail closed)", async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });
      mockRefreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: "Token inválido" },
      });

      const { result } = renderHook(() => useAuthStatus());

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.refreshSession();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toContain("Token inválido");
    });
  });

  describe("logout", () => {
    it("deve fazer logout com sucesso", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });
      mockSignOut.mockResolvedValue();

      const { result } = renderHook(() => useAuthStatus());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.isAuthenticated).toBe(true);

      // Logout
      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSignOut).toHaveBeenCalled();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });
  });

  describe("listener de auth state change", () => {
    it("deve unsubscribir ao desmontar", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      const { result, unmount } = renderHook(() => useAuthStatus());

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Desmonta
      unmount();

      // Verifica unsubscribe
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it("deve atualizar estado quando SIGNED_IN", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      let authChangeCallback: ((event: string, session: unknown) => Promise<void>) | null = null;
      mockOnAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback as typeof authChangeCallback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      });

      const { result } = renderHook(() => useAuthStatus());

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Simula SIGNED_IN
      await act(async () => {
        await authChangeCallback?.("SIGNED_IN", mockSession);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockSession.user);
    });

    it("deve atualizar estado quando SIGNED_OUT", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      let authChangeCallback: ((event: string, session: unknown) => Promise<void>) | null = null;
      mockOnAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback as typeof authChangeCallback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      });

      const { result } = renderHook(() => useAuthStatus());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.isAuthenticated).toBe(true);

      // Simula SIGNED_OUT
      await act(async () => {
        await authChangeCallback?.("SIGNED_OUT", null);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });
});
