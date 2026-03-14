// Edge Function: admin-users
// Gerencia criação, atualização e exclusão de usuários usando a service_role key
// (que fica armazenada como secret no Supabase, nunca exposta no frontend).
//
// Ações suportadas:
//   { action: "create", email, password, is_admin? }
//   { action: "update", userId, email?, password? }
//   { action: "delete", userId }
//
// Requer: chamador autenticado com is_admin = true no profiles.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
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
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.replace("Bearer ", "");

    // Verifica identidade via client anon
    const supabaseUser = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser(token);
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

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

    if (!profile?.is_admin) return json({ error: "Forbidden" }, 403);

    // ── Processar ação ─────────────────────────────────────────────
    const body = await req.json();
    const { action } = body;

    // CREATE
    if (action === "create") {
      const { email, password, is_admin = false } = body;
      if (!email || !password) return json({ error: "E-mail e senha são obrigatórios." }, 400);
      if (password.length < 6) return json({ error: "A senha deve ter no mínimo 6 caracteres." }, 400);

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // confirma e-mail automaticamente
      });
      if (error) return json({ error: error.message }, 400);

      // Atualiza is_admin no profile (trigger já cria o registro base)
      if (data.user && is_admin) {
        await supabaseAdmin
          .from("profiles")
          .update({ is_admin: true })
          .eq("id", data.user.id);
      }
      return json({ data: { id: data.user?.id, email: data.user?.email } });
    }

    // UPDATE
    if (action === "update") {
      const { userId, email, password } = body;
      if (!userId) return json({ error: "userId é obrigatório." }, 400);
      if (password && password.length < 6) return json({ error: "A senha deve ter no mínimo 6 caracteres." }, 400);

      const updateData: { email?: string; password?: string } = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;

      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);
      if (error) return json({ error: error.message }, 400);

      // Mantém profiles sincronizado
      if (email) {
        await supabaseAdmin.from("profiles").update({ email }).eq("id", userId);
      }
      return json({ data: { id: data.user?.id, email: data.user?.email } });
    }

    // DELETE
    if (action === "delete") {
      const { userId } = body;
      if (!userId) return json({ error: "userId é obrigatório." }, 400);
      if (userId === user.id) return json({ error: "Você não pode excluir sua própria conta." }, 400);

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);

      return json({ success: true });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});
