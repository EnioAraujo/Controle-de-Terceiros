import DOMPurify from "dompurify";
import { supabase, authReady } from "@/lib/supabase";

export const uuid = () => crypto.randomUUID();

export const sanitize = (v: string) => DOMPurify.sanitize(v, { ALLOWED_TAGS: [] });

/**
 * Gera um requestId único para rastreamento de auditoria
 * Segue OWASP A09:2025 - Logging and Monitoramento
 */
const generateRequestId = () => crypto.randomUUID();

/**
 * Coleta metadados da sessão para auditoria de segurança
 * Nota: Em ambiente browser, não temos acesso direto ao IP do cliente
 * O IP será registrado pelo Supabase automaticamente nos logs do servidor
 */
const getSecurityMetadata = () => {
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
  const timestamp = new Date().toISOString();
  const requestId = generateRequestId();
  
  return {
    userAgent,
    timestamp,
    requestId,
    // IP não é acessível no frontend - registrado pelo Supabase no backend
  };
};

/**
 * Registra evento de auditoria com metadados de segurança
 * OWASP A09:2025 - Security Logging and Alerting
 * 
 * @param operacao - Tipo de operação (INSERT, UPDATE, DELETE, PURGE, EXCLUSAO_TITULAR)
 * @param tabela - Tabela afetada
 * @param registroId - ID do registro afetado
 * @param dados - Dados adicionais da operação
 */
export const logAudit = (
  operacao: "INSERT" | "UPDATE" | "DELETE" | "PURGE" | "EXCLUSAO_TITULAR"
          | "DELETE_ERROR" | "UPSERT_ERROR" | "PURGE_ERROR" | "INSERT_ERROR" | "UPDATE_ERROR",
  tabela: string,
  registroId?: string,
  dados?: unknown
) => {
  const metadata = getSecurityMetadata();
  
  // Fail closed: se não conseguir logar, apenas loga no console sem quebrar o fluxo
  authReady.then(() => {
    supabase.from("audit_log").insert({
      operacao,
      tabela,
      registro_id: registroId ?? null,
      dados: dados ? { ...dados, ...metadata } : metadata,
    }).then(({ error }) => {
      if (error) {
        // Log de erro de auditoria não deve quebrar a aplicação
        console.warn("[AUDIT_LOG_ERROR]", {
          operation: operacao,
          table: tabela,
          requestId: metadata.requestId,
          error: error.message,
        });
      }
    });
  }).catch((err: unknown) => {
    // Fail closed: erro no authReady não impede operação principal
    console.warn("[AUDIT_AUTH_READY_ERROR]", {
      operation: operacao,
      table: tabela,
      error: err instanceof Error ? err.message : String(err),
    });
  });
};
