-- ============================================================
-- Mutex Admin × Fornecedor
-- ------------------------------------------------------------
-- Garante invariante de domínio: um perfil é OU interno (com
-- possível flag de admin) OU fornecedor externo — nunca ambos.
--
-- Aplicar APÓS fornecedor_scope.sql.
-- ============================================================

-- Validação prévia: aborta caso já existam perfis inconsistentes.
DO $$
DECLARE
  v_bad INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_bad
  FROM public.profiles
  WHERE is_admin = TRUE
    AND fornecedor IS NOT NULL;

  IF v_bad > 0 THEN
    RAISE EXCEPTION
      'Existem % perfis com is_admin=true E fornecedor NOT NULL — limpe antes de aplicar.', v_bad;
  END IF;
END $$;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_admin_xor_fornecedor;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_admin_xor_fornecedor
  CHECK (NOT (is_admin = TRUE AND fornecedor IS NOT NULL));
