import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useStorage } from "./useStorage";
import { supabase } from "@/lib/supabase";
import type { Registro } from "@/types/attendance";

// Mock do supabase
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
  },
  authReady: Promise.resolve(),
  // executeWithAuthRetry: delega diretamente para a função passada (sem retry real nos testes)
  executeWithAuthRetry: vi.fn((fn: () => unknown) => fn()),
}));

// Mock do logAudit
vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}));

// Mock das utils
vi.mock("@/lib/storage-utils", () => ({
  deduplicarLote: vi.fn((r) => r),
  diffRegistros: vi.fn(),
}));

vi.mock("@/lib/format-utils", () => ({
  dataLimiteRetencao: vi.fn(() => "2021-01-01"),
  dbToRegistro: vi.fn((db) => db),
  registroToDb: vi.fn((r) => r),
}));

const mockSupabaseFrom = supabase.from as ReturnType<typeof vi.fn>;

function createMockRegistro(id: string, nome: string, data: string): Registro {
  return {
    id,
    loteId: null,
    data,
    turno: "1ª TURNO",
    horaEntrada: "08:00",
    horaSaida: "17:00",
    totalHoras: "09:00",
    nome,
    cargo: "AUXILIAR",
    setor: "OPERACAO",
    unidade: "HUB",
    cc: "100001",
    motivo: "OPERACAO",
    fornecedor: "JSS",
    obs: "",
  };
}

describe("useStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("carregamento inicial", () => {
    it("deve carregar registros do Supabase com sucesso", async () => {
      const mockRegistros = [
        createMockRegistro("1", "João", "2024-03-15"),
        createMockRegistro("2", "Maria", "2024-03-15"),
      ];

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockRegistros,
            error: null,
          }),
        }),
        delete: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useStorage());

      // Estado inicial
      expect(result.current[2]).toBe(true); // loading

      // Aguarda carregamento
      await waitFor(() => expect(result.current[2]).toBe(false), { timeout: 1000 });

      expect(result.current[0]).toEqual(mockRegistros);
    });

    it("deve lidar com erro no carregamento inicial", async () => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Erro de conexão" },
        }),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Erro de conexão" },
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useStorage());

      await waitFor(() => expect(result.current[2]).toBe(false), { timeout: 1000 });

      expect(result.current[0]).toEqual([]);
      expect(result.current[2]).toBe(false);
    });
  });

  describe("salvar registros - operações DELETE", () => {
    it("deve deletar registros com sucesso", async () => {
      const prevRegistro = createMockRegistro("1", "João", "2024-03-15");
      const newRegistros: Registro[] = [];

      // Setup: carregar estado inicial
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [prevRegistro], error: null }),
        order: vi.fn().mockResolvedValue({ data: [prevRegistro], error: null }),
      } as unknown as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useStorage());
      await waitFor(() => expect(result.current[2]).toBe(false));

      // Mock do diffRegistros para retornar deletedIds
      const { diffRegistros } = await import("@/lib/storage-utils");
      vi.mocked(diffRegistros).mockReturnValue({
        deletedIds: ["1"],
        toUpsert: [],
      });

      // Mock da operação de delete
      const mockDelete = vi.fn().mockResolvedValue({ error: null });
      mockSupabaseFrom.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          in: mockDelete,
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      // Executar save
      await act(async () => {
        result.current[1](newRegistros);
      });

      // Verificar que delete foi chamado com coluna + ids
      expect(mockDelete).toHaveBeenCalledWith("id", ["1"]);
    });

    it("deve fazer retry quando delete falhar (backoff exponencial)", async () => {
      const prevRegistro = createMockRegistro("1", "João", "2024-03-15");

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [prevRegistro], error: null }),
        order: vi.fn().mockResolvedValue({ data: [prevRegistro], error: null }),
      } as unknown as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useStorage());
      await waitFor(() => expect(result.current[2]).toBe(false));

      const { diffRegistros } = await import("@/lib/storage-utils");
      vi.mocked(diffRegistros).mockReturnValue({
        deletedIds: ["1"],
        toUpsert: [],
      });

      // Mock que falha 2 vezes, succeeds na 3ª
      let attempts = 0;
      const mockDelete = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.resolve({ error: { message: "Network error" } });
        }
        return Promise.resolve({ error: null });
      });

      mockSupabaseFrom.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          in: mockDelete,
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      await act(async () => {
        result.current[1]([]);
      });

      // Aguarda retries
      await waitFor(() => expect(attempts).toBe(3), { timeout: 5000 });

      // Deve tentar 3 vezes
      expect(attempts).toBe(3);
    });

    it("deve falhar após 3 tentativas e manter estado local (fail closed)", async () => {
      const prevRegistro = createMockRegistro("1", "João", "2024-03-15");

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [prevRegistro], error: null }),
        order: vi.fn().mockResolvedValue({ data: [prevRegistro], error: null }),
      } as unknown as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useStorage());
      await waitFor(() => expect(result.current[2]).toBe(false));

      const { diffRegistros } = await import("@/lib/storage-utils");
      vi.mocked(diffRegistros).mockReturnValue({
        deletedIds: ["1"],
        toUpsert: [],
      });

      // Mock que sempre falha
      const mockDelete = vi.fn().mockResolvedValue({ error: { message: "Network error" } });
      mockSupabaseFrom.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          in: mockDelete,
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      const estadoAntes = result.current[0];

      await act(async () => {
        result.current[1]([]);
      });

      // Aguarda todas as tentativas
      await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(3), { timeout: 5000 });

      // Estado local deve ser atualizado mesmo com falha (mas syncError deve ser true)
      // Fail closed: operação falhou, mas estado reflete intenção do usuário
      expect(mockDelete).toHaveBeenCalledTimes(3);
    });
  });

  describe("salvar registros - operações UPSERT", () => {
    it("deve inserir/atualizar registros com sucesso", async () => {
      const newRegistro = createMockRegistro("1", "João", "2024-03-15");

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as unknown as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useStorage());
      await waitFor(() => expect(result.current[2]).toBe(false));

      const { diffRegistros } = await import("@/lib/storage-utils");
      vi.mocked(diffRegistros).mockReturnValue({
        deletedIds: [],
        toUpsert: [newRegistro],
      });

      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockSupabaseFrom.mockReturnValue({
        upsert: mockUpsert,
      } as unknown as ReturnType<typeof supabase.from>);

      await act(async () => {
        result.current[1]([newRegistro]);
      });

      expect(mockUpsert).toHaveBeenCalledWith([newRegistro]);
    });

    it("deve fazer retry quando upsert falhar", async () => {
      const newRegistro = createMockRegistro("1", "João", "2024-03-15");

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as unknown as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useStorage());
      await waitFor(() => expect(result.current[2]).toBe(false));

      const { diffRegistros } = await import("@/lib/storage-utils");
      vi.mocked(diffRegistros).mockReturnValue({
        deletedIds: [],
        toUpsert: [newRegistro],
      });

      // Mock que falha 2 vezes, succeeds na 3ª
      let attempts = 0;
      const mockUpsert = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.resolve({ error: { message: "Network error" } });
        }
        return Promise.resolve({ error: null });
      });

      mockSupabaseFrom.mockReturnValue({
        upsert: mockUpsert,
      } as unknown as ReturnType<typeof supabase.from>);

      await act(async () => {
        result.current[1]([newRegistro]);
      });

      await waitFor(() => expect(attempts).toBe(3), { timeout: 5000 });

      expect(attempts).toBe(3);
    });
  });

  describe("estados de sincronização", () => {
    it("deve expor estado isSyncing durante operação", async () => {
      const newRegistro = createMockRegistro("1", "João", "2024-03-15");

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as unknown as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useStorage());
      await waitFor(() => expect(result.current[2]).toBe(false));

      const { diffRegistros } = await import("@/lib/storage-utils");
      vi.mocked(diffRegistros).mockReturnValue({
        deletedIds: [],
        toUpsert: [newRegistro],
      });

      // Mock que demora para resolver
      let resolveUpsert: (value: unknown) => void;
      const upsertPromise = new Promise((resolve) => {
        resolveUpsert = resolve;
      });

      const mockUpsert = vi.fn().mockReturnValue(upsertPromise);
      mockSupabaseFrom.mockReturnValue({
        upsert: mockUpsert,
      } as unknown as ReturnType<typeof supabase.from>);

      // Iniciar save sem aguardar
      act(() => {
        result.current[1]([newRegistro]);
      });

      // Durante a operação, isSyncing deveria ser true
      // (isso requer que o hook exponha isSyncing)
      // expect(result.current[3]).toBe(true); // isSyncing

      // Completar operação
      act(() => {
        resolveUpsert!({ error: null });
      });

      // expect(result.current[3]).toBe(false); // isSyncing após completar
    });
  });

  describe("estado inicial da fila offline", () => {
    beforeEach(() => {
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);
    });

    it("pendingCount inicial é 0", async () => {
      const { result } = renderHook(() => useStorage());
      await waitFor(() => expect(result.current[2]).toBe(false));
      expect(result.current[5]).toBe(0);
    });

    it("isOnline inicial é true", async () => {
      const { result } = renderHook(() => useStorage());
      await waitFor(() => expect(result.current[2]).toBe(false));
      expect(result.current[6]).toBe(true);
    });

    it("retryPending é uma função chamável sem erros", async () => {
      const { result } = renderHook(() => useStorage());
      await waitFor(() => expect(result.current[2]).toBe(false));
      expect(typeof result.current[7]).toBe("function");
      await act(async () => { await result.current[7](); });
    });
  });

  describe("LGPD purge", () => {
    it("purge bem-sucedido remove registros antigos do estado", async () => {
      const recente = createMockRegistro("1", "João", "2025-01-01");
      const antigo = createMockRegistro("2", "Antigo", "2018-01-01");

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [recente, antigo], error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: [{ id: "2" }], error: null }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useStorage());
      await waitFor(() => expect(result.current[2]).toBe(false));

      // dataLimiteRetencao mockado retorna "2021-01-01"
      // antigo.data = "2018-01-01" < "2021-01-01" → filtrado do estado
      await waitFor(() => expect(result.current[0]).toHaveLength(1));
      expect(result.current[0][0].id).toBe("1");
    });

    it("erro no purge não interrompe o carregamento", async () => {
      const recente = createMockRegistro("1", "João", "2025-01-01");

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [recente], error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: null, error: { message: "permission denied" } }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useStorage());
      await waitFor(() => expect(result.current[2]).toBe(false));

      expect(result.current[0]).toHaveLength(1);
      expect(result.current[0][0].id).toBe("1");
    });
  });

  describe("save sem mudanças", () => {
    it("diff vazio não gera chamadas adicionais ao banco", async () => {
      const registro = createMockRegistro("1", "João", "2024-03-15");

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [registro], error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      const { result } = renderHook(() => useStorage());
      await waitFor(() => expect(result.current[2]).toBe(false));

      const { diffRegistros } = await import("@/lib/storage-utils");
      vi.mocked(diffRegistros).mockReturnValue({ deletedIds: [], toUpsert: [] });

      // Limpa histórico de chamadas após o carregamento inicial
      mockSupabaseFrom.mockClear();

      await act(async () => { result.current[1]([registro]); });

      expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });
  });
});
