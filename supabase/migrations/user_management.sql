-- ============================================================
-- Gerenciamento de usuários via Edge Function admin-users
-- Execute no SQL Editor do Supabase após deployar a função.
-- ============================================================

-- A Edge Function usa service_role (bypassa RLS), então não há
-- necessidade de novas políticas RLS para as operações de admin.
-- Contudo, o ON DELETE CASCADE já está configurado em profiles
-- (via FK para auth.users), então a exclusão de um usuário pela
-- Edge Function automaticamente remove o profile correspondente.

-- Se necessário, garantir que o ON DELETE CASCADE está presente:
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Função para sincronizar email no profiles quando auth.users é atualizado
CREATE OR REPLACE FUNCTION public.handle_user_updated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.profiles
  SET email = COALESCE(NEW.email, '')
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_user_updated();
