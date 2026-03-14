-- ============================================================
-- Correções — Supabase Security Linter Warnings
-- Execute este script no SQL Editor do painel Supabase
-- ============================================================

-- ── 1. function_search_path_mutable — lint 0011 ──────────────────
-- Fixa o search_path da função para evitar search_path injection.
ALTER FUNCTION public.purge_old_registros()
  SET search_path TO public, pg_catalog;


-- ── 2. auth_allow_anonymous_sign_ins — audit_log SELECT ──────────
-- O app nunca lê a tabela audit_log (apenas insere via logAudit()).
-- Remover a política SELECT elimina o warning e reduz superfície de ataque.
DROP POLICY IF EXISTS "authed_select_audit_log" ON public.audit_log;


-- ── NOTAS SOBRE WARNINGS RESTANTES ───────────────────────────────
--
-- cron.job / cron.job_run_details — Tabelas internas do Supabase/pg_cron.
--   Não temos controle sobre as políticas dessas tabelas.
--   O warning é benigno e não representa risco para o nosso schema.
--
-- public.opcoes / public.registros (DELETE + UPDATE) — ARQUITETURA INTENCIONAL.
--   Este app usa "Anonymous Sign-in" do Supabase Auth como mecanismo de autenticação
--   principal (não como acesso guest). Todo usuário legítimo do sistema é uma sessão
--   anônima autenticada (role = authenticated, auth.uid() IS NOT NULL).
--   Bloquear sessões anônimas quebraria o app inteiro. O warning é um falso positivo
--   para esta arquitetura de app interno single-tenant.
--
-- auth_leaked_password_protection — Não aplicável.
--   O app não usa autenticação por senha. Somente anonymous sign-in é utilizado,
--   portanto a proteção de senhas vazadas do HaveIBeenPwned não tem relevância.
