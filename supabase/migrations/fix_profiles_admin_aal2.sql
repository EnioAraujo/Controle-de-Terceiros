-- ============================================================
-- SEGURANÇA: profiles_update_admin sem is_aal2()
-- OWASP A01:2025 — Broken Access Control
--
-- Problema: a política "profiles_update_admin" permitia admins
-- aprovarem usuários e alterarem is_admin/is_approved sem MFA (AAL1).
-- Todas as demais políticas de escrita já exigem is_aal2().
--
-- Correção: adicionar AND public.is_aal2() à política admin.
-- Execute este script no SQL Editor do painel Supabase.
-- ============================================================

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

CREATE POLICY "profiles_update_admin"
  ON public.profiles
  FOR UPDATE TO authenticated
  USING  (public.is_admin() AND public.is_aal2())
  WITH CHECK (public.is_admin() AND public.is_aal2());
