import { useState } from "react";
import { Registro } from "@/types/attendance";
import type { Opcoes } from "@/types/attendance";
import { uuid, sanitize } from "@/lib/audit";
import { hoje, fmt, calcHoras } from "@/lib/format-utils";
import type { TurnoConfig } from "@/lib/fechamento-utils";
import { useI18n } from "@/hooks/use-i18n";
import { Icon, Input, Select, Btn, AutocompleteNome, G } from "@/components/atoms";

export interface PessoaRow { nome: string; horaEntrada: string; horaSaida: string; cargo: string; obs: string; }
export interface FormLancamentoProps {
  inicial?: Registro | null;
  loteInicial?: Registro[];
  onSave: (registros: Registro[]) => void;
  onCancel: () => void;
  opcoes: Opcoes;
  registros?: Registro[];
  turnosConfig?: TurnoConfig[];
}

export const FormLancamento = ({ inicial, loteInicial, onSave, onCancel, opcoes, registros: todosRegistros = [], turnosConfig = [] }: FormLancamentoProps) => {
  const { t } = useI18n();
  const isEdit = !!inicial && !loteInicial?.length;
  const isLoteEdit = !!loteInicial?.length;
  const base = loteInicial?.[0] ?? inicial;

  const [comum, setComum] = useState({
    data:        base?.data        || hoje(),
    turno:       base?.turno       || opcoes.turnos[0]       || "",
    horaEntrada: base?.horaEntrada || "05:00",
    horaSaida:   base?.horaSaida   || "13:20",
    cargo:       base?.cargo       || opcoes.cargos[0]       || "",
    setor:       base?.setor       || "",
    unidade:     base?.unidade     || opcoes.unidades[0]     || "",
    cc:          base?.cc          || opcoes.ccList[0]       || "",
    motivo:      base?.motivo      || opcoes.motivos[0]      || "",
    fornecedor:  base?.fornecedor  || opcoes.fornecedores[0] || "",
    obs:         isLoteEdit ? "" : (base?.obs || ""),
  });

  const [pessoas, setPessoas] = useState<PessoaRow[]>(
    isLoteEdit
      ? loteInicial!.map(r => ({ nome: r.nome, horaEntrada: r.horaEntrada, horaSaida: r.horaSaida, cargo: r.cargo || base?.cargo || opcoes.cargos[0] || "", obs: r.obs || "" }))
      : [{ nome: inicial?.nome || "", horaEntrada: base?.horaEntrada || "05:00", horaSaida: base?.horaSaida || "13:20", cargo: base?.cargo || opcoes.cargos[0] || "", obs: "" }]
  );

  const setC = (k: string, v: string) => {
    const val = k === "obs" ? sanitize(v) : v;
    if (k === "horaEntrada") setPessoas(ps => ps.map(p => p.horaEntrada === comum.horaEntrada ? { ...p, horaEntrada: val } : p));
    if (k === "horaSaida")   setPessoas(ps => ps.map(p => p.horaSaida   === comum.horaSaida   ? { ...p, horaSaida: val }   : p));
    if (k === "turno") {
      const tc = turnosConfig.find(c => c.turno === val);
      if (tc) {
        setPessoas(ps => ps.map(p => ({ ...p, horaEntrada: tc.horaInicio, horaSaida: tc.horaFim })));
        setComum(prev => ({ ...prev, turno: val, horaEntrada: tc.horaInicio, horaSaida: tc.horaFim }));
        return;
      }
    }
    setComum(prev => ({ ...prev, [k]: val }));
  };

  const handleQtd = (n: number) => {
    const cap = Math.max(1, Math.min(20, n));
    setPessoas(prev => {
      if (cap > prev.length)
        return [...prev, ...Array.from({ length: cap - prev.length }, () => ({ nome: "", horaEntrada: comum.horaEntrada, horaSaida: comum.horaSaida, cargo: comum.cargo, obs: "" }))];
      return prev.slice(0, cap);
    });
  };

  const setP = (i: number, k: keyof PessoaRow, v: string) =>
    setPessoas(ps => ps.map((p, idx) => idx === i ? { ...p, [k]: v } : p));

  const validCount = pessoas.filter(p => p.nome.trim().length > 2).length;
  const valid = isEdit ? pessoas[0]?.nome.trim().length > 2 : validCount > 0;

  const [dupAviso, setDupAviso] = useState<string[]>([]);
  const [dupTipo, setDupTipo] = useState<"interna" | "banco">("banco");

  const handleSave = (force = false) => {
    if (!valid) return;

    if (isEdit) {
      const p = pessoas[0];
      const nomeTrimmed = sanitize(p.nome.trim());
      if (!force) {
        const conflito = todosRegistros.find(r =>
          r.id !== inicial!.id &&
          r.nome.toLowerCase() === nomeTrimmed.toLowerCase() &&
          r.data === comum.data &&
          r.turno.toLowerCase() === comum.turno.toLowerCase()
        );
        if (conflito) {
          setDupTipo("banco");
          setDupAviso([nomeTrimmed]);
          return;
        }
      }
      onSave([{ ...inicial!, ...comum, cargo: p.cargo, nome: nomeTrimmed, horaEntrada: p.horaEntrada, horaSaida: p.horaSaida, totalHoras: calcHoras(p.horaEntrada, p.horaSaida) }]);
    } else {
      const validPessoas = pessoas.filter(p => p.nome.trim().length > 2);
      if (!force) {
        const nomesNoLote = validPessoas.map(p => p.nome.trim());
        const nomesNorm = nomesNoLote.map(n => n.toLowerCase());
        const duplicatasInternas = nomesNoLote.filter(
          (_, idx) => nomesNorm.indexOf(nomesNorm[idx]) !== idx
        );
        if (duplicatasInternas.length > 0) {
          setDupTipo("interna");
          setDupAviso([...new Set(duplicatasInternas)]);
          return;
        }
        const editIds = new Set(isLoteEdit ? loteInicial!.map(r => r.id) : []);
        const mesmoTurno = nomesNoLote.filter(nome =>
          todosRegistros.some(r =>
            !editIds.has(r.id) &&
            r.nome.toLowerCase() === nome.toLowerCase() &&
            r.data === comum.data &&
            r.turno.toLowerCase() === comum.turno.toLowerCase()
          )
        );
        if (mesmoTurno.length > 0) {
          setDupTipo("banco");
          setDupAviso(mesmoTurno);
          return;
        }
      }
      const lId = isLoteEdit ? loteInicial![0].loteId : (validPessoas.length > 1 ? uuid() : undefined);
      onSave(validPessoas.map((p, i) => ({
        id: isLoteEdit ? (loteInicial![i]?.id ?? uuid()) : uuid(),
        ...(lId ? { loteId: lId } : {}),
        ...comum,
        cargo: p.cargo,
        nome: sanitize(p.nome.trim()),
        horaEntrada: p.horaEntrada,
        horaSaida: p.horaSaida,
        totalHoras: calcHoras(p.horaEntrada, p.horaSaida),
        obs: [sanitize(p.obs.trim()), comum.obs].filter(Boolean).join(' | '),
      })));
    }
  };

  const btnLabel = (isEdit || isLoteEdit)
    ? t("form_btn_save_edit")
    : validCount > 1
      ? t("form_btn_save_multi").replace("{n}", String(validCount))
      : t("form_btn_save");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Bloco 1 — Jornada */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:20, height:20, borderRadius:6, background:"#D97706", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:800 }}>1</div>
          {t("form_block_3")}
        </div>
        <G cols={2}>
          <Input label={t("form_label_data")} type="date" value={comum.data} onChange={e => setC("data", e.target.value)} />
          <Select label={t("form_label_turno")} value={comum.turno} onChange={e => setC("turno", e.target.value)}>{opcoes.turnos.map(c => <option key={c}>{c}</option>)}</Select>
        </G>
      </div>

      {/* Bloco 0 — Quantidade */}
      {!isEdit && (
        <div style={{ background:"#F0F6FF", border:"1.5px solid #BFDBFE", borderRadius:12, padding:"12px 18px", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#1A56DB", textTransform:"uppercase", letterSpacing:.8 }}>{t("form_block_qty")}</div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <button onClick={() => handleQtd(pessoas.length - 1)} style={{ width:28, height:28, borderRadius:7, border:"1.5px solid #BFDBFE", background:"#fff", cursor:"pointer", fontWeight:800, fontSize:15, color:"#1A56DB", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
            <input type="number" min={1} max={20} value={pessoas.length} onChange={e => handleQtd(Number(e.target.value))}
              style={{ width:48, textAlign:"center", border:"1.5px solid #BFDBFE", borderRadius:7, padding:"5px 6px", fontSize:15, fontWeight:800, color:"#1A56DB", fontFamily:"inherit", background:"#fff", outline:"none" }} />
            <button onClick={() => handleQtd(pessoas.length + 1)} style={{ width:28, height:28, borderRadius:7, border:"none", background:"#1A56DB", cursor:"pointer", fontWeight:800, fontSize:15, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
          </div>
          <div style={{ fontSize:12, color:"#64748B" }}>{pessoas.length !== 1 ? t("form_persons") : t("form_person")} {t("form_suffix")}</div>
        </div>
      )}

      {/* Bloco 2 — Identificação */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:20, height:20, borderRadius:6, background:"#1A56DB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:800 }}>2</div>
          {t("form_block_1")}
        </div>
        <G cols={4}>
          <Select label={t("form_label_forn")} value={comum.fornecedor} onChange={e => setC("fornecedor", e.target.value)}>{opcoes.fornecedores.map(c => <option key={c}>{c}</option>)}</Select>
          <Select label={t("form_label_unidade")} value={comum.unidade} onChange={e => setC("unidade", e.target.value)}>{opcoes.unidades.map(c => <option key={c}>{c}</option>)}</Select>
          <Select label={t("form_label_motivo")} value={comum.motivo} onChange={e => setC("motivo", e.target.value)}>{opcoes.motivos.map(c => <option key={c}>{c}</option>)}</Select>
          <Select label={t("form_label_cc")} value={comum.cc} onChange={e => setC("cc", e.target.value)}>{opcoes.ccList.map(c => <option key={c}>{c}</option>)}</Select>
        </G>
      </div>

      {/* Bloco 3 — Observações */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:20, height:20, borderRadius:6, background:"#6C63FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:800 }}>3</div>
          {t("form_block_4")}
        </div>
        <Input label={t("form_label_obs")} value={comum.obs} onChange={e => setC("obs", e.target.value)} placeholder={t("form_obs_placeholder")} />
      </div>

      {/* Bloco 4 — Colaboradores */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:20, height:20, borderRadius:6, background:"#0891B2", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:800 }}>4</div>
          {isEdit ? t("form_block_5") : `${t("form_block_5_multi")} — ${pessoas.length} ${pessoas.length !== 1 ? t("form_persons") : t("form_person")}`}
        </div>
        <div style={{ border:"1px solid #E2E6EC", borderRadius:10, overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
          <div className="mobile-form-worker-outer" style={{ minWidth:560 }}>
          <div className="mobile-form-worker-header" style={{ display:"grid", gridTemplateColumns:"36px 130px 1fr 110px 110px 62px", background:"#F8FAFC", borderBottom:"1px solid #E2E6EC", padding:"9px 14px", gap:8 }}>
            {[t("form_col_num"), t("form_label_cargo"), t("form_col_nome"), t("form_col_entrada"), t("form_col_saida"), t("form_col_total")].map(h => (
              <div key={h} style={{ fontSize:10, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:.6 }}>{h}</div>
            ))}
          </div>
          {pessoas.map((p, i) => {
            const total = calcHoras(p.horaEntrada, p.horaSaida);
            const bgRow = i % 2 === 0 ? "#fff" : "#FAFBFC";
            const notLast = i < pessoas.length - 1;
            return (
              <div key={i}>
                <div className="mobile-form-worker-grid" style={{ display:"grid", gridTemplateColumns:"36px 130px 1fr 110px 110px 62px", gap:8, padding:"8px 14px", borderBottom: isEdit && notLast ? "1px solid #F1F5F9" : "none", alignItems:"center", background: bgRow }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textAlign:"center" }}>{i + 1}</div>
                  <select value={p.cargo} onChange={e => setP(i, "cargo", e.target.value)}
                    style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"7px 8px", fontSize:12, background:"#FAFBFC", width:"100%", outline:"none", fontFamily:"inherit" }}>
                    {opcoes.cargos.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <AutocompleteNome
                    value={p.nome}
                    onChange={v => setP(i, "nome", v)}
                    suggestions={opcoes.nomes}
                    placeholder={t("form_placeholder_nome")}
                  />
                  <input type="time" value={p.horaEntrada} onChange={e => setP(i, "horaEntrada", e.target.value)}
                    style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"7px 8px", fontSize:12, fontFamily:"monospace", background:"#FAFBFC", width:"100%", outline:"none" }} />
                  <input type="time" value={p.horaSaida} onChange={e => setP(i, "horaSaida", e.target.value)}
                    style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"7px 8px", fontSize:12, fontFamily:"monospace", background:"#FAFBFC", width:"100%", outline:"none" }} />
                  <div style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color: total ? "#0E9F6E" : "#CBD5E1", textAlign:"center" }}>{total || "—"}</div>
                </div>
                {!isEdit && (
                  <div style={{ padding:"0 14px 8px", display:"flex", gap:8, alignItems:"center", background: bgRow, borderBottom: notLast ? "1px solid #F1F5F9" : "none" }}>
                    <div style={{ width:36, flexShrink:0 }} />
                    <input
                      value={p.obs}
                      onChange={e => setP(i, "obs", e.target.value)}
                      placeholder="Obs. individual (opcional)"
                      style={{ flex:1, border:"1.5px solid #E2E6EC", borderRadius:7, padding:"5px 10px",
                               fontSize:11, fontFamily:"inherit", outline:"none", background:"#FAFBFC", color:"#475569" }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          </div>
          </div>
        </div>
      </div>

      <div style={{ display:"flex", justifyContent:"flex-end", gap:8, paddingTop:16, borderTop:"1px solid #F1F5F9", flexWrap:"wrap" }}>
        <Btn variant="ghost" onClick={onCancel}>{t("form_btn_cancel")}</Btn>
        <Btn onClick={handleSave} disabled={!valid} icon={<Icon d="M5 13l4 4L19 7" />}>{btnLabel}</Btn>
      </div>

      {dupAviso.length > 0 && (
        <div style={{ background:"#FEF2F2", border:"1.5px solid #FCA5A5", borderRadius:10, padding:"14px 18px", display:"flex", flexDirection:"column", gap:10 }}>
          <div style={{ fontWeight:700, color:"#E02424", fontSize:13 }}>
            ⚠️ Lançamento duplicado detectado!
          </div>
          <div style={{ fontSize:12, color:"#7F1D1D" }}>
            {dupTipo === "interna"
              ? (dupAviso.length === 1
                  ? `O nome "${dupAviso[0]}" aparece mais de uma vez neste lote.`
                  : `${dupAviso.length} nomes estão repetidos neste lote: ${dupAviso.join(", ")}.`)
              : (dupAviso.length === 1
                  ? `"${dupAviso[0]}" já possui um registro no mesmo turno em ${fmt(comum.data, "pt-BR")}.`
                  : `${dupAviso.length} colaboradores já possuem registro no mesmo turno em ${fmt(comum.data, "pt-BR")}: ${dupAviso.join(", ")}.`)
            }
          </div>
          <div style={{ fontSize:12, color:"#374151" }}>
            {dupTipo === "interna"
              ? "Corrija ou remova os nomes duplicados antes de salvar."
              : "Para continuar, corrija os nomes/data ou clique em \"Confirmar mesmo assim\"."}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <Btn variant="ghost" onClick={() => setDupAviso([])}>{t("form_btn_cancel")}</Btn>
            {dupTipo === "banco" && (
              <Btn onClick={() => { setDupAviso([]); handleSave(true); }}
                style={{ background:"#E02424" }}>
                Confirmar mesmo assim
              </Btn>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
