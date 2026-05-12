import { supabase } from "@/lib/supabase";

export type AdminAction =
  | "create"
  | "update"
  | "delete"
  | "set_fornecedor";

export async function callAdminFn<T = unknown>(
  action: AdminAction,
  params: Record<string, unknown> = {},
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("admin-users", {
    body: { action, ...params },
  });
  if (error) throw new Error(error.message);
  const d = data as { error?: string } | null;
  if (d?.error) throw new Error(d.error);
  return data as T;
}
