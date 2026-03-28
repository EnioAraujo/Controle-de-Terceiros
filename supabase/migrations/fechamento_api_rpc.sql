-- ═══════════════════════════════════════════════════════════════
-- FUNÇÕES RPC PARA FECHAMENTO FINANCEIRO
-- ═══════════════════════════════════════════════════════════════
-- Implementa transações atômicas para operações de fechamento
-- OWASP A01:2025 - Controle de acesso via RLS
-- OWASP A10:2025 - Fail closed em caso de erro

-- ═══════════════════════════════════════════════════════════════
-- TIPO COMPOSTO PARA ITENS DE FECHAMENTO
-- ═══════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE fechamento_item_input AS (
    registro_id TEXT,
    nome TEXT,
    data DATE,
    turno TEXT,
    horas TEXT,
    valor_diaria NUMERIC,
    valor_hora NUMERIC,
    valor_calculado NUMERIC,
    ajuste_manual BOOLEAN,
    obs TEXT
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ═══════════════════════════════════════════════════════════════
-- CRIAR FECHAMENTO (TRANSAÇÃO ATÔMICA)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION criar_fechamento(
  p_fornecedor TEXT,
  p_data_inicio DATE,
  p_data_fim DATE,
  p_status TEXT,
  p_valor_total NUMERIC,
  p_created_by UUID,
  p_itens fechamento_item_input[]
) RETURNS UUID AS $$
DECLARE
  v_fechamento_id UUID;
  v_item fechamento_item_input;
BEGIN
  -- Iniciar transação (implícito no PostgreSQL)
  
  -- Insert do cabeçalho
  INSERT INTO fechamentos (
    fornecedor,
    data_inicio,
    data_fim,
    status,
    valor_total,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    p_fornecedor,
    p_data_inicio,
    p_data_fim,
    p_status,
    p_valor_total,
    p_created_by,
    NOW(),
    NOW()
  ) RETURNING id INTO v_fechamento_id;

  -- Insert dos itens
  FOREACH v_item IN ARRAY p_itens LOOP
    INSERT INTO fechamento_itens (
      fechamento_id,
      registro_id,
      nome,
      data,
      turno,
      horas,
      valor_diaria,
      valor_hora,
      valor_calculado,
      ajuste_manual,
      obs
    ) VALUES (
      v_fechamento_id,
      v_item.registro_id,
      v_item.nome,
      v_item.data,
      v_item.turno,
      v_item.horas,
      v_item.valor_diaria,
      v_item.valor_hora,
      v_item.valor_calculado,
      v_item.ajuste_manual,
      v_item.obs
    );
  END LOOP;

  -- Commit (implícito se chegar aqui sem erro)
  RETURN v_fechamento_id;

EXCEPTION
  WHEN OTHERS THEN
    -- Rollback automático em caso de erro
    RAISE EXCEPTION 'Erro ao criar fechamento: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- EXCLUIR FECHAMENTO (TRANSAÇÃO ATÔMICA)
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION excluir_fechamento(
  p_fechamento_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Excluir itens primeiro (FK constraint)
  DELETE FROM fechamento_itens WHERE fechamento_id = p_fechamento_id;
  
  -- Excluir cabeçalho
  DELETE FROM fechamentos WHERE id = p_fechamento_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Erro ao excluir fechamento: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════
-- POLÍTICAS RLS PARA FECHAMENTOS (Atualizado para apenas admins)
-- ═══════════════════════════════════════════════════════════════

-- Drop políticas antigas se existirem
DROP POLICY IF EXISTS "authed_select_fechamentos" ON fechamentos;
DROP POLICY IF EXISTS "authed_insert_fechamentos" ON fechamentos;
DROP POLICY IF EXISTS "authed_update_fechamentos" ON fechamentos;
DROP POLICY IF EXISTS "authed_delete_fechamentos" ON fechamentos;
DROP POLICY IF EXISTS "authed_select_fechamento_itens" ON fechamento_itens;
DROP POLICY IF EXISTS "authed_insert_fechamento_itens" ON fechamento_itens;
DROP POLICY IF EXISTS "authed_update_fechamento_itens" ON fechamento_itens;
DROP POLICY IF EXISTS "authed_delete_fechamento_itens" ON fechamento_itens;

-- Habilitar RLS
ALTER TABLE fechamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE fechamento_itens ENABLE ROW LEVEL SECURITY;

-- SELECT: usuários autenticados podem ver todos os fechamentos
CREATE POLICY "Usuarios_autenticados_podem_ver_fechamentos"
  ON fechamentos
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios_autenticados_podem_ver_itens"
  ON fechamento_itens
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: apenas administradores
CREATE POLICY "Apenas_admins_podem_criar_fechamentos"
  ON fechamentos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Apenas_admins_podem_inserir_itens"
  ON fechamento_itens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- UPDATE: apenas administradores
CREATE POLICY "Apenas_admins_podem_editar_fechamentos"
  ON fechamentos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Apenas_admins_podem_editar_itens"
  ON fechamento_itens
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- DELETE: apenas administradores
CREATE POLICY "Apenas_admins_podem_excluir_fechamentos"
  ON fechamentos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

CREATE POLICY "Apenas_admins_podem_excluir_itens"
  ON fechamento_itens
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- ÍNDICES PARA PERFORMANCE
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_fechamentos_fornecedor 
  ON fechamentos(fornecedor);

CREATE INDEX IF NOT EXISTS idx_fechamentos_periodo 
  ON fechamentos(data_inicio, data_fim);

CREATE INDEX IF NOT EXISTS idx_fechamentos_status 
  ON fechamentos(status);

CREATE INDEX IF NOT EXISTS idx_fechamento_itens_fechamento 
  ON fechamento_itens(fechamento_id);

CREATE INDEX IF NOT EXISTS idx_fechamento_itens_data 
  ON fechamento_itens(data);
