-- ============================================================
-- LGPD — Tabela de log de auditoria (Art. 46/48 - Segurança e rastreabilidade)
-- Execute este script no SQL Editor do painel Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  operacao    TEXT        NOT NULL,
  tabela      TEXT        NOT NULL DEFAULT 'registros',
  registro_id TEXT,
  uid         TEXT,
  dados       JSONB,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT audit_log_operacao_check
    CHECK (operacao IN ('INSERT', 'UPDATE', 'DELETE', 'PURGE', 'EXCLUSAO_TITULAR'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_criado_em    ON public.audit_log (criado_em);
CREATE INDEX IF NOT EXISTS idx_audit_log_registro_id  ON public.audit_log (registro_id) WHERE registro_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_uid          ON public.audit_log (uid)          WHERE uid IS NOT NULL;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Escrita: apenas sessões autenticadas
CREATE POLICY "authed_insert_audit_log"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Leitura: apenas sessões autenticadas (log não é público)
CREATE POLICY "authed_select_audit_log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Sem UPDATE ou DELETE: registros de auditoria são imutáveis
