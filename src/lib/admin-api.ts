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
  if (error) {
    // FunctionsHttpError has a Response in .context — extract real body message
    const ctx = (error as unknown as { context?: Response }).context;
    if (ctx) {
      const body = await ctx.json().catch(() => null) as { error?: string } | null;
      if (body?.error) throw new Error(body.error);
    }
    throw new Error(error.message);
  }
  const d = data as { error?: string } | null;
  if (d?.error) throw new Error(d.error);
  return data as T;
}
