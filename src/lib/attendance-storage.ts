import { Registro } from "@/types/attendance";

const STORAGE_KEY = "ct-registros-v1";

export const getRegistros = (): Registro[] => {
  if (typeof window === "undefined") return [];
  const records = localStorage.getItem(STORAGE_KEY);
  return records ? JSON.parse(records) : [];
};

export const saveRegistros = (records: Registro[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

export const addRegistro = (record: Registro): Registro[] => {
  const records = getRegistros();
  const newRecords = [...records, record];
  saveRegistros(newRecords);
  return newRecords;
};
