import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias. Configure o arquivo .env.");
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Aguarda a sessão estar disponível antes de qualquer operação de escrita.
 * O usuário deve estar autenticado via email+senha para que a sessão exista.
 * As políticas de INSERT/UPDATE/DELETE exigem role = 'authenticated'.
 */
export const authReady: Promise<void> = supabase.auth
  .getSession()
  .then(() => undefined)
  .catch(() => undefined);

/**
 * Wrapper para operações do Supabase com retry automático em erros 401/403
 * Implementa padrão "fail closed" - se refresh falhar, nega acesso
 *
 * @param operation - Função que retorna Promise do Supabase
 * @param maxRetries - Número máximo de tentativas (padrão: 2)
 * @returns Resultado da operação ou erro
 */
export async function executeWithAuthRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();

      // Verifica se é uma resposta do Supabase com erro
      const supabaseResult = result as { error?: { status?: number; message?: string } | null };
      const error = supabaseResult?.error;

      // Se não há erro ou erro não é 401/403, retorna resultado
      if (!error || (error.status !== 401 && error.status !== 403)) {
        return result;
      }

      // Erro 401/403 - tenta refresh do token
      console.warn(
        `[AUTH_RETRY] Tentativa ${attempt}/${maxRetries}: erro ${error.status} - ${error.message}`
      );

      if (attempt < maxRetries) {
        // Tenta refresh do token
        const { error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError) {
          console.error("[AUTH_RETRY] Refresh falhou:", refreshError.message);
          // Fail closed: refresh falhou, não continua tentando
          throw new Error(`Falha de autenticação: ${refreshError.message}`);
        }

        console.log("[AUTH_RETRY] Token refreshado, tentando novamente...");
        // Aguarda breve delay antes de retry
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }

      // Últimas tentativas falharam
      throw new Error(`Erro ${error.status}: ${error.message}`);
    } catch (err: unknown) {
      lastError = err;

      // Se não é erro de autenticação, lança imediatamente
      if (err instanceof Error && !err.message.includes("401") && !err.message.includes("403")) {
        throw err;
      }

      if (attempt < maxRetries) {
        // Tenta refresh do token
        const { error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError) {
          console.error("[AUTH_RETRY] Refresh falhou:", refreshError.message);
          throw new Error(`Falha de autenticação: ${refreshError.message}`);
        }

        console.log("[AUTH_RETRY] Token refreshado, tentando novamente...");
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  }

  // Todas as tentativas falharam
  throw lastError;
}
