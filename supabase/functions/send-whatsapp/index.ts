// Edge Function: send-whatsapp
// Envia uma mensagem de texto para um grupo do WhatsApp via Z-API
// ao ser chamada após um novo lançamento ser salvo.
//
// Config lida da tabela `opcoes`:
//   wpp_enabled        — "true" para ativar
//   wpp_instance       — Instance ID da Z-API
//   wpp_key            — Token da instância Z-API
//   wpp_security_token — Security Token (Client-Token) da conta Z-API
//   wpp_group_id       — ID do grupo (ex: 120363xxxxxxxx-1234567890@g.us)
//
// Body esperado: { registros: Registro[] }
// Qualquer usuário autenticado pode chamar esta função.

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

interface Registro {
  nome: string;
  turno: string;
  data: string;
  fornecedor?: string;
  obs?: string;
}

function formatDate(iso: string): string {
  // "2026-03-15" → "15/03/2026"
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function buildMessage(registros: Registro[]): string {
  if (!registros.length) return "";

  // Agrupa por data + turno para cabeçalho
  const primeiroTurno = registros[0].turno;
  const primeiraData  = registros[0].data;
  const dataFmt       = formatDate(primeiraData);

  const linhas = registros.map(r => {
    const dup = (r.obs ?? "").includes("[DUPLO TURNO]");
    const prefix = dup ? "⚠️" : "•";
    const sufixo = dup ? " — DUPLO TURNO" : (r.fornecedor ? ` — ${r.fornecedor}` : "");
    return `${prefix} ${r.nome}${sufixo}`;
  });

  const total = registros.length;
  return [
    `🟢 *Novo Lançamento*`,
    `Data: ${dataFmt} | Turno: ${primeiroTurno}`,
    `Registros (${total}):`,
    ...linhas,
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl    = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey        = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // ── Autenticar chamador ─────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: userErr } = await supabaseUser.auth.getUser(token);
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    // ── Ler configuração da tabela opcoes ───────────────────────────
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: cfg } = await supabaseAdmin
      .from("opcoes")
      .select("chave,valor")
      .in("chave", ["wpp_enabled", "wpp_instance", "wpp_key", "wpp_security_token", "wpp_group_id"]);

    const c: Record<string, string> = {};
    (cfg ?? []).forEach((row: { chave: string; valor: string }) => { c[row.chave] = row.valor; });

    if (c["wpp_enabled"] !== "true") {
      return json({ skipped: true, reason: "WhatsApp integration disabled" });
    }

    const wppInstance       = c["wpp_instance"]       ?? "";
    const wppKey            = c["wpp_key"]            ?? "";
    const wppSecurityToken  = c["wpp_security_token"] ?? "";
    const wppGroupId        = c["wpp_group_id"]       ?? "";

    if (!wppInstance || !wppKey || !wppGroupId) {
      return json({ error: "WhatsApp config incompleta (wpp_instance, wpp_key, wpp_group_id)" }, 400);
    }

    // ── Montar mensagem ─────────────────────────────────────────────
    const body = await req.json();
    const registros: Registro[] = body?.registros ?? [];

    if (!registros.length) {
      return json({ skipped: true, reason: "Nenhum registro no body" });
    }

    const text = buildMessage(registros);

    // ── Chamar Z-API ────────────────────────────────────────────────
    const zapiUrl = `https://api.z-api.io/instances/${wppInstance}/token/${wppKey}/send-text`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (wppSecurityToken) headers["Client-Token"] = wppSecurityToken;

    const zapiRes = await fetch(zapiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: wppGroupId, message: text }),
    });

    if (!zapiRes.ok) {
      const errText = await zapiRes.text().catch(() => zapiRes.statusText);
      return json({ error: `Z-API retornou ${zapiRes.status}: ${errText}` }, 502);
    }

    return json({ success: true });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});
