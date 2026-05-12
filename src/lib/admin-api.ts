import { supabase } from "@/lib/supabase";

export type AdminAction =
  | "create"
  | "update"
  | "delete"
  | "set_fornecedor";

export interface AdminApiPayload extends Record<string, unknown> {
  action: AdminAction;
}

export async function callAdminFn<T = unknown>(
  action: AdminAction,
  params: Record<string, unknown> = {},
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");

  const res = await fetch("/api/admin-users", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ action, ...params }),
  });

  const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
  if ((json as { error?: string }).error) throw new Error((json as { error?: string }).error);
  return json as T;
}
