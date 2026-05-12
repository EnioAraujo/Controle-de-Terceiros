import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface BatchLine {
  id: number;
  nome: string;
  cargo: string;
  erro?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  cargos: string[];
  onSaveAll: (itens: { nome: string; cargo: string }[]) => Promise<{ inseridos: number }>;
}

let nextId = 0;
const newLine = (cargo: string): BatchLine => ({ id: nextId++, nome: "", cargo });

const inputS: React.CSSProperties = {
  padding: "10px",
  border: "1px solid #E5E7EB",
  borderRadius: 6,
  fontSize: 13,
  fontFamily: "inherit",
  background: "#FFFFFF",
};

export function AddPessoasBatchSheet({ open, onClose, cargos, onSaveAll }: Props) {
  const defaultCargo = cargos[0] ?? "";
  const [linhas, setLinhas] = useState<BatchLine[]>(() => [newLine(defaultCargo)]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const update = (id: number, field: "nome" | "cargo", value: string) =>
    setLinhas(ls => ls.map(l => l.id === id ? { ...l, [field]: value, erro: undefined } : l));

  const remove = (id: number) =>
    setLinhas(ls => ls.length === 1 ? ls : ls.filter(l => l.id !== id));

  const addLine = () => setLinhas(ls => [...ls, newLine(defaultCargo)]);

  const handleSave = async () => {
    const validated = linhas.map(l => {
      const nome = l.nome.replace(/\s+/g, " ").trim().toUpperCase();
      if (!nome) return { ...l, erro: "Nome obrigatório." };
      if (!l.cargo) return { ...l, erro: "Cargo obrigatório." };
      return { ...l, nome };
    });
    if (validated.some(l => l.erro)) { setLinhas(validated); return; }
    const itens = validated.map(l => ({ nome: l.nome, cargo: l.cargo }));
    setBusy(true); setMsg(null);
    try {
      const { inseridos } = await onSaveAll(itens);
      setMsg({ ok: true, text: `${inseridos} funcionário(s) adicionado(s).` });
      setLinhas([newLine(defaultCargo)]);
      setTimeout(onClose, 1500);
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Erro ao salvar." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="bottom" style={{ padding: 20, paddingBottom: 32, maxHeight: "90vh", overflowY: "auto" }}>
        <SheetHeader style={{ marginBottom: 16 }}>
          <SheetTitle>Adicionar vários</SheetTitle>
        </SheetHeader>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {linhas.map(l => (
            <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6 }}>
              <input
                style={{ ...inputS, borderColor: l.erro ? "#EF4444" : "#E5E7EB" }}
                placeholder="Nome"
                value={l.nome}
                onChange={e => update(l.id, "nome", e.target.value)}
                autoCapitalize="characters"
                disabled={busy}
              />
              <select
                style={{ ...inputS, borderColor: l.erro ? "#EF4444" : "#E5E7EB" }}
                value={l.cargo}
                onChange={e => update(l.id, "cargo", e.target.value)}
                disabled={busy}
              >
                <option value="">—</option>
                {cargos.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                type="button"
                onClick={() => remove(l.id)}
                disabled={busy}
                style={{ background: "none", border: "1px solid #FCA5A5", borderRadius: 6, color: "#EF4444", cursor: "pointer", padding: "0 8px", fontSize: 16 }}
                aria-label="Remover linha"
              >×</button>
              {l.erro && <p style={{ gridColumn: "1/-1", color: "#EF4444", fontSize: 12, margin: 0 }}>{l.erro}</p>}
            </div>
          ))}
          <button
            type="button"
            onClick={addLine}
            disabled={busy}
            style={{ background: "none", border: "1px dashed #D1D5DB", borderRadius: 8, padding: "10px", fontSize: 13, color: "#6B7280", cursor: "pointer" }}
          >
            + Adicionar linha
          </button>
          {msg && (
            <p style={{ color: msg.ok ? "#065F46" : "#991B1B", fontSize: 13, margin: 0 }}>{msg.text}</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            style={{ width: "100%", padding: 14, background: busy ? "#9CA3AF" : "#212B36", color: "#FFF", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: busy ? "default" : "pointer", marginTop: 4 }}
          >
            {busy ? "Salvando…" : "Salvar todos"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
