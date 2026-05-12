import { useEffect, useState } from "react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import type { Pessoa } from "@/types/hierarquia";

interface Props {
  open: boolean;
  onClose: () => void;
  cargos: string[];
  pessoaInicial?: Pessoa | null;
  onSave: (nome: string, cargo: string) => Promise<void>;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  border: "1px solid #E5E7EB",
  borderRadius: 8,
  fontSize: 15,
  fontFamily: "inherit",
  background: "#FFFFFF",
};

export function AddPessoaSheet({ open, onClose, cargos, pessoaInicial, onSave }: Props) {
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNome(pessoaInicial?.nome ?? "");
      setCargo(pessoaInicial?.cargo ?? cargos[0] ?? "");
      setErro(null);
    }
  }, [open, pessoaInicial, cargos]);

  const handleSave = async () => {
    const n = nome.replace(/\s+/g, " ").trim().toUpperCase();
    if (!n) { setErro("Informe o nome."); return; }
    if (!cargo) { setErro("Selecione o cargo."); return; }
    setBusy(true); setErro(null);
    try {
      await onSave(n, cargo);
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setBusy(false);
    }
  };

  const isEdit = !!pessoaInicial;

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="bottom" style={{ padding: 20, paddingBottom: 32 }}>
        <SheetHeader style={{ marginBottom: 16 }}>
          <SheetTitle>{isEdit ? "Editar funcionário" : "Adicionar funcionário"}</SheetTitle>
        </SheetHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            style={inputStyle}
            placeholder="Nome completo"
            value={nome}
            onChange={e => setNome(e.target.value)}
            disabled={busy}
            autoCapitalize="characters"
          />
          <select style={inputStyle} value={cargo} onChange={e => setCargo(e.target.value)} disabled={busy}>
            <option value="">— Cargo —</option>
            {cargos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {erro && <p style={{ color: "#EF4444", fontSize: 13, margin: 0 }}>{erro}</p>}
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            style={{
              width: "100%",
              padding: 14,
              background: busy ? "#9CA3AF" : "#212B36",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 700,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? "Salvando…" : isEdit ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
