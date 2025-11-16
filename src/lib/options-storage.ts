"use client";

import { SelectOption } from "@/types/attendance";
import DOMPurify from "dompurify";

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
  // Sanitize each option's value and label before saving
  const sanitizedOptions = options.map(option => ({
    value: DOMPurify.sanitize(option.value, { USE_PROFILES: { html: false } }),
    label: DOMPurify.sanitize(option.label, { USE_PROFILES: { html: false } }),
  }));
  localStorage.setItem(`${OPTIONS_STORAGE_PREFIX}${key}`, JSON.stringify(sanitizedOptions));
};

export const clearOptions = (key: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(`${OPTIONS_STORAGE_PREFIX}${key}`);
};