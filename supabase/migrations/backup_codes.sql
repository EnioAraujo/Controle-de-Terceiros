-- Backup recovery codes para MFA
-- Conformidade: TOTP_MELHORES_PRATICAS.md

CREATE TABLE IF NOT EXISTS public.backup_codes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_backup_codes_user_unused
  ON public.backup_codes(user_id) WHERE used_at IS NULL;

ALTER TABLE public.backup_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "backup_codes_select_own" ON public.backup_codes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "backup_codes_insert_own" ON public.backup_codes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "backup_codes_delete_own" ON public.backup_codes
  FOR DELETE USING (auth.uid() = user_id);

-- RPC: verifica e consome um código de recuperação
CREATE OR REPLACE FUNCTION public.use_backup_code(p_code_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.backup_codes
  WHERE user_id = auth.uid()
    AND code_hash = p_code_hash
    AND used_at IS NULL
  LIMIT 1
  FOR UPDATE;

  IF v_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.backup_codes SET used_at = now() WHERE id = v_id;
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.use_backup_code(TEXT) TO authenticated;
