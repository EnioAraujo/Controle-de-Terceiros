-- ============================================================
-- MIGRAÇÃO: Ampliar constraint de operacao no audit_log
-- Adiciona variantes de erro (_ERROR) para registrar falhas de sync
-- sem silenciar erros de constraint.
--
-- OWASP A09:2025 — Security Logging and Alerting
-- Execute este script no SQL Editor do painel Supabase
-- ============================================================

ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_operacao_check;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_operacao_check
  CHECK (operacao IN (
    'INSERT', 'UPDATE', 'DELETE', 'PURGE', 'EXCLUSAO_TITULAR',
    'DELETE_ERROR', 'UPSERT_ERROR', 'PURGE_ERROR', 'INSERT_ERROR', 'UPDATE_ERROR'
  ));
