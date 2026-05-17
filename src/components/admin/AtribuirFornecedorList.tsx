import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { callAdminFn } from "@/lib/admin-api";

interface UserRow {
  id: string;
  email: string;
  fornecedor: string | null;
}

interface Props {
  fornecedores: string[];
}

const card: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 12,
  boxShadow: "0 20px 40px rgba(26,28,29,0.06)",
  padding: 20,
};

const select: React.CSSProperties = {
  padding: "6px 8px",
  border: "1px solid #E5E7EB",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "inherit",
  background: "#FFFFFF",
  minWidth: 180,
};

export function AtribuirFornecedorList({ fornecedores }: Props) {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["admin-fornecedor-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, fornecedor")
        .eq("is_admin", false)
        .order("email", { ascending: true });
      if (error) throw error;
      return (data ?? []) as UserRow[];
    },
  });

  const setMutation = useMutation({
    mutationFn: async ({ userId, fornecedor }: { userId: string; fornecedor: string | null }) => {
      await callAdminFn("set_fornecedor", { userId, fornecedor });
    },
    onSuccess: () => {
      setErro(null);
      qc.invalidateQueries({ queryKey: ["admin-fornecedor-list"] });
      qc.invalidateQueries({ queryKey: ["admin-usuarios"] });
    },
    onError: (err) => setErro(err instanceof Error ? err.message : "Erro ao salvar."),
  });

  const visiveis = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return users.filter(u => {
      if (q && !u.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, filtro]);

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#212B36" }}>Atribuir fornecedor</h2>
        <input
          placeholder="Filtrar por e-mail…"
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          style={{ ...select, minWidth: 220 }}
        />
      </div>

      {erro && (
        <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          {erro}
        </div>
      )}

      {isLoading ? (
        <p style={{ fontSize: 13, color: "#9898B0" }}>Carregando…</p>
      ) : visiveis.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9898B0" }}>Nenhum usuário encontrado.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #E5E7EB", color: "#6B7280", textTransform: "uppercase", fontSize: 11, letterSpacing: "0.08em" }}>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>E-mail</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Perfil</th>
                <th style={{ textAlign: "left", padding: "10px 8px" }}>Fornecedor</th>
                <th style={{ width: 1 }} />
              </tr>
            </thead>
            <tbody>
              {visiveis.map(u => {
                const isPending = setMutation.isPending && setMutation.variables?.userId === u.id;
                const onChange = (next: string) => {
                  setMutation.mutate({ userId: u.id, fornecedor: next === "" ? null : next });
                };
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={{ padding: "10px 8px", color: "#212B36" }}>{u.email}</td>
                    <td style={{ padding: "10px 8px" }}>
                      {u.fornecedor ? (
                        <span style={{ background: "#0E9F6E15", color: "#0E9F6E", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600 }}>fornecedor</span>
                      ) : (
                        <span style={{ color: "#9CA3AF", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <select
                        style={select}
                        value={u.fornecedor ?? ""}
                        onChange={e => onChange(e.target.value)}
                        disabled={isPending}
                      >
                        <option value="">— sem fornecedor —</option>
                        {fornecedores.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: "10px 8px", color: "#9CA3AF", fontSize: 11 }}>
                      {isPending ? "salvando…" : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
