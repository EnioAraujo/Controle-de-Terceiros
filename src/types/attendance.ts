export interface Registro {
  id: string;
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
