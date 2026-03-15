-- ============================================================
-- Adiciona políticas SELECT para role authenticated nas tabelas
-- registros e opcoes.
-- Sem essa política, upserts falham porque o Supabase precisa
-- fazer SELECT para verificar conflitos (onConflict).
-- ============================================================

-- registros
CREATE POLICY "authed_select_registros"
  ON public.registros FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- opcoes
CREATE POLICY "authed_select_opcoes"
  ON public.opcoes FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- diarias_config
DROP POLICY IF EXISTS authed_select_diarias_config ON public.diarias_config;
CREATE POLICY authed_select_diarias_config
  ON public.diarias_config
  FOR SELECT
  TO authenticated
  USING (true);

-- fechamento_itens
DROP POLICY IF EXISTS authed_select_fechamento_itens ON public.fechamento_itens;
CREATE POLICY authed_select_fechamento_itens
  ON public.fechamento_itens
  FOR SELECT
  TO authenticated
  USING (true);

-- fechamentos
DROP POLICY IF EXISTS authed_select_fechamentos ON public.fechamentos;
CREATE POLICY authed_select_fechamentos
  ON public.fechamentos
  FOR SELECT
  TO authenticated
  USING (true);

-- profiles
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin));

-- terceiros
DROP POLICY IF EXISTS authed_select_terceiros ON public.terceiros;
CREATE POLICY authed_select_terceiros
  ON public.terceiros
  FOR SELECT
  TO authenticated
  USING (true);

-- turnos_config
DROP POLICY IF EXISTS authed_select_turnos_config ON public.turnos_config;
CREATE POLICY authed_select_turnos_config
  ON public.turnos_config
  FOR SELECT
  TO authenticated
  USING (true);
