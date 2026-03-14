import { Registro, AttendanceRecord } from "@/types/attendance";
import { supabase } from "@/lib/supabase";

// Mapeia colunas snake_case do DB para a interface Registro
const dbToRegistro = (row: Record<string, unknown>): Registro => ({
  id:          row.id as string,
  loteId:      (row.lote_id as string | null) ?? undefined,
  data:        row.data as string,
  turno:       row.turno as string,
  horaEntrada: row.hora_entrada as string,
  horaSaida:   row.hora_saida as string,
  totalHoras:  row.total_horas as string,
  nome:        row.nome as string,
  cargo:       row.cargo as string,
  setor:       row.setor as string,
  unidade:     row.unidade as string,
  cc:          row.cc as string,
  motivo:      row.motivo as string,
  fornecedor:  row.fornecedor as string,
  obs:         row.obs as string,
});

const registroToDb = (r: Registro) => ({
  id:           r.id,
  lote_id:      r.loteId ?? null,
  data:         r.data,
  turno:        r.turno,
  hora_entrada: r.horaEntrada,
  hora_saida:   r.horaSaida,
  total_horas:  r.totalHoras,
  nome:         r.nome,
  cargo:        r.cargo,
  setor:        r.setor,
  unidade:      r.unidade,
  cc:           r.cc,
  motivo:       r.motivo,
  fornecedor:   r.fornecedor,
  obs:          r.obs,
});

export const getRegistros = async (): Promise<Registro[]> => {
  const { data, error } = await supabase
    .from("registros")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as Record<string, unknown>[]).map(dbToRegistro);
};

export const addRegistro = async (record: Registro): Promise<void> => {
  const { error } = await supabase
    .from("registros")
    .insert(registroToDb(record));
  if (error) throw new Error(error.message);
};

export const updateRegistro = async (record: Registro): Promise<void> => {
  const { error } = await supabase
    .from("registros")
    .upsert(registroToDb(record));
  if (error) throw new Error(error.message);
};

export const deleteRegistros = async (ids: string[]): Promise<void> => {
  const { error } = await supabase
    .from("registros")
    .delete()
    .in("id", ids);
  if (error) throw new Error(error.message);
};

/** Compatibilidade com AttendanceForm — mapeia AttendanceRecord para Registro */
export const addAttendanceRecord = async (record: AttendanceRecord): Promise<void> => {
  const registro: Registro = {
    id:          record.id,
    data:        record.date instanceof Date
                   ? record.date.toISOString().slice(0, 10)
                   : String(record.date),
    turno:       record.shift,
    horaEntrada: record.timeIn,
    horaSaida:   record.timeOut,
    totalHoras:  record.totalHours,
    nome:        record.fullName,
    cargo:       record.position,
    setor:       "",
    unidade:     record.unit,
    cc:          record.costCenter,
    motivo:      record.reason,
    fornecedor:  record.supplier,
    obs:         "",
  };
  await addRegistro(registro);
};
