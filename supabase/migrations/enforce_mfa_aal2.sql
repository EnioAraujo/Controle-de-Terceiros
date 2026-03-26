-- ============================================================
-- MIGRAÇÃO: Exigir MFA (AAL2) em todas as operações de escrita
--
-- Após esta migration, INSERT/UPDATE/DELETE em qualquer tabela
-- exige sessão com nível de garantia AAL2 (TOTP verificado).
-- Sessões AAL1 (e-mail + senha sem MFA) só podem fazer leitura.
--
-- Execute este script no SQL Editor do painel Supabase
-- ============================================================

-- ── 1. Função auxiliar: verifica se a sessão atual é AAL2 ───────
-- Nota: criada em public (não em auth) — SQL Editor não tem
-- permissão para criar funções no schema auth.

CREATE OR REPLACE FUNCTION public.is_aal2()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'amr' @> '[{"method": "totp"}]'::jsonb)
    OR (auth.jwt() ->> 'aal') = 'aal2',
    false
  );
$$;

-- ── 2. registros — substituir políticas de escrita ──────────────

DROP POLICY IF EXISTS "authed_insert_registros" ON public.registros;
DROP POLICY IF EXISTS "authed_update_registros" ON public.registros;
DROP POLICY IF EXISTS "authed_delete_registros" ON public.registros;

CREATE POLICY "aal2_insert_registros"
  ON public.registros FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());

CREATE POLICY "aal2_update_registros"
  ON public.registros FOR UPDATE TO authenticated
  USING     (auth.uid() IS NOT NULL AND public.is_aal2())
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());

CREATE POLICY "aal2_delete_registros"
  ON public.registros FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.is_aal2());

-- ── 3. opcoes — substituir políticas de escrita ─────────────────

DROP POLICY IF EXISTS "authed_insert_opcoes" ON public.opcoes;
DROP POLICY IF EXISTS "authed_update_opcoes" ON public.opcoes;
DROP POLICY IF EXISTS "authed_delete_opcoes" ON public.opcoes;

CREATE POLICY "aal2_insert_opcoes"
  ON public.opcoes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());

CREATE POLICY "aal2_update_opcoes"
  ON public.opcoes FOR UPDATE TO authenticated
  USING     (auth.uid() IS NOT NULL AND public.is_aal2())
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());

CREATE POLICY "aal2_delete_opcoes"
  ON public.opcoes FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND public.is_aal2());

-- ── 4. audit_log — escrita também exige AAL2 ───────────────────

DROP POLICY IF EXISTS "authed_insert_audit_log" ON public.audit_log;

CREATE POLICY "aal2_insert_audit_log"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_aal2());

-- ── 5. diarias_config — admin + AAL2 ───────────────────────────

DROP POLICY IF EXISTS "admin_insert_diarias_config" ON public.diarias_config;
DROP POLICY IF EXISTS "admin_update_diarias_config" ON public.diarias_config;
DROP POLICY IF EXISTS "admin_delete_diarias_config" ON public.diarias_config;

CREATE POLICY "aal2_admin_insert_diarias_config"
  ON public.diarias_config FOR INSERT TO authenticated
  WITH CHECK (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

CREATE POLICY "aal2_admin_update_diarias_config"
  ON public.diarias_config FOR UPDATE TO authenticated
  USING (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  )
  WITH CHECK (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

CREATE POLICY "aal2_admin_delete_diarias_config"
  ON public.diarias_config FOR DELETE TO authenticated
  USING (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

-- ── 6. fechamento_itens — admin + AAL2 ─────────────────────────

DROP POLICY IF EXISTS "admin_insert_fechamento_itens" ON public.fechamento_itens;
DROP POLICY IF EXISTS "admin_update_fechamento_itens" ON public.fechamento_itens;
DROP POLICY IF EXISTS "admin_delete_fechamento_itens" ON public.fechamento_itens;

CREATE POLICY "aal2_admin_insert_fechamento_itens"
  ON public.fechamento_itens FOR INSERT TO authenticated
  WITH CHECK (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

CREATE POLICY "aal2_admin_update_fechamento_itens"
  ON public.fechamento_itens FOR UPDATE TO authenticated
  USING (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  )
  WITH CHECK (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

CREATE POLICY "aal2_admin_delete_fechamento_itens"
  ON public.fechamento_itens FOR DELETE TO authenticated
  USING (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

-- ── 7. fechamentos — admin + AAL2 ──────────────────────────────

DROP POLICY IF EXISTS "admin_insert_fechamentos" ON public.fechamentos;
DROP POLICY IF EXISTS "admin_update_fechamentos" ON public.fechamentos;
DROP POLICY IF EXISTS "admin_delete_fechamentos" ON public.fechamentos;

CREATE POLICY "aal2_admin_insert_fechamentos"
  ON public.fechamentos FOR INSERT TO authenticated
  WITH CHECK (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

CREATE POLICY "aal2_admin_update_fechamentos"
  ON public.fechamentos FOR UPDATE TO authenticated
  USING (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  )
  WITH CHECK (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

CREATE POLICY "aal2_admin_delete_fechamentos"
  ON public.fechamentos FOR DELETE TO authenticated
  USING (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

-- ── 8. terceiros — admin + AAL2 ────────────────────────────────

DROP POLICY IF EXISTS "admin_insert_terceiros" ON public.terceiros;
DROP POLICY IF EXISTS "admin_update_terceiros" ON public.terceiros;
DROP POLICY IF EXISTS "admin_delete_terceiros" ON public.terceiros;

CREATE POLICY "aal2_admin_insert_terceiros"
  ON public.terceiros FOR INSERT TO authenticated
  WITH CHECK (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

CREATE POLICY "aal2_admin_update_terceiros"
  ON public.terceiros FOR UPDATE TO authenticated
  USING (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  )
  WITH CHECK (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

CREATE POLICY "aal2_admin_delete_terceiros"
  ON public.terceiros FOR DELETE TO authenticated
  USING (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

-- ── 9. turnos_config — admin + AAL2 ────────────────────────────

DROP POLICY IF EXISTS "admin_insert_turnos_config" ON public.turnos_config;
DROP POLICY IF EXISTS "admin_update_turnos_config" ON public.turnos_config;
DROP POLICY IF EXISTS "admin_delete_turnos_config" ON public.turnos_config;

CREATE POLICY "aal2_admin_insert_turnos_config"
  ON public.turnos_config FOR INSERT TO authenticated
  WITH CHECK (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

CREATE POLICY "aal2_admin_update_turnos_config"
  ON public.turnos_config FOR UPDATE TO authenticated
  USING (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  )
  WITH CHECK (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

CREATE POLICY "aal2_admin_delete_turnos_config"
  ON public.turnos_config FOR DELETE TO authenticated
  USING (
    public.is_aal2()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin)
  );

-- ── 10. profiles — UPDATE exige AAL2 ───────────────────────────
--  (INSERT é feito por trigger SECURITY DEFINER — não precisa de policy)

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;

CREATE POLICY "aal2_profiles_update"
  ON public.profiles FOR UPDATE TO authenticated
  USING     (auth.uid() = id AND public.is_aal2())
  WITH CHECK (auth.uid() = id AND public.is_aal2());
