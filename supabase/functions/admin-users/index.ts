// Edge Function: admin-users
// Gerencia criação, atualização e exclusão de usuários usando a service_role key
// (que fica armazenada como secret no Supabase, nunca exposta no frontend).
//
// Ações suportadas:
//   { action: "create", email, password, is_admin?, fornecedor? }
//   { action: "update", userId, email?, password? }
//   { action: "delete", userId }
//   { action: "set_fornecedor", userId, fornecedor }   // fornecedor: string|null
//
// Invariante: is_admin=true e fornecedor não-nulo são mutuamente exclusivos.
//
// Requer: chamador autenticado com is_admin = true no profiles.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Restringe CORS ao domínio da aplicação (evita CSRF)
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "";

// Rate limiting: máximo de requisições por minuto por usuário
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minuto

// Store simples em memória para rate limiting (em produção, usar Redis/Supabase)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Verifica rate limiting por userId
 * OWASP A02:2025 - Security Misconfiguration / Rate Limiting
 */
function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = rateLimitStore.get(userId);
  
  if (!record) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (now > record.resetAt) {
    // Janela expirou, resetar contador
    rateLimitStore.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfter: Math.ceil((record.resetAt - now) / 1000) };
  }
  
  record.count++;
  return { allowed: true };
}

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const isAllowed =
    !ALLOWED_ORIGIN ||
    origin === ALLOWED_ORIGIN ||
    LOCAL_ORIGIN.test(origin);
  const allowedOrigin = isAllowed ? origin : (ALLOWED_ORIGIN || "*");
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

// Overload: json aceita os headers CORS dinâmicos
function json(body: unknown, status = 200, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl      = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey          = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // ── Autenticar o chamador ──────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401, corsHeaders);

    const token = authHeader.replace("Bearer ", "");

    // Verifica identidade via client anon
    const supabaseUser = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser(token);
    if (userErr || !user) return json({ error: "Unauthorized" }, 401, corsHeaders);

    // Client admin (bypassa RLS)
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verifica se o chamador é admin
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) return json({ error: "Forbidden" }, 403, corsHeaders);

    // OWASP A02:2025 - Rate limiting por usuário
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      console.warn("[RATE_LIMIT_EXCEEDED]", { userId: user.id, retryAfter: rateLimit.retryAfter });
      return json(
        { error: `Muitas requisições. Tente novamente em ${rateLimit.retryAfter} segundos.` },
        429,
        { ...corsHeaders, "Retry-After": String(rateLimit.retryAfter) }
      );
    }

    // ── Processar ação ─────────────────────────────────────────────
    const body = await req.json();
    const { action } = body;

    // CREATE
    if (action === "create") {
      const { email, password, is_admin = false, fornecedor = null } = body;
      if (!email || !password) return json({ error: "E-mail e senha são obrigatórios." }, 400, corsHeaders);
      if (password.length < 8) return json({ error: "A senha deve ter no mínimo 8 caracteres." }, 400, corsHeaders);
      if (is_admin && fornecedor) return json({ error: "Um usuário não pode ser admin e fornecedor simultaneamente." }, 400, corsHeaders);
      const fornecedorClean = fornecedor && fornecedor.trim().length > 0 ? fornecedor.trim() : null;

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // confirma e-mail automaticamente
      });
      if (error) return json({ error: error.message }, 400, corsHeaders);

      if (data.user) {
        // Garante que o profile existe e está aprovado
        await supabaseAdmin
          .from("profiles")
          .upsert({ id: data.user.id, email, is_admin, is_approved: true, fornecedor: fornecedorClean })
          .eq("id", data.user.id);

        // Insere role em user_roles (o trigger sync_is_admin_from_role cuida do profiles.is_admin)
        const role = is_admin ? "admin" : "user";
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: data.user.id, role }, { onConflict: "user_id" });
      }
      return json({ data: { id: data.user?.id, email: data.user?.email } }, 200, corsHeaders);
    }

    // SET_FORNECEDOR
    if (action === "set_fornecedor") {
      const { userId, fornecedor = null } = body;
      if (!userId) return json({ error: "userId é obrigatório." }, 400, corsHeaders);
      const fornecedorClean = fornecedor && fornecedor.trim().length > 0 ? fornecedor.trim() : null;

      if (fornecedorClean) {
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: userId, role: "user" }, { onConflict: "user_id" });
        const { error: upErr } = await supabaseAdmin
          .from("profiles")
          .update({ is_admin: false, fornecedor: fornecedorClean })
          .eq("id", userId);
        if (upErr) return json({ error: upErr.message }, 400, corsHeaders);
      } else {
        const { error: upErr } = await supabaseAdmin
          .from("profiles")
          .update({ fornecedor: null })
          .eq("id", userId);
        if (upErr) return json({ error: upErr.message }, 400, corsHeaders);
      }

      return json({ success: true }, 200, corsHeaders);
    }

    // UPDATE
    if (action === "update") {
      const { userId, email, password } = body;
      if (!userId) return json({ error: "userId é obrigatório." }, 400, corsHeaders);
      // OWASP A07:2025 - Política de senhas fortes (mínimo 8 caracteres)
      if (password && password.length < 8) return json({ error: "A senha deve ter no mínimo 8 caracteres." }, 400, corsHeaders);

      const updateData: { email?: string; password?: string } = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;

      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);
      if (error) return json({ error: error.message }, 400, corsHeaders);

      // Mantém profiles sincronizado
      if (email) {
        await supabaseAdmin.from("profiles").update({ email }).eq("id", userId);
      }
      return json({ data: { id: data.user?.id, email: data.user?.email } }, 200, corsHeaders);
    }

    // DELETE
    if (action === "delete") {
      const { userId } = body;
      if (!userId) return json({ error: "userId é obrigatório." }, 400, corsHeaders);
      if (userId === user.id) return json({ error: "Você não pode excluir sua própria conta." }, 400, corsHeaders);

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400, corsHeaders);

      return json({ success: true }, 200, corsHeaders);
    }

    return json({ error: "Ação desconhecida." }, 400, corsHeaders);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500, corsHeaders);
  }
});
