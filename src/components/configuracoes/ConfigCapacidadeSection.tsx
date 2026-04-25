import { useState } from "react";
import { dbToTurnoCapacidade, turnoCapacidadeToDb } from "@/lib/fechamento-utils";
import type { TurnoCapacidade } from "@/lib/fechamento-utils";
import { logAudit } from "@/lib/audit";
import { supabase } from "@/lib/supabase";

interface Props {
  turnos: string[];
  capacidadeConfig: TurnoCapacidade[];
  setCapacidadeConfig: (val: TurnoCapacidade[]) => void;
  isAdmin: boolean;
}

export function ConfigCapacidadeSection({ turnos, capacidadeConfig, setCapacidadeConfig, isAdmin }: Props) {
  const [newCapacidade, setNewCapacidade] = useState({ turno: "", qtdPadrao: "10", vigenciaInicio: "", vigenciaFim: "" });
  const [capacidadeSaved, setCapacidadeSaved] = useState(false);

  const addCapacidade = async () => {
    const turno = newCapacidade.turno.trim();
    const qtd = parseInt(newCapacidade.qtdPadrao, 10);
    const ini = newCapacidade.vigenciaInicio;
    const fim = newCapacidade.vigenciaFim;
    if (!turno || isNaN(qtd) || qtd <= 0 || !ini || !fim || fim < ini) return;
    const payload = turnoCapacidadeToDb({ turno, qtdPadrao: qtd, vigenciaInicio: ini, vigenciaFim: fim });
    const { data, error } = await supabase.from("turnos_capacidade").insert(payload).select();
    if (error) { if (import.meta.env.DEV) console.error("Erro ao salvar capacidade:", error.message); return; }
    if (data) {
      const novas = data.map(dbToTurnoCapacidade);
      setCapacidadeConfig([...capacidadeConfig, ...novas].sort((a, b) => a.turno.localeCompare(b.turno) || a.vigenciaInicio.localeCompare(b.vigenciaInicio)));
      setNewCapacidade({ turno: "", qtdPadrao: "10", vigenciaInicio: "", vigenciaFim: "" });
      setCapacidadeSaved(true);
      setTimeout(() => setCapacidadeSaved(false), 2000);
    }
  };

  const removeCapacidade = async (c: TurnoCapacidade) => {
    if (!c.id) return;
    const { error } = await supabase.from("turnos_capacidade").delete().eq("id", c.id);
    if (error) { if (import.meta.env.DEV) console.error("Erro ao remover capacidade:", error.message); return; }
    setCapacidadeConfig(capacidadeConfig.filter(x => x.id !== c.id));
    logAudit("DELETE", "turnos_capacidade", c.id, { turno: c.turno });
  };

  if (!isAdmin) return null;

  return (
    <div style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#6C63FF", flexShrink: 0 }} />
        <div style={{ fontWeight: 700, fontSize: 13, color: "#0F1C2E" }}>Capacidade por Turno</div>
        {capacidadeSaved && <span style={{ fontSize: 12, color: "#0E9F6E", fontWeight: 600, marginLeft: 8 }}>✓ Salvo</span>}
      </div>
      <div style={{ fontSize: 12, color: "#64748B", marginBottom: 14, paddingLeft: 20 }}>
        Define a quantidade padrão de pessoas por turno em um período. Usado para calcular excedentes na tela de lançamentos.
      </div>
      {capacidadeConfig.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 14 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E6EC" }}>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700, color: "#475569" }}>Turno</th>
                <th style={{ textAlign: "center", padding: "8px 10px", fontWeight: 700, color: "#475569" }}>Qtd. Padrão</th>
                <th style={{ textAlign: "center", padding: "8px 10px", fontWeight: 700, color: "#475569" }}>Vigência Início</th>
                <th style={{ textAlign: "center", padding: "8px 10px", fontWeight: 700, color: "#475569" }}>Vigência Fim</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {capacidadeConfig.map(c => (
                <tr key={c.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "6px 10px", fontWeight: 600, color: "#0F1C2E" }}>{c.turno}</td>
                  <td style={{ padding: "6px 10px", textAlign: "center", fontFamily: "'DM Mono',monospace", fontWeight: 700, color: "#6C63FF" }}>{c.qtdPadrao}</td>
                  <td style={{ padding: "6px 10px", textAlign: "center", fontFamily: "'DM Mono',monospace", color: "#475569" }}>{c.vigenciaInicio}</td>
                  <td style={{ padding: "6px 10px", textAlign: "center", fontFamily: "'DM Mono',monospace", color: "#475569" }}>{c.vigenciaFim}</td>
                  <td style={{ padding: "6px 4px", textAlign: "center" }}>
                    <button onClick={() => removeCapacidade(c)} title="Remover" style={{ background: "none", border: "none", cursor: "pointer", color: "#E02424", fontSize: 14, lineHeight: 1 }}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="rsp-grid-4" style={{ display: "grid", gridTemplateColumns: "1fr 100px 140px 140px auto", gap: 8, alignItems: "end" }}>
        <div>
          <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>Turno</div>
          <select value={newCapacidade.turno} onChange={e => setNewCapacidade(p => ({ ...p, turno: e.target.value }))}
            style={{ width: "100%", border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC" }}>
            <option value="">Selecione…</option>
            {turnos.map(tn => <option key={tn} value={tn}>{tn}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>Qtd. Padrão</div>
          <input type="number" min="1" step="1" value={newCapacidade.qtdPadrao}
            onChange={e => setNewCapacidade(p => ({ ...p, qtdPadrao: e.target.value }))}
            style={{ width: "100%", border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "8px 10px", fontSize: 13, fontFamily: "'DM Mono',monospace", background: "#FAFBFC" }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>Vigência Início</div>
          <input type="date" value={newCapacidade.vigenciaInicio} onChange={e => setNewCapacidade(p => ({ ...p, vigenciaInicio: e.target.value }))}
            style={{ width: "100%", border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC" }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>Vigência Fim</div>
          <input type="date" value={newCapacidade.vigenciaFim} onChange={e => setNewCapacidade(p => ({ ...p, vigenciaFim: e.target.value }))}
            style={{ width: "100%", border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC" }} />
        </div>
        <button onClick={addCapacidade} style={{ background: "#6C63FF", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit", alignSelf: "end" }}>
          Adicionar
        </button>
      </div>
    </div>
  );
}
