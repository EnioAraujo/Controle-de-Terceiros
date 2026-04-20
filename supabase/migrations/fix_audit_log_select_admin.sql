-- ============================================================
-- SEGURANÇA: Política SELECT para admins no audit_log
-- OWASP A09:2025 — Security Logging and Alerting
--
-- Problema: sem política SELECT, admins não conseguem consultar
-- o audit_log via client SDK (anon key). Leitura só era possível
-- pelo painel Supabase ou service_role.
--
-- Correção: criar política de leitura restrita a administradores.
-- Execute este script no SQL Editor do painel Supabase.
-- ============================================================

DROP POLICY IF EXISTS "admin_select_audit_log" ON public.audit_log;

CREATE POLICY "admin_select_audit_log"
  ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin());
