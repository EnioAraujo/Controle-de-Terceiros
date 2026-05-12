import { useMemo, useState } from "react";
import type { Pessoa } from "@/types/hierarquia";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PessoaTableRow, type PessoaEditState } from "./PessoaTableRow";

interface Props {
  pessoas: Pessoa[];
  cargos: string[];
  onAdd:    (nome: string, cargo: string) => Promise<void>;
  onUpdate: (id: number, partial: Partial<Pick<Pessoa, "nome" | "cargo">>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const card: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 12,
  boxShadow: "0 20px 40px rgba(26,28,29,0.06)",
  padding: 20,
};

const input: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #E5E7EB",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "inherit",
  background: "#FFFFFF",
  outline: "none",
};

const btnPrimary: React.CSSProperties = {
  padding: "8px 14px",
  background: "#212B36",
  color: "#FFFFFF",
  border: "none",
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  padding: "4px 10px",
  background: "transparent",
  border: "1px solid #E5E7EB",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase();

const PAGE_SIZE = 20;

export function CrudPessoasSection({ pessoas, cargos, onAdd, onUpdate, onDelete }: Props) {
  const [busca, setBusca] = useState("");
  const [page, setPage] = useState(0);
  const [novoNome, setNovoNome] = useState("");
  const [novoCargo, setNovoCargo] = useState("");
  const [editing, setEditing] = useState<PessoaEditState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Pessoa | null>(null);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return pessoas;
    return pessoas.filter(p =>
      p.nome.toLowerCase().includes(q) || p.cargo.toLowerCase().includes(q)
    );
  }, [pessoas, busca]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages - 1);
  const visiveis = filtradas.slice(pageSafe * PAGE_SIZE, (pageSafe + 1) * PAGE_SIZE);

  const handleAdd = async () => {
    const nome = normalize(novoNome);
    if (!nome || !novoCargo) { setErro("Informe nome e cargo."); return; }
    if (pessoas.some(p => p.nome === nome)) { setErro("Já existe funcionário com esse nome."); return; }
    setBusy(true); setErro(null);
    try { await onAdd(nome, novoCargo); setNovoNome(""); setNovoCargo(""); }
    catch (err) { setErro(err instanceof Error ? err.message : "Erro ao adicionar."); }
    finally { setBusy(false); }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const nome = normalize(editing.nome);
    if (!nome || !editing.cargo) { setErro("Informe nome e cargo."); return; }
    setBusy(true); setErro(null);
    try { await onUpdate(editing.id, { nome, cargo: editing.cargo }); setEditing(null); }
    catch (err) { setErro(err instanceof Error ? err.message : "Erro ao salvar."); }
    finally { setBusy(false); }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true); setErro(null);
    try { await onDelete(pendingDelete.id); setPendingDelete(null); }
    catch (err) { setErro(err instanceof Error ? err.message : "Erro ao excluir."); }
    finally { setBusy(false); }
  };

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#212B36" }}>Funcionários</h2>
        <input style={{ ...input, minWidth: 220 }} placeholder="Buscar nome ou cargo…" value={busca} onChange={e => { setBusca(e.target.value); setPage(0); }} />
      </div>

      {/* Adicionar */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8, marginBottom: 12 }}>
        <input style={input} placeholder="Nome completo…" value={novoNome} onChange={e => setNovoNome(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} disabled={busy} />
        <select style={input} value={novoCargo} onChange={e => setNovoCargo(e.target.value)} disabled={busy}>
          <option value="">— Cargo —</option>
          {cargos.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" style={btnPrimary} onClick={handleAdd} disabled={busy}>Adicionar</button>
      </div>

      {erro && (
        <div style={{ background: "#FEE2E2", color: "#991B1B", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12 }}>{erro}</div>
      )}

      {/* Tabela */}
      {filtradas.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9CA3AF" }}>Nenhum funcionário encontrado.</p>
      ) : (
        <>
          <div style={{ overflowX: "auto", border: "1px solid #E5E7EB", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead style={{ background: "#F9FAFB" }}>
                <tr style={{ color: "#6B7280", textTransform: "uppercase", fontSize: 11, letterSpacing: "0.08em" }}>
                  <th style={{ textAlign: "left", padding: "10px 12px" }}>Nome</th>
                  <th style={{ textAlign: "left", padding: "10px 12px", width: 220 }}>Cargo</th>
                  <th style={{ width: 1 }} />
                </tr>
              </thead>
              <tbody>
                {visiveis.map(p => (
                  <PessoaTableRow
                    key={p.id}
                    pessoa={p}
                    cargos={cargos}
                    editing={editing}
                    busy={busy}
                    onEditStart={(x) => setEditing({ id: x.id, nome: x.nome, cargo: x.cargo })}
                    onEditChange={setEditing}
                    onEditCancel={() => setEditing(null)}
                    onEditSave={handleSaveEdit}
                    onDeleteAsk={setPendingDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 12, fontSize: 12, color: "#6B7280" }}>
              <button type="button" style={btnGhost} onClick={() => setPage(p => Math.max(0, p - 1))} disabled={pageSafe === 0}>◀</button>
              <span>Página {pageSafe + 1} de {totalPages}</span>
              <button type="button" style={btnGhost} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={pageSafe >= totalPages - 1}>▶</button>
            </div>
          )}
        </>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionário</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `Tem certeza que deseja excluir "${pendingDelete.nome}"? Esta ação não pode ser desfeita.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={busy}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
