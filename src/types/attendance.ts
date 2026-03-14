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

/** Alias usado pelos componentes legados (AttendanceForm) */
export interface AttendanceRecord {
  id: string;
  date: Date;
  fullName: string;
  shift: string;
  timeIn: string;
  timeOut: string;
  totalHours: string;
  position: string;
  unit: string;
  costCenter: string;
  reason: string;
  supplier: string;
}

export interface SelectOption {
  value: string;
  label: string;
}
