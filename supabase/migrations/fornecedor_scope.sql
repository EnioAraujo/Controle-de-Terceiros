-- ============================================================
-- Escopo de Fornecedor
-- ------------------------------------------------------------
-- Permite que usuários "fornecedores" cadastrem/editem APENAS
-- seus próprios funcionários em public.terceiros.
--
-- Mudanças:
--   1. profiles.fornecedor (TEXT, nullable) — NULL = usuário interno
--   2. terceiros: troca UNIQUE(nome) por UNIQUE(nome, fornecedor)
--   3. Função public.current_fornecedor() — lê fornecedor do perfil logado
--   4. Policies aditivas em terceiros para o usuário-fornecedor
--      (SELECT já é aberto p/ autenticados — necessário para o dropdown
--      de FormLancamento. Aqui restringimos somente INSERT/UPDATE/DELETE.)
--   5. Policies admin+AAL2 existentes permanecem intactas (RLS é OR).
-- ============================================================

-- ── 1. profiles.fornecedor ───────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS fornecedor TEXT NULL;

COMMENT ON COLUMN public.profiles.fornecedor IS
  'Nome do fornecedor (deve existir em opcoes.fornecedores). NULL = usuário interno.';

-- ── 2. terceiros: unique composta (nome, fornecedor) ─────────
-- Validação prévia: aborta migration se houver duplicatas que
-- impossibilitem a nova constraint.
DO $$
DECLARE
  v_dup INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_dup
  FROM (
    SELECT nome, COALESCE(fornecedor, '') AS forn, COUNT(*) c
    FROM public.terceiros
    GROUP BY nome, COALESCE(fornecedor, '')
    HAVING COUNT(*) > 1
  ) d;

  IF v_dup > 0 THEN
    RAISE EXCEPTION
      'Existem % combinações (nome, fornecedor) duplicadas em terceiros — limpe antes de aplicar.', v_dup;
  END IF;
END $$;

ALTER TABLE public.terceiros
  DROP CONSTRAINT IF EXISTS terceiros_nome_key;

ALTER TABLE public.terceiros
  DROP CONSTRAINT IF EXISTS terceiros_nome_fornecedor_unique;

ALTER TABLE public.terceiros
  ADD CONSTRAINT terceiros_nome_fornecedor_unique UNIQUE (nome, fornecedor);

-- ── 3. Função current_fornecedor() ───────────────────────────
-- SECURITY DEFINER para evitar recursão de RLS em profiles.
CREATE OR REPLACE FUNCTION public.current_fornecedor()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fornecedor
  FROM public.profiles
  WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_fornecedor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_fornecedor() TO authenticated;

COMMENT ON FUNCTION public.current_fornecedor() IS
  'Retorna profiles.fornecedor do usuário autenticado (NULL para usuário interno).';

-- ── 4. Policies aditivas em terceiros para usuário-fornecedor ─

-- INSERT: fornecedor só insere linhas com seu próprio fornecedor
DROP POLICY IF EXISTS "fornecedor_insert_terceiros" ON public.terceiros;
CREATE POLICY "fornecedor_insert_terceiros"
  ON public.terceiros FOR INSERT TO authenticated
  WITH CHECK (
    public.current_fornecedor() IS NOT NULL
    AND fornecedor = public.current_fornecedor()
  );

-- UPDATE: só linhas do próprio fornecedor (USING) e não pode trocar de fornecedor (WITH CHECK)
DROP POLICY IF EXISTS "fornecedor_update_terceiros" ON public.terceiros;
CREATE POLICY "fornecedor_update_terceiros"
  ON public.terceiros FOR UPDATE TO authenticated
  USING (
    public.current_fornecedor() IS NOT NULL
    AND fornecedor = public.current_fornecedor()
  )
  WITH CHECK (
    public.current_fornecedor() IS NOT NULL
    AND fornecedor = public.current_fornecedor()
  );

-- DELETE: só linhas do próprio fornecedor
DROP POLICY IF EXISTS "fornecedor_delete_terceiros" ON public.terceiros;
CREATE POLICY "fornecedor_delete_terceiros"
  ON public.terceiros FOR DELETE TO authenticated
  USING (
    public.current_fornecedor() IS NOT NULL
    AND fornecedor = public.current_fornecedor()
  );

-- Nota: SELECT permanece via authed_select_terceiros USING(true) — o
-- dropdown de nomes em FormLancamento precisa enxergar todos os terceiros
-- ao escolher um fornecedor. O isolamento de escrita acima já garante que
-- um fornecedor não cria/edita/deleta dados de outro.
