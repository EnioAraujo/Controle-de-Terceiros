-- Criação da tabela de capacidade por turno
-- Permite configurar a quantidade padrão de pessoas por turno em um período de vigência.
-- Usado para calcular excedentes na tela de lançamentos e no relatório.

CREATE TABLE IF NOT EXISTS public.turnos_capacidade (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  turno           TEXT        NOT NULL,
  qtd_padrao      INTEGER     NOT NULL CHECK (qtd_padrao > 0),
  vigencia_inicio DATE        NOT NULL,
  vigencia_fim    DATE        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (vigencia_fim >= vigencia_inicio)
);

ALTER TABLE public.turnos_capacidade ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode consultar
CREATE POLICY "turnos_capacidade_select"
  ON public.turnos_capacidade FOR SELECT
  TO authenticated USING (true);

-- Apenas admin pode inserir
CREATE POLICY "turnos_capacidade_insert"
  ON public.turnos_capacidade FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

-- Apenas admin pode atualizar
CREATE POLICY "turnos_capacidade_update"
  ON public.turnos_capacidade FOR UPDATE
  TO authenticated USING (public.is_admin());

-- Apenas admin pode excluir
CREATE POLICY "turnos_capacidade_delete"
  ON public.turnos_capacidade FOR DELETE
  TO authenticated USING (public.is_admin());
