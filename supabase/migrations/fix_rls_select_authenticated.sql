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
