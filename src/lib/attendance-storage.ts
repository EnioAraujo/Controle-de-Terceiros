import { AttendanceRecord } from "@/types/attendance";

const STORAGE_KEY = "attendance_records";

export const getAttendanceRecords = (): AttendanceRecord[] => {
  if (typeof window === "undefined") {
    return [];
  }
  const records = localStorage.getItem(STORAGE_KEY);
  return records ? JSON.parse(records).map((record: any) => ({
    ...record,
    date: new Date(record.date), // Convert date string back to Date object
  })) : [];
};

export const saveAttendanceRecords = (records: AttendanceRecord[]): void => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

export const addAttendanceRecord = (record: AttendanceRecord): AttendanceRecord[] => {
  const records = getAttendanceRecords();
  const newRecords = [...records, record];
  saveAttendanceRecords(newRecords);
  return newRecords;
};