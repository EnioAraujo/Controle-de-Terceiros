import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useAuthStatusImpl } from "./useAuthStatus";
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
    from: vi.fn(),
  },
}));

const mockGetSession = vi.mocked(supabase.auth.getSession);
const mockOnAuthStateChange = vi.mocked(supabase.auth.onAuthStateChange);
const mockRefreshSession = vi.mocked(supabase.auth.refreshSession);
const mockSignOut = vi.mocked(supabase.auth.signOut);
const mockFrom = vi.mocked(supabase.from);

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
    // Fluent mock para supabase.from("profiles").select().eq().single()
    // Padrão: usuário aprovado e não bloqueado
    const mockSingle = vi.fn().mockResolvedValue({
      data: { is_blocked: false, is_approved: true },
      error: null,
    });
    const mockEq = vi.fn(() => ({ single: mockSingle }));
    const mockSelect = vi.fn(() => ({ eq: mockEq }));
    mockFrom.mockReturnValue({ select: mockSelect } as ReturnType<typeof supabase.from>);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("carregamento inicial", () => {
    it("deve carregar sessão com sucesso", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      const { result } = renderHook(() => useAuthStatusImpl());

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

      const { result } = renderHook(() => useAuthStatusImpl());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBe("Erro de conexão");
    });

    it("deve lidar com sessão nula (usuário não logado)", async () => {
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      const { result } = renderHook(() => useAuthStatusImpl());

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

      const { result } = renderHook(() => useAuthStatusImpl());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.tokenExpired).toBe(true);
    });

    it("não deve marcar como expirado se token tem > 5 minutos", async () => {
      const mockSession = createMockSession({
        expires_at: Math.floor(Date.now() / 1000) + 600, // 10 minutos
      });
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      const { result } = renderHook(() => useAuthStatusImpl());

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

      const { result } = renderHook(() => useAuthStatusImpl());

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

      const { result } = renderHook(() => useAuthStatusImpl());

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

      const { result } = renderHook(() => useAuthStatusImpl());

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

      const { result } = renderHook(() => useAuthStatusImpl());

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

      const { result, unmount } = renderHook(() => useAuthStatusImpl());

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

      const { result } = renderHook(() => useAuthStatusImpl());

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

      const { result } = renderHook(() => useAuthStatusImpl());

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.isAuthenticated).toBe(true);

      // Simula SIGNED_OUT
      await act(async () => {
        await authChangeCallback?.("SIGNED_OUT", null);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it("deve restaurar sessão quando INITIAL_SESSION", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      let authChangeCallback: ((event: string, session: unknown) => Promise<void>) | null = null;
      mockOnAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback as typeof authChangeCallback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      });

      const { result } = renderHook(() => useAuthStatusImpl());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await authChangeCallback?.("INITIAL_SESSION", mockSession);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockSession.user);
      expect(result.current.loading).toBe(false);
    });

    it("deve atualizar sessão quando TOKEN_REFRESHED", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

      let authChangeCallback: ((event: string, session: unknown) => Promise<void>) | null = null;
      mockOnAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback as typeof authChangeCallback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      });

      const { result } = renderHook(() => useAuthStatusImpl());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await authChangeCallback?.("TOKEN_REFRESHED", mockSession);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.session).toEqual(mockSession);
      expect(result.current.loading).toBe(false);
    });

    it("deve atualizar usuário quando USER_UPDATED", async () => {
      const initialSession = createMockSession({ email: "old@example.com" });
      const updatedSession = createMockSession({ email: "new@example.com" });
      mockGetSession.mockResolvedValue({ data: { session: initialSession }, error: null });

      let authChangeCallback: ((event: string, session: unknown) => Promise<void>) | null = null;
      mockOnAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback as typeof authChangeCallback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      });

      const { result } = renderHook(() => useAuthStatusImpl());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await authChangeCallback?.("USER_UPDATED", updatedSession);
      });

      expect(result.current.user?.email).toBe("new@example.com");
    });

    // Teste de regressão — bug cc99a58: MFA_CHALLENGE_VERIFIED não estava no switch,
    // fazendo com que a sessão nunca fosse atualizada para aal2 após verificação MFA.
    it("deve atualizar estado quando MFA_CHALLENGE_VERIFIED (regressão cc99a58)", async () => {
      const aal1Session = createMockSession();
      const aal2Session = createMockSession({ amr: [{ method: "totp" }] });
      mockGetSession.mockResolvedValue({ data: { session: aal1Session }, error: null });

      let authChangeCallback: ((event: string, session: unknown) => Promise<void>) | null = null;
      mockOnAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback as typeof authChangeCallback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      });

      const { result } = renderHook(() => useAuthStatusImpl());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await authChangeCallback?.("MFA_CHALLENGE_VERIFIED", aal2Session);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.session).toEqual(aal2Session);
      expect(result.current.loading).toBe(false);
    });

    // Regressão: loadSession() + INITIAL_SESSION duplicavam fetch a /profiles no boot.
    it("dedup: apenas 1 fetch a profiles quando loadSession e INITIAL_SESSION recebem a mesma sessão", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      // Reseta o mock e instrumenta single() para contar chamadas
      const mockSingle = vi.fn().mockResolvedValue({
        data: { is_blocked: false, is_approved: true },
        error: null,
      });
      const mockEq = vi.fn(() => ({ single: mockSingle }));
      const mockSelect = vi.fn(() => ({ eq: mockEq }));
      mockFrom.mockReturnValue({ select: mockSelect } as ReturnType<typeof supabase.from>);

      let authChangeCallback: ((event: string, session: unknown) => Promise<void>) | null = null;
      mockOnAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback as typeof authChangeCallback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      });

      const { result } = renderHook(() => useAuthStatusImpl());
      await waitFor(() => expect(result.current.loading).toBe(false));

      // Dispara INITIAL_SESSION com a MESMA sessão que loadSession já tratou
      await act(async () => {
        await authChangeCallback?.("INITIAL_SESSION", mockSession);
      });

      // loadSession já chamou single uma vez; INITIAL_SESSION com mesma sessão deve ser deduplicada.
      expect(mockSingle).toHaveBeenCalledTimes(1);
    });

    it("dedup: refaz fetch a profiles quando expires_at muda (token refresh legítimo)", async () => {
      const session1 = createMockSession();
      const session2 = createMockSession({ expires_at: (session1.expires_at as number) + 3600 });
      mockGetSession.mockResolvedValue({ data: { session: session1 }, error: null });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { is_blocked: false, is_approved: true },
        error: null,
      });
      const mockEq = vi.fn(() => ({ single: mockSingle }));
      const mockSelect = vi.fn(() => ({ eq: mockEq }));
      mockFrom.mockReturnValue({ select: mockSelect } as ReturnType<typeof supabase.from>);

      let authChangeCallback: ((event: string, session: unknown) => Promise<void>) | null = null;
      mockOnAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback as typeof authChangeCallback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      });

      const { result } = renderHook(() => useAuthStatusImpl());
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await authChangeCallback?.("TOKEN_REFRESHED", session2);
      });

      // 1 fetch do loadSession + 1 fetch do TOKEN_REFRESHED com expires_at diferente
      expect(mockSingle).toHaveBeenCalledTimes(2);
    });

    it("SIGNED_OUT limpa tokenExpired além de isAuthenticated", async () => {
      const expiringSession = createMockSession({
        expires_at: Math.floor(Date.now() / 1000) + 60, // expira em 1 minuto
      });
      mockGetSession.mockResolvedValue({ data: { session: expiringSession }, error: null });

      let authChangeCallback: ((event: string, session: unknown) => Promise<void>) | null = null;
      mockOnAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback as typeof authChangeCallback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      });

      const { result } = renderHook(() => useAuthStatusImpl());
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.tokenExpired).toBe(true); // token quase expirado

      await act(async () => {
        await authChangeCallback?.("SIGNED_OUT", null);
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.tokenExpired).toBe(false);
    });
  });

  describe("isApproved", () => {
    it("deve retornar isApproved=false quando conta aguarda aprovação", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      // Sobrescreve o default: is_approved = false
      const mockSingle = vi.fn().mockResolvedValue({
        data: { is_blocked: false, is_approved: false },
        error: null,
      });
      const mockEq = vi.fn(() => ({ single: mockSingle }));
      const mockSelect = vi.fn(() => ({ eq: mockEq }));
      mockFrom.mockReturnValue({ select: mockSelect } as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useAuthStatusImpl());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isApproved).toBe(false);
    });

    it("deve retornar isApproved=true quando conta está aprovada", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      const { result } = renderHook(() => useAuthStatusImpl());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.isApproved).toBe(true);
    });

    it("deve resetar isApproved para true ao fazer logout", async () => {
      const mockSession = createMockSession();
      mockGetSession.mockResolvedValue({ data: { session: mockSession }, error: null });

      const mockSingle = vi.fn().mockResolvedValue({
        data: { is_blocked: false, is_approved: false },
        error: null,
      });
      const mockEq = vi.fn(() => ({ single: mockSingle }));
      const mockSelect = vi.fn(() => ({ eq: mockEq }));
      mockFrom.mockReturnValue({ select: mockSelect } as ReturnType<typeof supabase.from>);

      let authChangeCallback: ((event: string, session: unknown) => Promise<void>) | null = null;
      mockOnAuthStateChange.mockImplementation((callback) => {
        authChangeCallback = callback as typeof authChangeCallback;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      });

      const { result } = renderHook(() => useAuthStatusImpl());
      await waitFor(() => expect(result.current.isApproved).toBe(false));

      await act(async () => {
        await authChangeCallback?.("SIGNED_OUT", null);
      });

      expect(result.current.isApproved).toBe(true);
    });
  });
});
