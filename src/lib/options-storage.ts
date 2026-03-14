"use client";

import { SelectOption } from "@/types/attendance";
import { supabase } from "@/lib/supabase";
import DOMPurify from "dompurify";

const sanitize = (str: string): string =>
  DOMPurify.sanitize(str, { USE_PROFILES: { html: false } });

export const getOptions = async (key: string): Promise<SelectOption[]> => {
  const { data, error } = await supabase
    .from("opcoes")
    .select("valor")
    .eq("chave", key)
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as { valor: string }[]).map(row => ({
    value: row.valor,
    label: row.valor,
  }));
};

export const saveOptions = async (
  key: string,
  options: SelectOption[]
): Promise<void> => {
  // Sanitizar antes de persistir
  const sanitized = options.map(o => ({
    value: sanitize(o.value),
    label: sanitize(o.label),
  }));

  // Apagar todas as opções anteriores da chave e reinserir
  const { error: delErr } = await supabase
    .from("opcoes")
    .delete()
    .eq("chave", key);
  if (delErr) throw new Error(delErr.message);

  if (sanitized.length === 0) return;

  const { error: insErr } = await supabase
    .from("opcoes")
    .insert(sanitized.map(o => ({ chave: key, valor: o.value })));
  if (insErr) throw new Error(insErr.message);
};

export const clearOptions = async (key: string): Promise<void> => {
  const { error } = await supabase
    .from("opcoes")
    .delete()
    .eq("chave", key);
  if (error) throw new Error(error.message);
};
