import { useState, useEffect } from "react";
import { dbToTurnoConfig, dbToDiariaConfig } from "@/lib/fechamento-utils";
import type { TurnoConfig, DiariaConfig } from "@/lib/fechamento-utils";
import { useI18n } from "@/hooks/use-i18n";
import { supabase, authReady } from "@/lib/supabase";

interface Props {
  fornecedores: string[];
  turnos: string[];
  isAdminOrMod: boolean;
}

export function ConfigTurnosDiariasSection({ fornecedores, turnos, isAdminOrMod }: Props) {
  const { t } = useI18n();
  const [turnosConfig, setTurnosConfig] = useState<TurnoConfig[]>([]);
  const [turnosConfigSaved, setTurnosConfigSaved] = useState(false);
  const [diariasConfig, setDiariasConfig] = useState<DiariaConfig[]>([]);
  const [newDiaria, setNewDiaria] = useState({ fornecedor: "", turno: "", valor: "250", vigenciaInicio: "", vigenciaFim: "" });

  useEffect(() => {
    authReady.then(async () => {
      const { data: tData, error: tErr } = await supabase.from("turnos_config").select("*").order("turno");
      if (tErr) console.error("Erro ao carregar turnos_config:", tErr.message);
      if (tData) setTurnosConfig(tData.map(dbToTurnoConfig));
      const { data: dData, error: dErr } = await supabase.from("diarias_config").select("*").order("fornecedor");
      if (dErr) console.error("Erro ao carregar diarias_config:", dErr.message);
      if (dData) setDiariasConfig(dData.map(dbToDiariaConfig));
    }).catch((err: unknown) => console.error("Erro ao carregar configs:", err));
  }, []);

  const saveTurnosConfig = async () => {
    let hasError = false;
    for (const tc of turnosConfig) {
      const { error } = await supabase.from("turnos_config").upsert(
        { turno: tc.turno, hora_inicio: tc.horaInicio, hora_fim: tc.horaFim, hora_padrao: tc.horaPadrao },
        { onConflict: "turno" }
      );
      if (error) { console.error("Erro ao salvar turno:", error.message); hasError = true; }
    }
    if (!hasError) { setTurnosConfigSaved(true); setTimeout(() => setTurnosConfigSaved(false), 2000); }
  };

  const addDiaria = async () => {
    const forn = newDiaria.fornecedor.trim();
    const turno = newDiaria.turno.trim() || null;
    const valor = parseFloat(newDiaria.valor);
    const vigIni = newDiaria.vigenciaInicio.trim() || null;
    const vigFim = newDiaria.vigenciaFim.trim() || null;
    if (!forn || isNaN(valor)) return;
    if (vigIni && vigFim && vigFim < vigIni) return;
    const { data, error } = await supabase.from("diarias_config")
      .insert({ fornecedor: forn, turno, valor_diaria: valor, vigencia_inicio: vigIni, vigencia_fim: vigFim })
      .select();
    if (!error && data) {
      setDiariasConfig(prev => [...prev, ...data.map(dbToDiariaConfig)].sort((a, b) => a.fornecedor.localeCompare(b.fornecedor)));
      setNewDiaria({ fornecedor: "", turno: "", valor: "250", vigenciaInicio: "", vigenciaFim: "" });
    } else if (error) {
      if (import.meta.env.DEV) console.error("Erro ao salvar diária:", error.message);
    }
  };

  const removeDiaria = async (d: DiariaConfig) => {
    if (!d.id) return;
    const { error } = await supabase.from("diarias_config").delete().eq("id", d.id);
    if (error) { if (import.meta.env.DEV) console.error("Erro ao remover diária:", error.message); return; }
    setDiariasConfig(prev => prev.filter(x => x.id !== d.id));
  };

  if (!isAdminOrMod) return null;

  return (
    <>
      {/* Horas Padrão por Turno */}
      <div style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#0891B2", flexShrink: 0 }} />
          <div style={{ fontWeight: 700, fontSize: 13, color: "#0F1C2E" }}>{t("cfg_turnos_horas_title")}</div>
        </div>
        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 14, paddingLeft: 20 }}>{t("cfg_turnos_horas_desc")}</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E6EC" }}>
                <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700, color: "#475569" }}>{t("cfg_turnos_turno")}</th>
                <th style={{ textAlign: "center", padding: "8px 10px", fontWeight: 700, color: "#475569" }}>{t("cfg_turnos_inicio")}</th>
                <th style={{ textAlign: "center", padding: "8px 10px", fontWeight: 700, color: "#475569" }}>{t("cfg_turnos_fim")}</th>
                <th style={{ textAlign: "center", padding: "8px 10px", fontWeight: 700, color: "#475569" }}>{t("cfg_turnos_padrao")}</th>
              </tr>
            </thead>
            <tbody>
              {turnosConfig.map((tc, idx) => (
                <tr key={tc.turno} style={{ borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "6px 10px", fontWeight: 600, color: "#0F1C2E" }}>{tc.turno}</td>
                  <td style={{ textAlign: "center", padding: "6px 10px" }}>
                    <input type="time" value={tc.horaInicio} onChange={e => { const v = [...turnosConfig]; v[idx] = { ...tc, horaInicio: e.target.value }; setTurnosConfig(v); }}
                      style={{ border: "1.5px solid #E2E6EC", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "'DM Mono',monospace", textAlign: "center", background: "#FAFBFC" }} />
                  </td>
                  <td style={{ textAlign: "center", padding: "6px 10px" }}>
                    <input type="time" value={tc.horaFim} onChange={e => { const v = [...turnosConfig]; v[idx] = { ...tc, horaFim: e.target.value }; setTurnosConfig(v); }}
                      style={{ border: "1.5px solid #E2E6EC", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "'DM Mono',monospace", textAlign: "center", background: "#FAFBFC" }} />
                  </td>
                  <td style={{ textAlign: "center", padding: "6px 10px" }}>
                    <input type="time" value={tc.horaPadrao} onChange={e => { const v = [...turnosConfig]; v[idx] = { ...tc, horaPadrao: e.target.value }; setTurnosConfig(v); }}
                      style={{ border: "1.5px solid #E2E6EC", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "'DM Mono',monospace", textAlign: "center", background: "#FAFBFC", fontWeight: 700 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
          <button onClick={saveTurnosConfig} style={{ background: "#0891B2", border: "none", borderRadius: 8, padding: "9px 22px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
            {t("cfg_turnos_salvar")}
          </button>
          {turnosConfigSaved && <span style={{ fontSize: 12, color: "#0E9F6E", fontWeight: 600 }}>{t("cfg_turnos_salvo")}</span>}
        </div>
      </div>

      {/* Valor das Diárias */}
      <div style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#D97706", flexShrink: 0 }} />
          <div style={{ fontWeight: 700, fontSize: 13, color: "#0F1C2E" }}>{t("cfg_diarias_title")}</div>
        </div>
        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 14, paddingLeft: 20 }}>
          {t("cfg_diarias_desc")} <span style={{ color: "#94A3B8" }}>{t("cfg_diarias_padrao")}</span>
        </div>
        {diariasConfig.length > 0 && (
          <div style={{ overflowX: "auto", marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E6EC" }}>
                  <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700, color: "#475569" }}>{t("cfg_diarias_forn")}</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700, color: "#475569" }}>{t("cfg_diarias_turno")}</th>
                  <th style={{ textAlign: "right", padding: "8px 10px", fontWeight: 700, color: "#475569" }}>{t("cfg_diarias_valor")}</th>
                  <th style={{ textAlign: "center", padding: "8px 10px", fontWeight: 700, color: "#475569" }}>Vigência</th>
                  <th style={{ width: 40 }} />
                </tr>
              </thead>
              <tbody>
                {diariasConfig.map(d => (
                  <tr key={d.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "6px 10px", fontWeight: 600, color: "#0F1C2E" }}>{d.fornecedor}</td>
                    <td style={{ padding: "6px 10px", color: "#475569" }}>{d.turno ?? t("cfg_diarias_todos_turnos")}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "'DM Mono',monospace", fontWeight: 700, color: "#0E9F6E" }}>R$ {d.valorDiaria.toFixed(2)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "center", fontFamily: "'DM Mono',monospace", fontSize: 11, color: "#475569", whiteSpace: "nowrap" }}>
                      {d.vigenciaInicio ? `${d.vigenciaInicio} → ${d.vigenciaFim ?? "…"}` : <span style={{ color: "#CBD5E1" }}>—</span>}
                    </td>
                    <td style={{ padding: "6px 4px", textAlign: "center" }}>
                      <button onClick={() => removeDiaria(d)} title="Remover" style={{ background: "none", border: "none", cursor: "pointer", color: "#E02424", fontSize: 14, lineHeight: 1 }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="rsp-grid-4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 130px 130px auto", gap: 8, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>{t("cfg_diarias_forn")}</div>
            <select value={newDiaria.fornecedor} onChange={e => setNewDiaria(p => ({ ...p, fornecedor: e.target.value }))}
              style={{ width: "100%", border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC" }}>
              <option value="">{t("fech_selecione_forn")}</option>
              {fornecedores.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>{t("cfg_diarias_turno")}</div>
            <select value={newDiaria.turno} onChange={e => setNewDiaria(p => ({ ...p, turno: e.target.value }))}
              style={{ width: "100%", border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC" }}>
              <option value="">{t("cfg_diarias_todos_turnos")}</option>
              {turnos.map(tn => <option key={tn} value={tn}>{tn}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>{t("cfg_diarias_valor")}</div>
            <input type="number" min="0" step="0.01" value={newDiaria.valor}
              onChange={e => setNewDiaria(p => ({ ...p, valor: e.target.value }))}
              style={{ width: "100%", border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "8px 10px", fontSize: 13, fontFamily: "'DM Mono',monospace", background: "#FAFBFC" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>De (opcional)</div>
            <input type="date" value={newDiaria.vigenciaInicio} onChange={e => setNewDiaria(p => ({ ...p, vigenciaInicio: e.target.value }))}
              style={{ width: "100%", border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC" }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>Até (opcional)</div>
            <input type="date" value={newDiaria.vigenciaFim} onChange={e => setNewDiaria(p => ({ ...p, vigenciaFim: e.target.value }))}
              style={{ width: "100%", border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "8px 10px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC" }} />
          </div>
          <button onClick={addDiaria} style={{ background: "#D97706", border: "none", borderRadius: 8, padding: "9px 18px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit", alignSelf: "end" }}>
            {t("cfg_diarias_add")}
          </button>
        </div>
      </div>
    </>
  );
}
