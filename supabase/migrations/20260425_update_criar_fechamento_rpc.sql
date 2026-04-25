-- Migration: Remove status from criar_fechamento RPC and table
-- Data: 2026-04-25

-- Remove status from function parameters and insert
CREATE OR REPLACE FUNCTION criar_fechamento(
  p_fornecedor TEXT,
  p_data_inicio DATE,
  p_data_fim DATE,
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
    valor_total,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    p_fornecedor,
    p_data_inicio,
    p_data_fim,
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
