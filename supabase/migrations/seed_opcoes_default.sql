-- Seed: valores padrão para a tabela opcoes
-- Usa ON CONFLICT DO NOTHING para não sobrescrever dados já cadastrados.
-- Execute este script uma vez em cada novo ambiente.

INSERT INTO opcoes (chave, valor) VALUES
  ('turnos',       '1ª TURNO'),
  ('turnos',       '2ª TURNO'),
  ('turnos',       '3ª TURNO'),
  ('turnos',       'INTERMEDIÁRIO'),

  ('unidades',     'HUB'),
  ('unidades',     'COD DIURNO'),
  ('unidades',     'COD NOTURNO'),
  ('unidades',     'Administrativo'),

  ('fornecedores', 'LIDER MASTER'),
  ('fornecedores', 'TRANSLOG'),
  ('fornecedores', 'SERVILOG'),
  ('fornecedores', 'LOGFLEX'),
  ('fornecedores', 'OUTRO'),

  ('motivos',      'OPERAÇÃO BAT HUB BRASIL'),
  ('motivos',      'REFORÇO TURNO'),
  ('motivos',      'COBERTURA FALTA'),
  ('motivos',      'PROJETO ESPECIAL'),
  ('motivos',      'OUTRO'),

  ('cargos',       'AUXILIAR DE DEPÓSITO'),
  ('cargos',       'CONFERENTE JR'),
  ('cargos',       'CONFERENTE SR'),
  ('cargos',       'OPERADOR DE EMPILHADEIRA'),
  ('cargos',       'LÍDER OPERACIONAL'),
  ('cargos',       'SUPERVISOR'),
  ('cargos',       'ANALISTA'),
  ('cargos',       'COORDENADOR'),

  ('ccList',       '100001 - SOUZA CRUZ-COD'),
  ('ccList',       '100002 - SOUZA CRUZ-HUB'),
  ('ccList',       '100003 - ADMINISTRATIVO')
ON CONFLICT (chave, valor) DO NOTHING;
