-- ============================================================
-- SEGURANÇA: Adicionar eventos de login ao audit_log
-- OWASP A09:2025 — Security Logging and Alerting
--
-- Problema: login bem-sucedido e falhas de senha não eram
-- registrados no audit_log, cegando a trilha de auditoria
-- para ataques de credential stuffing e account takeover.
--
-- Correção: ampliar o CHECK constraint para aceitar
-- LOGIN_SUCCESS e LOGIN_FAILURE.
-- Execute este script no SQL Editor do painel Supabase.
-- ============================================================

ALTER TABLE public.audit_log
  DROP CONSTRAINT IF EXISTS audit_log_operacao_check;

ALTER TABLE public.audit_log
  ADD CONSTRAINT audit_log_operacao_check
  CHECK (operacao IN (
    'INSERT', 'UPDATE', 'DELETE', 'PURGE', 'EXCLUSAO_TITULAR',
    'DELETE_ERROR', 'UPSERT_ERROR', 'PURGE_ERROR', 'INSERT_ERROR', 'UPDATE_ERROR',
    'MFA_ENROLL', 'MFA_VERIFY', 'MFA_SKIP', 'MFA_VERIFY_FAIL', 'BACKUP_CODE_USED',
    'LOGIN_SUCCESS', 'LOGIN_FAILURE'
  ));
