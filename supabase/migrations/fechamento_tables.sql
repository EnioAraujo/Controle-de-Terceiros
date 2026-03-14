-- ============================================================
-- FECHAMENTO — Tabelas para billing/fechamento de períodos
-- ============================================================

-- 1. Configuração de horas padrão por turno
CREATE TABLE IF NOT EXISTS turnos_config (
  turno        TEXT PRIMARY KEY,
  hora_inicio  TEXT NOT NULL DEFAULT '00:00',
  hora_fim     TEXT NOT NULL DEFAULT '00:00',
  hora_padrao  TEXT NOT NULL DEFAULT '08:20',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE turnos_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed_select_turnos_config"  ON turnos_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "authed_insert_turnos_config"  ON turnos_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authed_update_turnos_config"  ON turnos_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authed_delete_turnos_config"  ON turnos_config FOR DELETE TO authenticated USING (true);

-- Inserir turnos padrão
INSERT INTO turnos_config (turno, hora_inicio, hora_fim, hora_padrao) VALUES
  ('1ª TURNO',       '05:21', '13:40', '08:20'),
  ('2ª TURNO',       '13:41', '22:00', '08:20'),
  ('3ª TURNO',       '22:01', '05:20', '07:20'),
  ('INTERMEDIÁRIO',  '07:00', '16:48', '09:48')
ON CONFLICT (turno) DO NOTHING;

-- 2. Configuração de diárias por fornecedor + turno
CREATE TABLE IF NOT EXISTS diarias_config (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor   TEXT NOT NULL,
  turno        TEXT,  -- NULL = valor padrão para qualquer turno deste fornecedor
  valor_diaria NUMERIC(10,2) NOT NULL DEFAULT 250.00,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fornecedor, turno)
);

ALTER TABLE diarias_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed_select_diarias_config" ON diarias_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "authed_insert_diarias_config" ON diarias_config FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authed_update_diarias_config" ON diarias_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authed_delete_diarias_config" ON diarias_config FOR DELETE TO authenticated USING (true);

-- 3. Cabeçalho dos fechamentos
CREATE TABLE IF NOT EXISTS fechamentos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor   TEXT NOT NULL,
  data_inicio  DATE NOT NULL,
  data_fim     DATE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'rascunho'
                CHECK (status IN ('rascunho','enviado','revisao','aprovado')),
  valor_total  NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES auth.users(id)
);

ALTER TABLE fechamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed_select_fechamentos"  ON fechamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "authed_insert_fechamentos"  ON fechamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authed_update_fechamentos"  ON fechamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authed_delete_fechamentos"  ON fechamentos FOR DELETE TO authenticated USING (true);

-- 4. Itens detalhados de cada fechamento (por pessoa/dia)
CREATE TABLE IF NOT EXISTS fechamento_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id   UUID NOT NULL REFERENCES fechamentos(id) ON DELETE CASCADE,
  registro_id     TEXT,  -- referência ao registro de presença (pode ser NULL para itens manuais)
  nome            TEXT NOT NULL,
  data            DATE NOT NULL,
  turno           TEXT NOT NULL,
  horas           TEXT NOT NULL DEFAULT '00:00',
  valor_diaria    NUMERIC(10,2) NOT NULL,
  valor_hora      NUMERIC(10,4) NOT NULL,
  valor_calculado NUMERIC(10,2) NOT NULL,
  ajuste_manual   BOOLEAN NOT NULL DEFAULT false,
  obs             TEXT DEFAULT ''
);

ALTER TABLE fechamento_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed_select_fechamento_itens"  ON fechamento_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "authed_insert_fechamento_itens"  ON fechamento_itens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authed_update_fechamento_itens"  ON fechamento_itens FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authed_delete_fechamento_itens"  ON fechamento_itens FOR DELETE TO authenticated USING (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_fechamento_itens_fk ON fechamento_itens(fechamento_id);
CREATE INDEX IF NOT EXISTS idx_fechamentos_fornecedor ON fechamentos(fornecedor);
CREATE INDEX IF NOT EXISTS idx_fechamentos_periodo ON fechamentos(data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_diarias_config_forn ON diarias_config(fornecedor);
