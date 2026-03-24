-- ============================================================
-- RBAC, Aprovação e Permissões Customizadas
-- Adiciona user_roles, is_approved e custom_permissions.
-- Execute no SQL Editor do Supabase após admin_setup.sql.
-- ============================================================

-- 1. Enum de roles de aplicação
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabela user_roles  (um registro por usuário)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_roles_user_id_key UNIQUE (user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Cada usuário vê/edita apenas o próprio role; admin gerencia todos
CREATE POLICY "user_roles_select"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "user_roles_all_admin"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. Novos campos em profiles (idempotente)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_approved     BOOLEAN   NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_permissions TEXT[]  DEFAULT '{}';

-- 4. Popular user_roles a partir de profiles existentes
--    (admins → 'admin', demais → 'user')
INSERT INTO public.user_roles (user_id, role)
SELECT id, CASE WHEN is_admin THEN 'admin'::public.app_role ELSE 'user'::public.app_role END
FROM   public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- 5. Função: sincronizar profiles.is_admin quando user_roles.role muda
CREATE OR REPLACE FUNCTION public.sync_is_admin_from_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.profiles
  SET    is_admin = (NEW.role = 'admin')
  WHERE  id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_is_admin ON public.user_roles;
CREATE TRIGGER trg_sync_is_admin
  AFTER INSERT OR UPDATE OF role ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_is_admin_from_role();

-- 6. Policy adicional em profiles para que admin possa atualizar qualquer linha
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE TO authenticated
  USING     (public.is_admin())
  WITH CHECK (public.is_admin());

-- 7. Comentários
COMMENT ON TABLE  public.user_roles IS 'Role RBAC por usuário (admin, moderator, user). Mantido em sincronia com profiles.is_admin via trigger.';
COMMENT ON COLUMN public.profiles.is_approved        IS 'Indica se a conta foi aprovada pelo administrador. Padrão true para contas existentes.';
COMMENT ON COLUMN public.profiles.custom_permissions IS 'Permissões customizadas no formato ["records.view", "records.edit", ...].';
