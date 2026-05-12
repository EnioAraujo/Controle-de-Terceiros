-- ============================================================
-- FIX: Permitir INSERT no audit_log para eventos de auth/MFA
-- em sessões AAL1 (antes do TOTP ser verificado)
--
-- Problema (chicken-and-egg):
--   enforce_mfa_aal2.sql exige is_aal2() para INSERT em audit_log.
--   Mas MFA_ENROLL, MFA_VERIFY, LOGIN_SUCCESS e LOGIN_FAILURE são
--   disparados DURANTE o fluxo de autenticação, antes do AAL2
--   ser estabelecido. Resultado: 403 Forbidden ao registrar o evento.
--
-- Solução:
--   Policy adicional que permite AAL1 inserir apenas os eventos
--   de auth/MFA. A policy aal2_insert_audit_log continua cobrindo
--   todos os outros eventos para usuários com AAL2.
--   Supabase avalia múltiplas INSERT policies com OR.
-- ============================================================

DROP POLICY IF EXISTS "aal1_insert_audit_log_auth_events" ON public.audit_log;

CREATE POLICY "aal1_insert_audit_log_auth_events"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND operacao IN (
      'LOGIN_SUCCESS',
      'LOGIN_FAILURE',
      'MFA_ENROLL',
      'MFA_VERIFY',
      'MFA_SKIP',
      'MFA_VERIFY_FAIL',
      'BACKUP_CODE_USED'
    )
  );
