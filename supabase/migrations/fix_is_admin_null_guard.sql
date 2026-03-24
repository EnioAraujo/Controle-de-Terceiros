-- Migration: fix_is_admin_null_guard.sql
-- Adiciona proteção explícita contra auth.uid() retornar NULL na função is_admin().
-- Anteriormente: COALESCE retornava false silenciosamente mesmo com uid=NULL.
-- Agora: retorno false explícito antes de consultar profiles quando uid é NULL.
-- Isso elimina o risco de bypass por sessões malformadas.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    ELSE COALESCE(
      (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
      false
    )
  END;
$$;
