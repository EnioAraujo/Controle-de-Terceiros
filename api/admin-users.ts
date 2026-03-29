// Vercel Serverless Function: admin-users
// Gerencia criação, atualização e exclusão de usuários usando service_role key.
// Deployada automaticamente pelo Vercel a cada git push.
//
// Requer env vars na Vercel Dashboard:
//   SUPABASE_URL           = URL do projeto Supabase
//   SUPABASE_SERVICE_ROLE_KEY = chave service_role (secreta, nunca exposta no frontend)
//
// Ações suportadas:
//   { action: "create", email, password, is_admin? }
//   { action: "update", userId, email?, password? }
//   { action: "delete", userId }

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "";

function getCorsOrigin(origin: string): string {
  if (!ALLOWED_ORIGIN) return ""; // fail closed — ALLOWED_ORIGIN obrigatória
  return origin === ALLOWED_ORIGIN ? origin : "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers["origin"] as string | undefined) ?? "";
  const corsOrigin = getCorsOrigin(origin);

  if (corsOrigin) {
    res.setHeader("Access-Control-Allow-Origin", corsOrigin);
    res.setHeader(
      "Access-Control-Allow-Headers",
      "authorization, content-type, x-client-info, apikey"
    );
    res.setHeader("Vary", "Origin");
  }

  if (req.method === "OPTIONS") {
    if (!corsOrigin) return res.status(403).end();
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ── Autenticação ────────────────────────────────────────────────
  const authHeader = req.headers["authorization"] as string | undefined;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.replace("Bearer ", "");

  const supabaseUrl = process.env.SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return res
      .status(500)
      .json({ error: "Configuração de servidor incompleta." });
  }

  // Cliente admin (service_role bypassa RLS e pode verificar tokens)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verifica identidade do chamador
  const {
    data: { user },
    error: userErr,
  } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !user) return res.status(401).json({ error: "Unauthorized" });

  // Verifica se é admin
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) return res.status(403).json({ error: "Forbidden" });

  // ── Verificação AAL2: MFA obrigatório para operações admin (SEV-001) ──
  try {
    const jwtParts = token.split(".");
    const jwtPayload = JSON.parse(
      Buffer.from(jwtParts[1], "base64url").toString()
    ) as { aal?: string };
    if (jwtPayload.aal !== "aal2") {
      return res.status(403).json({ error: "MFA obrigatório para esta operação." });
    }
  } catch {
    return res.status(401).json({ error: "Token inválido." });
  }

  // ── Processar ação ───────────────────────────────────────────────
  const body = req.body as {
    action: string;
    email?: string;
    password?: string;
    userId?: string;
    is_admin?: boolean;
  };
  const { action } = body;

  try {
    // CREATE
    if (action === "create") {
      const { email, password, is_admin = false } = body;
      if (!email || !password)
        return res
          .status(400)
          .json({ error: "E-mail e senha são obrigatórios." });
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email))
        return res
          .status(400)
          .json({ error: "Formato de e-mail inválido." });
      if (password.length < 8)
        return res
          .status(400)
          .json({ error: "A senha deve ter no mínimo 8 caracteres." });

      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error) return res.status(400).json({ error: error.message });

      if (data.user) {
        await supabaseAdmin
          .from("profiles")
          .upsert({ id: data.user.id, email, is_admin, is_approved: true })
          .eq("id", data.user.id);

        const role = is_admin ? "admin" : "user";
        await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: data.user.id, role }, { onConflict: "user_id" });
      }

      return res
        .status(200)
        .json({ data: { id: data.user?.id, email: data.user?.email } });
    }

    // UPDATE
    if (action === "update") {
      const { userId, email, password } = body;
      if (!userId)
        return res.status(400).json({ error: "userId é obrigatório." });
      if (password && password.length < 8)
        return res
          .status(400)
          .json({ error: "A senha deve ter no mínimo 8 caracteres." });

      const updateData: { email?: string; password?: string } = {};
      if (email) updateData.email = email;
      if (password) updateData.password = password;

      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        updateData
      );
      if (error) return res.status(400).json({ error: error.message });

      if (email) {
        await supabaseAdmin
          .from("profiles")
          .update({ email })
          .eq("id", userId);
      }

      return res
        .status(200)
        .json({ data: { id: data.user?.id, email: data.user?.email } });
    }

    // DELETE
    if (action === "delete") {
      const { userId } = body;
      if (!userId)
        return res.status(400).json({ error: "userId é obrigatório." });
      if (userId === user.id)
        return res
          .status(400)
          .json({ error: "Você não pode excluir sua própria conta." });

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) return res.status(400).json({ error: error.message });

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: "Ação desconhecida." });
  } catch (err) {
    console.error("[ADMIN_API_ERROR]", err);
    return res.status(500).json({ error: "Erro interno. Tente novamente." });
  }
}
