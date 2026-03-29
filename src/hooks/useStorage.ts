import { useState, useCallback, useRef, useEffect } from "react";
import { Registro } from "@/types/attendance";
import { supabase, authReady, executeWithAuthRetry } from "@/lib/supabase";
import { dataLimiteRetencao, dbToRegistro, registroToDb, type DbRegistro } from "@/lib/format-utils";
import { logAudit } from "@/lib/audit";
import { deduplicarLote, diffRegistros } from "@/lib/storage-utils";

// ═══════════════════════════════════════════════════════════════
// TIPOS E CONSTANTES
// ═══════════════════════════════════════════════════════════════

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

/**
 * Tipos de operação na fila de sincronização
 */
type SyncOperationType = "DELETE" | "UPSERT";

interface SyncOperation {
  id: string;
  type: SyncOperationType;
  timestamp: number;
  retryCount: number;
  // Para DELETE
  deletedIds?: string[];
  // Para UPSERT
  toUpsert?: Registro[];
  // Para diff
  prev?: Registro[];
  newVal?: Registro[];
}

interface PendingQueue {
  operations: SyncOperation[];
  lastSyncAttempt: number | null;
  isOnline: boolean;
}

/**
 * Delay com backoff exponencial para retry de operações
 * Fórmula: delay = baseDelay * 2^(attemptNumber - 1) + jitter aleatório (0-300ms)
 * Tentativa 1: 500ms + jitter
 * Tentativa 2: 1000ms + jitter
 * Tentativa 3: 2000ms + jitter
 */
const delayWithBackoff = (attempt: number): Promise<void> => {
  const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 300;
  return new Promise((resolve) => setTimeout(resolve, exponentialDelay + jitter));
};

/**
 * Executa uma operação com retry e backoff exponencial
 * Fail closed: após falhar todas as tentativas, retorna o erro
 */
async function executeWithRetry<T>(
  operation: () => Promise<{ error: unknown | null }>,
  operationName: string,
  ids?: string[]
): Promise<{ success: boolean; error?: string }> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { error } = await operation();

      if (!error) {
        return { success: true };
      }

      lastError = error;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Log de tentativa falha para debugging
      console.warn(
        `[SYNC_RETRY] Tentativa ${attempt}/${MAX_RETRIES} falhou para ${operationName}:`,
        errorMessage,
        ids?.length ? `IDs: ${ids.length}` : ""
      );

      // Se não é a última tentativa, aguarda com backoff
      if (attempt < MAX_RETRIES) {
        await delayWithBackoff(attempt);
      }
    } catch (unexpectedError) {
      lastError = unexpectedError;
      const errorMessage =
        unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError);

      console.warn(
        `[SYNC_RETRY] Exceção inesperada na tentativa ${attempt}/${MAX_RETRIES} para ${operationName}:`,
        errorMessage
      );

      if (attempt < MAX_RETRIES) {
        await delayWithBackoff(attempt);
      }
    }
  }

  // Todas as tentativas falharam - fail closed
  const finalErrorMessage = lastError instanceof Error ? lastError.message : String(lastError);
  console.error(
    `[SYNC_FAIL] Operação ${operationName} falhou após ${MAX_RETRIES} tentativas`,
    ids?.length ? `IDs afetados: ${ids.length}` : ""
  );

  return {
    success: false,
    error: finalErrorMessage,
  };
}

/**
 * Gera ID único para operações na fila
 */
const generateOperationId = () => `op_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

/**
 * Verifica se o navegador está online
 */
const checkOnlineStatus = () => navigator.onLine;

// ═══════════════════════════════════════════════════════════════
// HOOK USESTORAGE
// ═══════════════════════════════════════════════════════════════

/**
 * Hook para persistência de registros no Supabase
 *
 * Features:
 * - Carregamento inicial com LGPD purge automático
 * - Sync diff-based (DELETE + UPSERT)
 * - Retry com backoff exponencial (3 tentativas)
 * - Fail closed: estado local atualizado mesmo se sync falhar
 * - **Offline-first**: fila de operações pendentes
 * - **Auto-sync**: sincroniza quando conexão é restaurada
 * - Auditoria completa de operações
 *
 * @returns [registros, save, loading, isSyncing, syncError, pendingCount, isOnline, retryPending]
 */
export const useStorage = (): [
  Registro[],
  (val: Registro[]) => void,
  boolean,
  boolean,
  string | null,
  number,
  boolean,
  () => Promise<void>
] => {
  const [data, setData] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingQueue, setPendingQueue] = useState<PendingQueue>({
    operations: [],
    lastSyncAttempt: null,
    isOnline: checkOnlineStatus(),
  });
  const prevRef = useRef<Registro[]>([]);
  const queueRef = useRef<PendingQueue>({ operations: [], lastSyncAttempt: null, isOnline: true });

  /**
   * Processa a fila de operações pendentes
   * Chamado quando conexão é restaurada ou manualmente
   */
  const processPendingQueue = useCallback(async () => {
    const queue = queueRef.current;

    if (queue.operations.length === 0 || !queue.isOnline || isSyncing) {
      return;
    }

    console.debug(`[OFFLINE_QUEUE] Processando ${queue.operations.length} operações pendentes`);

    setIsSyncing(true);
    setSyncError(null);

    const remainingOperations: SyncOperation[] = [];

    for (const operation of queue.operations) {
      const errors: string[] = [];

      if (operation.type === "DELETE" && operation.deletedIds) {
        const result = await executeWithAuthRetry(
          () => executeWithRetry(
            () => supabase.from("registros").delete().in("id", operation.deletedIds!),
            "DELETE",
            operation.deletedIds,
            operation.retryCount
          )
        );

        if (result.success) {
          operation.deletedIds.forEach((id) => logAudit("DELETE", "registros", id));
        } else {
          errors.push(`DELETE falhou: ${result.error}`);
          logAudit("DELETE_ERROR", "registros", undefined, {
            ids: operation.deletedIds,
            error: result.error,
            retryCount: operation.retryCount,
          });
          // Mantém na fila se falhou
          remainingOperations.push({ ...operation, retryCount: operation.retryCount + 1 });
        }
      }

      if (operation.type === "UPSERT" && operation.toUpsert) {
        const result = await executeWithAuthRetry(
          () => executeWithRetry(
            () => supabase.from("registros").upsert(operation.toUpsert!.map(registroToDb)),
            "UPSERT",
            operation.toUpsert.map((r) => r.id),
            operation.retryCount
          )
        );

        if (result.success) {
          const prevMap = new Map((operation.prev ?? []).map((r) => [r.id, r]));
          operation.toUpsert.forEach((r) => {
            const isNew = !prevMap.has(r.id);
            logAudit(isNew ? "INSERT" : "UPDATE", "registros", r.id);
          });
        } else {
          errors.push(`UPSERT falhou: ${result.error}`);
          logAudit("UPSERT_ERROR", "registros", undefined, {
            ids: operation.toUpsert.map((r) => r.id),
            error: result.error,
            retryCount: operation.retryCount,
          });
          // Mantém na fila se falhou
          remainingOperations.push({ ...operation, retryCount: operation.retryCount + 1 });
        }
      }

      if (errors.length > 0) {
        console.error(`[OFFLINE_QUEUE] Erros: ${errors.join("; ")}`);
      }
    }

    // Atualiza fila com operações que falharam
    queueRef.current = { ...queue, operations: remainingOperations };
    setPendingQueue(queueRef.current);
    setIsSyncing(false);

    if (remainingOperations.length > 0) {
      setSyncError(`${remainingOperations.length} operação(ões) falharam. Tentando novamente...`);
    } else {
      console.debug("[OFFLINE_QUEUE] Todas as operações pendentes sincronizadas");
    }
  }, [isSyncing]);

  // Listeners de online/offline e processamento da fila
  useEffect(() => {
    const handleOnline = () => {
      console.debug("[OFFLINE_QUEUE] Conexão restaurada");
      queueRef.current.isOnline = true;
      setPendingQueue((prev) => ({ ...prev, isOnline: true }));
      // Tenta processar fila quando conexão volta
      setTimeout(() => processPendingQueue(), 1000);
    };

    const handleOffline = () => {
      console.debug("[OFFLINE_QUEUE] Conexão perdida");
      queueRef.current.isOnline = false;
      setPendingQueue((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Inicializa estado online/offline
    queueRef.current.isOnline = checkOnlineStatus();
    setPendingQueue((prev) => ({ ...prev, isOnline: queueRef.current.isOnline }));

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [processPendingQueue]);

  // Carregamento inicial
  useEffect(() => {
    let isMounted = true;

    const loadRegistros = async () => {
      try {
        await authReady;

        const { data: rows, error } = await supabase
          .from("registros")
          .select("*")
          .order("created_at", { ascending: true });

        if (!isMounted) return;

        if (error) {
          console.error("Erro ao carregar registros:", error.message);
          setSyncError(`Falha ao carregar: ${error.message}`);
        } else if (rows && rows.length > 0) {
          const parsed = (rows as DbRegistro[]).map(dbToRegistro);
          setData(parsed);
          prevRef.current = parsed;
        }

        setLoading(false);

        // LGPD Art. 15/16 — purga client-side de registros com mais de 5 anos
        const limite = dataLimiteRetencao();
        const { data: purged, error: pe } = await supabase
          .from("registros")
          .delete()
          .lt("data", limite)
          .select("id");

        if (!isMounted) return;

        if (pe) {
          console.error("Erro ao purgar registros antigos:", pe.message);
          logAudit("PURGE_ERROR", "registros", undefined, {
            motivo: `Falha na retenção LGPD`,
            error: pe.message,
          });
        } else if (purged && purged.length > 0) {
          logAudit("PURGE", "registros", undefined, {
            motivo: `Retenção LGPD — registros anteriores a ${limite}`,
            registros_removidos: purged.length,
          });
          setData((prev) => prev.filter((r) => r.data >= limite));
          prevRef.current = prevRef.current.filter((r) => r.data >= limite);
        }
      } catch (err: unknown) {
        if (!isMounted) return;

        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error("Erro no carregamento de registros:", errorMessage);
        setSyncError(`Erro crítico: ${errorMessage}`);
        setLoading(false);
      }
    };

    loadRegistros();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Persiste alterações no Supabase com retry e fail closed
   *
   * Estratégia:
   * 1. Atualiza estado local imediatamente (UX responsiva)
   * 2. Calcula diff (deletedIds, toUpsert)
   * 3. Se online: executa DELETE e UPSERT com retry
   * 4. Se offline: adiciona operações à fila pendente
   * 5. Log de auditoria para cada operação
   * 6. Fail closed: se falhar, syncError é definido mas estado local mantém
   */
  const save = useCallback(async (newValRaw: Registro[]) => {
    // Remove duplicatas intra-lote antes de persistir
    const newVal = deduplicarLote(newValRaw);

    const prev = prevRef.current;
    setData(newVal);
    prevRef.current = newVal;

    const prevMap = new Map(prev.map((r) => [r.id, r]));
    const { deletedIds, toUpsert } = diffRegistros(prev, newVal);

    // Verifica se está online
    const isOnline = checkOnlineStatus();
    queueRef.current.isOnline = isOnline;

    // Se offline, adiciona operações à fila e retorna
    if (!isOnline) {
      console.debug("[OFFLINE_QUEUE] Offline - adicionando operações à fila");

      const newOperations: SyncOperation[] = [];

      if (deletedIds.length > 0) {
        newOperations.push({
          id: generateOperationId(),
          type: "DELETE",
          timestamp: Date.now(),
          retryCount: 0,
          deletedIds,
          prev,
          newVal,
        });
      }

      if (toUpsert.length > 0) {
        newOperations.push({
          id: generateOperationId(),
          type: "UPSERT",
          timestamp: Date.now(),
          retryCount: 0,
          toUpsert,
          prev,
          newVal,
        });
      }

      queueRef.current.operations.push(...newOperations);
      setPendingQueue({ ...queueRef.current });
      setSyncError("Offline - operações serão sincronizadas quando conexão for restaurada");
      setIsSyncing(false);
      return;
    }

    // Online: executa operações normalmente
    setIsSyncing(true);
    setSyncError(null);

    const errors: string[] = [];

    // Operações DELETE com retry e auth retry
    if (deletedIds.length > 0) {
      const result = await executeWithAuthRetry(
        () => executeWithRetry(
          () => supabase.from("registros").delete().in("id", deletedIds),
          "DELETE",
          deletedIds
        )
      );

      if (result.success) {
        deletedIds.forEach((id) => logAudit("DELETE", "registros", id));
      } else {
        errors.push(`DELETE falhou: ${result.error}`);
        // Fail closed: log de erro de auditoria
        logAudit("DELETE_ERROR", "registros", undefined, {
          ids: deletedIds,
          error: result.error,
        });
        // Adiciona à fila de pendentes
        queueRef.current.operations.push({
          id: generateOperationId(),
          type: "DELETE",
          timestamp: Date.now(),
          retryCount: 0,
          deletedIds,
          prev,
          newVal,
        });
      }
    }

    // Operações UPSERT com retry e auth retry
    if (toUpsert.length > 0) {
      const result = await executeWithAuthRetry(
        () => executeWithRetry(
          () => supabase.from("registros").upsert(toUpsert.map(registroToDb)),
          "UPSERT",
          toUpsert.map((r) => r.id)
        )
      );

      if (result.success) {
        toUpsert.forEach((r) => {
          const isNew = !prevMap.has(r.id);
          logAudit(isNew ? "INSERT" : "UPDATE", "registros", r.id);
        });
      } else {
        errors.push(`UPSERT falhou: ${result.error}`);
        // Fail closed: log de erro de auditoria
        logAudit("UPSERT_ERROR", "registros", undefined, {
          ids: toUpsert.map((r) => r.id),
          error: result.error,
        });
        // Adiciona à fila de pendentes
        queueRef.current.operations.push({
          id: generateOperationId(),
          type: "UPSERT",
          timestamp: Date.now(),
          retryCount: 0,
          toUpsert,
          prev,
          newVal,
        });
      }
    }

    setIsSyncing(false);

    // Atualiza estado da fila
    setPendingQueue({ ...queueRef.current });

    // Se houve erros, define syncError (mas não reverte estado local - fail closed)
    if (errors.length > 0) {
      const combinedError = errors.join("; ");
      setSyncError(combinedError);
      console.error("[SYNC_ERRORS]", combinedError);
    }
  }, []);

  /**
   * Tenta sincronizar operações pendentes manualmente
   */
  const retryPending = useCallback(async () => {
    if (queueRef.current.operations.length === 0) {
      console.debug("[OFFLINE_QUEUE] Nenhuma operação pendente");
      return;
    }

    console.debug(`[OFFLINE_QUEUE] Tentando sincronizar ${queueRef.current.operations.length} operações`);
    await processPendingQueue();
  }, [processPendingQueue]);

  const pendingCount = pendingQueue.operations.length;
  const isOnline = pendingQueue.isOnline;

  return [data, save, loading, isSyncing, syncError, pendingCount, isOnline, retryPending];
};
