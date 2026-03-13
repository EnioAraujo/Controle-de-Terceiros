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
