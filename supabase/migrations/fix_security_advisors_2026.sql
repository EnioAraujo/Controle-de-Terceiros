-- ============================================================
-- Correções — Supabase Security Advisor (2026-03-29)
-- Resolve:
--   lint 0011  function_search_path_mutable  → criar_fechamento, excluir_fechamento
--   lint 0014  extension_in_public           → pg_trgm movido para schema extensions
--   lint 0012  auth_allow_anonymous_sign_ins  → limpeza de policies anon residuais
--                                              (fix principal: desabilitar Anonymous
--                                               Sign-Ins no Supabase Dashboard →
--                                               Authentication → Configuration)
-- ============================================================

-- ── 1. LINT 0011 — Recriar criar_fechamento com SET search_path ──

CREATE OR REPLACE FUNCTION public.criar_fechamento(
  p_fornecedor    TEXT,
  p_data_inicio   DATE,
  p_data_fim      DATE,
  p_status        TEXT,
  p_valor_total   NUMERIC,
  p_created_by    UUID,
  p_itens         public.fechamento_item_input[]
) RETURNS UUID
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_catalog
AS $$
DECLARE
  v_fechamento_id UUID;
  v_item          public.fechamento_item_input;
BEGIN
  INSERT INTO public.fechamentos (
    fornecedor,
    data_inicio,
    data_fim,
    status,
    valor_total,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    p_fornecedor,
    p_data_inicio,
    p_data_fim,
    p_status,
    p_valor_total,
    p_created_by,
    NOW(),
    NOW()
  ) RETURNING id INTO v_fechamento_id;

  FOREACH v_item IN ARRAY p_itens LOOP
    INSERT INTO public.fechamento_itens (
      fechamento_id,
      registro_id,
      nome,
      data,
      turno,
      horas,
      valor_diaria,
      valor_hora,
      valor_calculado,
      ajuste_manual,
      obs
    ) VALUES (
      v_fechamento_id,
      v_item.registro_id,
      v_item.nome,
      v_item.data,
      v_item.turno,
      v_item.horas,
      v_item.valor_diaria,
      v_item.valor_hora,
      v_item.valor_calculado,
      v_item.ajuste_manual,
      v_item.obs
    );
  END LOOP;

  RETURN v_fechamento_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao criar fechamento: %', SQLERRM;
END;
$$;

-- ── 2. LINT 0011 — Recriar excluir_fechamento com SET search_path ──

CREATE OR REPLACE FUNCTION public.excluir_fechamento(
  p_fechamento_id UUID
) RETURNS VOID
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public, pg_catalog
AS $$
BEGIN
  DELETE FROM public.fechamento_itens WHERE fechamento_id = p_fechamento_id;
  DELETE FROM public.fechamentos        WHERE id           = p_fechamento_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao excluir fechamento: %', SQLERRM;
END;
$$;

-- ── 3. LINT 0014 — Mover pg_trgm do schema public para extensions ──
--
-- DROP EXTENSION CASCADE remove automaticamente o índice GIN dependente.
-- O índice é recriado logo em seguida.
-- O operador gin_trgm_ops fica acessível via search_path (extensions já
-- está no search_path padrão do Supabase).

DROP EXTENSION IF EXISTS pg_trgm CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_registros_nome_trgm
  ON public.registros USING GIN (nome gin_trgm_ops);

-- ── 4. LINT 0012 — Remover policies residuais do role anon ──────────
--
-- Migrations antigas criaram políticas para o role anon antes da
-- migração para email + MFA. As policies abaixo devem ter sido removidas
-- por fix_rls_write_policies.sql, mas o DROP é idempotente (IF EXISTS).
-- O fix principal para lint 0012 é desabilitar "Allow Anonymous Sign-Ins"
-- no Supabase Dashboard → Authentication → Configuration.

DROP POLICY IF EXISTS "anon_select_registros"   ON public.registros;
DROP POLICY IF EXISTS "anon_insert_registros"   ON public.registros;
DROP POLICY IF EXISTS "anon_update_registros"   ON public.registros;
DROP POLICY IF EXISTS "anon_delete_registros"   ON public.registros;

DROP POLICY IF EXISTS "anon_select_opcoes"      ON public.opcoes;
DROP POLICY IF EXISTS "anon_insert_opcoes"      ON public.opcoes;
DROP POLICY IF EXISTS "anon_update_opcoes"      ON public.opcoes;
DROP POLICY IF EXISTS "anon_delete_opcoes"      ON public.opcoes;
