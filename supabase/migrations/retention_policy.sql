-- ============================================================
-- LGPD — Política de retenção de dados (Art. 15/16 — Término do Tratamento)
-- Execute este script no SQL Editor do painel Supabase
-- ============================================================

-- Função que apaga registros com mais de 5 anos e registra no audit_log
CREATE OR REPLACE FUNCTION public.purge_old_registros()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog   -- Previne search_path injection (Supabase lint 0011)
AS $$
DECLARE
  limite DATE := CURRENT_DATE - INTERVAL '5 years';
  qtd    INT;
BEGIN
  SELECT COUNT(*) INTO qtd FROM public.registros WHERE data < limite;

  IF qtd > 0 THEN
    -- Registrar no audit_log antes de excluir
    INSERT INTO public.audit_log (operacao, tabela, dados)
    VALUES (
      'PURGE',
      'registros',
      jsonb_build_object(
        'motivo', 'Retenção LGPD — Art. 15 e 16',
        'limite_data', limite,
        'registros_removidos', qtd
      )
    );

    DELETE FROM public.registros WHERE data < limite;
  END IF;
END;
$$;

-- ── Agendamento automático via pg_cron (todo dia às 02:00) ──────
-- Só agenda se a extensão pg_cron estiver habilitada no projeto.
-- Para habilitar: Dashboard → Database → Extensions → pg_cron
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'lgpd-purge-old-registros',
      '0 2 * * *',
      $cmd$ SELECT public.purge_old_registros(); $cmd$
    );
    RAISE NOTICE 'pg_cron: job "lgpd-purge-old-registros" agendado com sucesso.';
  ELSE
    RAISE NOTICE 'pg_cron não está habilitado. Habilite em Dashboard → Database → Extensions → pg_cron e rode novamente, ou execute manualmente: SELECT public.purge_old_registros();';
  END IF;
END;
$$;

-- ── Execução manual (quando necessário) ─────────────────────────
-- SELECT public.purge_old_registros();
