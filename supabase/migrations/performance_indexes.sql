-- Migration: performance_indexes.sql
-- Adiciona índices de performance nas tabelas mais consultadas.
-- Evita full-table-scan em queries com filtros por data, turno, fornecedor, nome e unidade.

-- ── Tabela registros ────────────────────────────────────────────────
-- Filtro mais frequente: data + turno (página de Lançamentos)
CREATE INDEX IF NOT EXISTS idx_registros_data_turno
  ON public.registros (data, turno);

-- Filtros individuais usados na barra de filtros
CREATE INDEX IF NOT EXISTS idx_registros_fornecedor
  ON public.registros (fornecedor);

CREATE INDEX IF NOT EXISTS idx_registros_unidade
  ON public.registros (unidade);

-- Busca por nome (search box) — ILIKE %termo% usa trigram index
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_registros_nome_trgm
  ON public.registros USING GIN (nome gin_trgm_ops);

-- ── Tabela opcoes ────────────────────────────────────────────────────
-- Queries frequentes: SELECT * FROM opcoes WHERE chave = 'turnos'
CREATE INDEX IF NOT EXISTS idx_opcoes_chave
  ON public.opcoes (chave);

-- ── Tabela terceiros ─────────────────────────────────────────────────
-- Autocomplete de nomes usa ILIKE %query% — trigram resolve O(1)
CREATE INDEX IF NOT EXISTS idx_terceiros_nome_trgm
  ON public.terceiros USING GIN (to_tsvector('portuguese', nome));

-- ── Tabela audit_log ─────────────────────────────────────────────────
-- Consultas ao log por tabela + operação + data
CREATE INDEX IF NOT EXISTS idx_audit_log_tabela_operacao
  ON public.audit_log (tabela, operacao);

CREATE INDEX IF NOT EXISTS idx_audit_log_criado_em
  ON public.audit_log (criado_em DESC);
