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
