// Tipos da hierarquia UNIDADE → CC → OPERAÇÃO e do catálogo de Pessoa.
// Os catálogos globais planos (turnos, cargos, fornecedores) permanecem em
// types/attendance.ts via Opcoes.

export interface Operacao {
  id: number;
  ccId: number;
  nome: string;
}

export interface CC {
  id: number;
  unidadeId: number;
  codigo: string;
  operacoes: Operacao[];
}

export interface Unidade {
  id: number;
  nome: string;
  ccs: CC[];
}

export interface Pessoa {
  id: number;
  nome: string;
  cargo: string;
  fornecedor: string;
}

export interface Hierarquia {
  unidades: Unidade[];
  pessoas: Pessoa[];
}

export const HIERARQUIA_DEFAULT: Hierarquia = { unidades: [], pessoas: [] };
