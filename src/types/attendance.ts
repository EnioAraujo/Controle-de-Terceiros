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