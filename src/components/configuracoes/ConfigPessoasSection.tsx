import { useState, CSSProperties } from "react";
import type { Pessoa } from "@/types/hierarquia";
import type { HierarquiaApi } from "@/hooks/useHierarquia";
import { sanitize } from "@/lib/audit";
import { Icon } from "@/components/atoms";

interface Props {
  pessoas: Pessoa[];
  cargos: string[];
  fornecedores: string[];
  api: HierarquiaApi;
  isAdminOrMod: boolean;
}

const inStyle: CSSProperties = {
  border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "6px 10px",
  fontSize: 12, fontFamily: "inherit", outline: "none", background: "#FAFBFC",
};

const norm = (s: string) => sanitize(s.trim().toUpperCase());

export function ConfigPessoasSection({ pessoas, cargos, fornecedores, api, isAdminOrMod }: Props) {
  const [busca, setBusca]        = useState("");
  const [novoNome, setNovoNome]  = useState("");
  const [novoCargo, setNovoCargo]= useState(cargos[0] ?? "");
  const [novoForn, setNovoForn]  = useState(fornecedores[0] ?? "");
  const [editing, setEditing]    = useState<{ id: number; nome: string; cargo: string; fornecedor: string } | null>(null);

  if (!isAdminOrMod) return null;

  const handleAdd = async () => {
    const v = norm(novoNome);
    if (!v || pessoas.some(p => p.nome === v)) return;
    await api.addPessoa({ nome: v, cargo: novoCargo, fornecedor: novoForn });
    setNovoNome("");
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const v = norm(editing.nome);
    if (!v) { setEditing(null); return; }
    await api.updatePessoa(editing.id, { nome: v, cargo: editing.cargo, fornecedor: editing.fornecedor });
    setEditing(null);
  };

  const filtradas = pessoas.filter(p =>
    !busca
    || p.nome.toLowerCase().includes(busca.toLowerCase())
    || p.cargo.toLowerCase().includes(busca.toLowerCase())
    || p.fornecedor.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#334155" }} />
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0F1C2E" }}>Pessoas (Nome + Cargo + Fornecedor)</div>
        <div style={{ fontSize: 11, background: "#33415518", color: "#334155", fontWeight: 700, borderRadius: 99, padding: "2px 8px" }}>{pessoas.length}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 6, marginBottom: 12 }}>
        <input value={novoNome} onChange={e => setNovoNome(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder="Nome completo..." style={inStyle} />
        <select value={novoCargo} onChange={e => setNovoCargo(e.target.value)} style={inStyle}>
          <option value="">— Cargo —</option>
          {cargos.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={novoForn} onChange={e => setNovoForn(e.target.value)} style={inStyle}>
          <option value="">— Fornecedor —</option>
          {fornecedores.map(f => <option key={f}>{f}</option>)}
        </select>
        <button onClick={handleAdd}
          style={{ background: "#334155", border: "none", borderRadius: 7, padding: "6px 14px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13 }}>+</button>
      </div>

      <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar pessoa, cargo ou fornecedor..."
        style={{ ...inStyle, width: "100%", marginBottom: 8 }} />

      <div style={{ border: "1px solid #E2E6EC", borderRadius: 8, maxHeight: 320, overflowY: "auto" }}>
        {filtradas.length === 0 && (
          <div style={{ color: "#94A3B8", fontSize: 12, textAlign: "center", padding: 24 }}>
            {pessoas.length === 0 ? "Nenhuma pessoa cadastrada." : "Nenhum resultado."}
          </div>
        )}
        {filtradas.map((p, idx) => {
          const isEdit = editing?.id === p.id;
          return (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 6, alignItems: "center", padding: "7px 12px", borderBottom: idx < filtradas.length - 1 ? "1px solid #F1F5F9" : "none", fontSize: 12 }}>
              {isEdit ? (
                <>
                  <input value={editing.nome} onChange={e => setEditing({ ...editing, nome: e.target.value })}
                    style={{ ...inStyle, padding: "4px 8px" }} autoFocus />
                  <select value={editing.cargo} onChange={e => setEditing({ ...editing, cargo: e.target.value })}
                    style={{ ...inStyle, padding: "4px 8px" }}>
                    <option value="">—</option>
                    {editing.cargo && !cargos.includes(editing.cargo) && <option value={editing.cargo}>{editing.cargo} (legado)</option>}
                    {cargos.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <select value={editing.fornecedor} onChange={e => setEditing({ ...editing, fornecedor: e.target.value })}
                    style={{ ...inStyle, padding: "4px 8px" }}>
                    <option value="">—</option>
                    {editing.fornecedor && !fornecedores.includes(editing.fornecedor) && <option value={editing.fornecedor}>{editing.fornecedor} (legado)</option>}
                    {fornecedores.map(f => <option key={f}>{f}</option>)}
                  </select>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={handleSaveEdit} title="Salvar"
                      style={{ background: "#0E9F6E", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer", color: "#fff", fontSize: 11, fontWeight: 700 }}>OK</button>
                    <button onClick={() => setEditing(null)} title="Cancelar"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 2, display: "flex" }}>
                      <Icon d="M18 6L6 18M6 6l12 12" size={12} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span style={{ color: "#0F1C2E", fontWeight: 600 }}>{p.nome}</span>
                  <span style={{ color: "#475569" }}>{p.cargo || "—"}</span>
                  <span style={{ color: "#475569" }}>{p.fornecedor || "—"}</span>
                  <div style={{ display: "flex", gap: 2 }}>
                    <button onClick={() => setEditing({ id: p.id, nome: p.nome, cargo: p.cargo, fornecedor: p.fornecedor })} title="Editar"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: 2, display: "flex" }}>
                      <Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={12} />
                    </button>
                    <button onClick={async () => { if (confirm(`Excluir "${p.nome}"?`)) await api.deletePessoa(p.id); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#CBD5E1", padding: 2, display: "flex" }}>
                      <Icon d="M18 6L6 18M6 6l12 12" size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
