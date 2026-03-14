-- ============================================================
-- MIGRAÇÃO: Restringir políticas de ESCRITA a sessões autenticadas
-- (inclui autenticação anônima do Supabase Auth)
--
-- PRÉ-REQUISITO: no painel Supabase habilitar
--   Authentication → Configuration → "Allow anonymous sign-ins"
--
-- Execute este script no SQL Editor do painel Supabase
-- ============================================================

-- ── 1. Remover políticas de escrita permissivas (role anon + true) ──

DROP POLICY IF EXISTS "anon_insert_registros" ON public.registros;
DROP POLICY IF EXISTS "anon_update_registros" ON public.registros;
DROP POLICY IF EXISTS "anon_delete_registros" ON public.registros;

DROP POLICY IF EXISTS "anon_insert_opcoes" ON public.opcoes;
DROP POLICY IF EXISTS "anon_update_opcoes" ON public.opcoes;
DROP POLICY IF EXISTS "anon_delete_opcoes" ON public.opcoes;

-- ── 2. Novas políticas: escrita exige sessão autenticada ──────────
--
-- auth.uid() IS NOT NULL  →  verdadeiro para qualquer sessão válida
-- (tanto e-mail/senha quanto sessões anônimas do Supabase Auth)
-- Chamadas sem autenticação (role=anon puro) são bloqueadas.

CREATE POLICY "authed_insert_registros"
  ON public.registros FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authed_update_registros"
  ON public.registros FOR UPDATE TO authenticated
  USING     (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authed_delete_registros"
  ON public.registros FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "authed_insert_opcoes"
  ON public.opcoes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authed_update_opcoes"
  ON public.opcoes FOR UPDATE TO authenticated
  USING     (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "authed_delete_opcoes"
  ON public.opcoes FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ── SELECT continua público (anon + true é aceito pelo linter) ───
-- As políticas anon_select_* já existem — não precisam de alteração.
