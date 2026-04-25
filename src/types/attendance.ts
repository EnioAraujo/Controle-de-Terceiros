export interface Registro {
  id: string;
  loteId?: string; // presente quando lançado em grupo (múltiplas pessoas)
  data: string; // YYYY-MM-DD
  turno: string;
  horaEntrada: string;
  horaSaida: string;
  totalHoras: string;
  nome: string;
  cargo: string;
  setor: string;
  unidade: string;
  cc: string;
  motivo: string;
  fornecedor: string;
  obs: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface Opcoes {
  turnos:       string[];
  unidades:     string[];
  fornecedores: string[];
  motivos:      string[];
  cargos:       string[];
  ccList:       string[];
  nomes:        string[];
}

export const OPCOES_CONFIG: { key: keyof Omit<Opcoes, "nomes">; label: string; cor: string }[] = [
  { key: "turnos",       label: "Turnos",          cor: "#1A56DB" },
  { key: "unidades",     label: "Unidades",         cor: "#0E9F6E" },
  { key: "fornecedores", label: "Fornecedores",     cor: "#D97706" },
  { key: "motivos",      label: "Motivos",          cor: "#6C63FF" },
  { key: "cargos",       label: "Cargos",           cor: "#E02424" },
  { key: "ccList",       label: "Centros de Custo", cor: "#0891B2" },
];

// Sem defaults hardcoded — fonte de verdade é a tabela opcoes no Supabase.
// Para popular um novo ambiente, execute supabase/migrations/seed_opcoes_default.sql
export const OPCOES_DEFAULT: Opcoes = {
  turnos:       [],
  unidades:     [],
  fornecedores: [],
  motivos:      [],
  cargos:       [],
  ccList:       [],
  nomes:        [],
};
