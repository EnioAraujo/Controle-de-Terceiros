import { SelectOption } from "@/types/attendance";

const OPTIONS_STORAGE_PREFIX = "app_options_";

export const getOptions = (key: string): SelectOption[] => {
  if (typeof window === "undefined") {
    return [];
  }
  const storedOptions = localStorage.getItem(`${OPTIONS_STORAGE_PREFIX}${key}`);
  return storedOptions ? JSON.parse(storedOptions) : [];
};

export const saveOptions = (key: string, options: SelectOption[]): void => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(`${OPTIONS_STORAGE_PREFIX}${key}`, JSON.stringify(options));
};

export const clearOptions = (key: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(`${OPTIONS_STORAGE_PREFIX}${key}`);
};