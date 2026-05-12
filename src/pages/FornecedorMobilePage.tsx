import { useState } from "react";
import { useFornecedorAtual } from "@/hooks/useFornecedorAtual";
import { useTerceirosDoFornecedor } from "@/hooks/useTerceirosDoFornecedor";
import { useOpcoes } from "@/hooks/useOpcoes";
import { useAuthStatus } from "@/hooks/useAuthStatus";
import { PessoaMobileCard } from "@/components/fornecedor/mobile/PessoaMobileCard";
import { AddPessoaSheet } from "@/components/fornecedor/mobile/AddPessoaSheet";
import { AddPessoasBatchSheet } from "@/components/fornecedor/mobile/AddPessoasBatchSheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import type { Pessoa } from "@/types/hierarquia";

export default function FornecedorMobilePage() {
  const { fornecedor, isFornecedorUser, loading: fornLoading } = useFornecedorAtual();
  const { pessoas, loading, addPessoa, updatePessoa, deletePessoa, upsertMany } = useTerceirosDoFornecedor();
  const [opcoes] = useOpcoes();
  const { signOut } = useAuthStatus();
  const cargos = (opcoes.cargos ?? []).slice().sort((a, b) => a.localeCompare(b, "pt-BR"));

  const [sheetOpen, setSheetOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [editPessoa, setEditPessoa] = useState<Pessoa | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Pessoa | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  if (fornLoading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',system-ui,sans-serif" }}><p style={{ color: "#64748B" }}>Carregando…</p></div>;
  }

  const handleSaveSingle = async (nome: string, cargo: string) => {
    if (editPessoa) {
      await updatePessoa(editPessoa.id, { nome, cargo });
    } else {
      await addPessoa(nome, cargo);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deletePessoa(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setDeleteErr(err instanceof Error ? err.message : "Erro ao excluir.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F3F4F6", fontFamily: "'DM Sans',system-ui,sans-serif", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ background: "#212B36", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 9, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, margin: 0 }}>Fornecedor</p>
          <p style={{ fontSize: 13, color: "#F8FAFC", fontWeight: 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isFornecedorUser ? fornecedor : "—"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setBatchOpen(true)} style={{ background: "transparent", border: "1px solid #2E3B4A", borderRadius: 8, padding: "5px 10px", color: "#D1D5DB", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            + Vários
          </button>
          <button type="button" onClick={() => signOut()} style={{ background: "transparent", border: "1px solid #2E3B4A", borderRadius: 8, padding: "5px 10px", color: "#EF4444", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
            Sair
          </button>
        </div>
      </div>

      {/* Count */}
      <div style={{ padding: "12px 16px 4px" }}>
        <p style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, margin: 0 }}>{pessoas.length} funcionário(s){loading ? " · sincronizando…" : ""}</p>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 16px 120px", display: "flex", flexDirection: "column", gap: 10 }}>
        {pessoas.length === 0 && !loading && (
          <p style={{ color: "#9CA3AF", fontSize: 13, textAlign: "center", marginTop: 40 }}>Nenhum funcionário cadastrado. Toque + para adicionar.</p>
        )}
        {pessoas.map(p => (
          <PessoaMobileCard
            key={p.id}
            pessoa={p}
            onEdit={x => { setEditPessoa(x); setSheetOpen(true); }}
            onDelete={setPendingDelete}
          />
        ))}
      </div>

      {/* FAB */}
      <button
        type="button"
        onClick={() => { setEditPessoa(null); setSheetOpen(true); }}
        aria-label="Adicionar funcionário"
        style={{ position: "fixed", bottom: 28, right: 20, width: 56, height: 56, borderRadius: "50%", background: "#F37E38", border: "none", boxShadow: "0 4px 16px rgba(243,126,56,0.45)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
      >
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg>
      </button>

      {/* Sheets */}
      <AddPessoaSheet
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setEditPessoa(null); }}
        cargos={cargos}
        pessoaInicial={editPessoa}
        onSave={handleSaveSingle}
      />
      <AddPessoasBatchSheet
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        cargos={cargos}
        onSaveAll={upsertMany}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!pendingDelete} onOpenChange={o => { if (!o) { setPendingDelete(null); setDeleteErr(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionário</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `Excluir "${pendingDelete.nome}"? Esta ação não pode ser desfeita.` : ""}
              {deleteErr && <span style={{ color: "#EF4444", display: "block", marginTop: 8 }}>{deleteErr}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
