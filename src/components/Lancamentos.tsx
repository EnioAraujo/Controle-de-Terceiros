import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Registro } from "@/types/attendance";
import type { Opcoes } from "@/types/attendance";
import { sanitize, logAudit } from "@/lib/audit";
import { hoje, mesAtual, fmt, fornCor, buildWhatsAppMessage } from "@/lib/format-utils";
import type { WhatsAppTemplate } from "@/lib/format-utils";
import type { TurnoConfig } from "@/lib/fechamento-utils";
import type { TurnoCapacidade } from "@/lib/fechamento-utils";
import { calcExcedentePorTurnoDia } from "@/lib/excedente-utils";
import {
  type LancamentosPeriodoFiltroState,
  passaFiltroDataPeriodo,
  resolverIntervaloLancamentos,
} from "@/lib/lancamentos-filtros-utils";
import { useI18n } from "@/hooks/use-i18n";
import { Icon, Chip, Btn, Modal, Input, Select, BlockHeader } from "@/components/atoms";
import { FormLancamento } from "@/components/FormLancamento";
import { ImportRegistrosCsvModal } from "@/components/ImportRegistrosCsvModal";
import { LancamentosPeriodoFilters } from "@/components/LancamentosPeriodoFilters";
import { tk } from "@/lib/design-tokens";

/** Retorna o registro existente que conflita com `r` em turno na mesma data. */
const findConflitoDeTurno = (
  r: Registro,
  registros: Registro[],
  editIds: Set<string>,
): Registro | undefined =>
  registros.find(e =>
    !editIds.has(e.id) &&
    e.nome.toLowerCase() === r.nome.toLowerCase() &&
    e.data === r.data &&
    e.turno.toLowerCase() !== r.turno.toLowerCase()
  );

interface Filtros { data: string; turno: string; fornecedor: string; unidade: string; busca: string; }

interface ImportFeedbackState {
  importedIds: string[];
  importados: number;
  rejeitados: number;
  fonte: string;
}

const passaFiltrosLancamentos = (
  r: Registro,
  filtros: Filtros,
  intervaloPeriodo: { inicio: string; fim: string },
): boolean => {
  if (!passaFiltroDataPeriodo(r.data, filtros.data, intervaloPeriodo)) return false;
  if (filtros.turno && r.turno !== filtros.turno) return false;
  if (filtros.fornecedor && r.fornecedor !== filtros.fornecedor) return false;
  if (filtros.unidade && r.unidade !== filtros.unidade) return false;
  if (filtros.busca && !r.nome.toLowerCase().includes(filtros.busca.toLowerCase())) return false;
  return true;
};

interface LancamentosProps {
  registros: Registro[];
  setRegistros: (val: Registro[]) => void;
  opcoes: Opcoes;
  hierarquia: import("@/types/hierarquia").Hierarquia;
  turnosConfig: TurnoConfig[];
  capacidadeConfig: TurnoCapacidade[];
  isAdmin: boolean;
  waTemplate: WhatsAppTemplate;
}

export const Lancamentos = ({ registros, setRegistros, opcoes, hierarquia, turnosConfig, capacidadeConfig, isAdmin, waTemplate }: LancamentosProps) => {
  const { toast } = useToast ? useToast() : { toast: () => {} };
  const { t, lang } = useI18n();
  const [filtros, setFiltros] = useState<Filtros>({ data: hoje(), turno: "", fornecedor: "", unidade: "", busca: "" });
  const [filtroPeriodo, setFiltroPeriodo] = useState<LancamentosPeriodoFiltroState>({
    mes: mesAtual(),
    periodoIdx: null,
    customInicio: "",
    customFim: "",
  });
  const [modal, setModal]     = useState<null | "new" | Registro | Registro[]>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [detalhe, setDetalhe] = useState<Registro | Registro[] | null>(null);
  const [conflito, setConflito] = useState<{ novos: Registro[]; nomes: string[]; justificativa: string } | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFeedback, setImportFeedback] = useState<ImportFeedbackState | null>(null);

  const set = (k: keyof Filtros, v: string) => setFiltros(f => ({ ...f, [k]: v }));
  const intervaloPeriodo = useMemo(() => resolverIntervaloLancamentos(filtroPeriodo), [filtroPeriodo]);

  // Usa TODOS os registros (não filtrados) para refletir a contagem real por data+turno
  const excedenteMap = useMemo(
    () => calcExcedentePorTurnoDia(registros, capacidadeConfig),
    [registros, capacidadeConfig],
  );

  const filtered = useMemo(
    () => registros.filter(r => passaFiltrosLancamentos(r, filtros, intervaloPeriodo)),
    [registros, filtros, intervaloPeriodo],
  );

  const importadosVisiveis = useMemo(() => {
    if (!importFeedback) return 0;
    const idsVisiveis = new Set(filtered.map(r => r.id));
    return importFeedback.importedIds.filter(id => idsVisiveis.has(id)).length;
  }, [filtered, importFeedback]);

  const importadosOcultos = importFeedback ? Math.max(importFeedback.importados - importadosVisiveis, 0) : 0;

  const grupos = useMemo(() => {
    const groupMap = new Map<string, Registro[]>();
    for (const r of filtered) {
      const key = `${r.data}||${r.turno}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(r);
    }
    const result: (Registro | Registro[])[] = [];
    const seen = new Set<string>();
    for (const r of filtered) {
      const key = `${r.data}||${r.turno}`;
      if (!seen.has(key)) {
        seen.add(key);
        const group = groupMap.get(key)!;
        result.push(group.length === 1 ? group[0] : group);
      }
    }
    return result;
  }, [filtered]);

  const salvar = (novos: Registro[], forceComJustificativa = "") => {
    const nomesLote = novos.map(r => r.nome.toLowerCase());
    const semDup = novos.filter((r, idx) => nomesLote.indexOf(r.nome.toLowerCase()) === idx);

    const editIds = new Set(Array.isArray(modal) ? (modal as Registro[]).map(r => r.id) : modal && modal !== "new" ? [(modal as Registro).id] : []);
    const conflitosNome: string[] = [];
    for (const r of semDup) {
      const existente = findConflitoDeTurno(r, registros, editIds);
      if (existente) conflitosNome.push(`${r.nome} (já no ${existente.turno})`);
    }

    if (conflitosNome.length > 0 && !forceComJustificativa) {
      setConflito({ novos: semDup, nomes: conflitosNome, justificativa: "" });
      return;
    }

    const registrosFinais = forceComJustificativa
      ? semDup.map(r => {
          const temConflito = registros.some(e =>
            !editIds.has(e.id) &&
            e.nome.toLowerCase() === r.nome.toLowerCase() &&
            e.data === r.data &&
            e.turno.toLowerCase() !== r.turno.toLowerCase()
          );
          if (temConflito) {
            const obsAtual = r.obs || "";
            return { ...r, obs: `[DUPLO TURNO] ${forceComJustificativa}${obsAtual ? ` | ${obsAtual}` : ""}` };
          }
          return r;
        })
      : semDup;

    if (modal === "new") {
      setRegistros([...registros, ...registrosFinais]);
    } else if (Array.isArray(modal)) {
      const ids = new Set((modal as Registro[]).map(r => r.id));
      setRegistros([...registros.filter(r => !ids.has(r.id)), ...registrosFinais]);
    } else {
      setRegistros(registros.map(r => r.id === registrosFinais[0].id ? registrosFinais[0] : r));
    }
    setModal(null);
    setConflito(null);
  };

  // Exclusão com feedback de erro de sync
  const [excluindo, setExcluindo] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const excluir = async (ids: string[]) => {
    setExcluindo(true);
    setSyncError(null);
    try {
      await setRegistros(registros.filter(r => !ids.includes(r.id)));
      setSelectedIds([]);
      setConfirm(null);
      // Após aguardar, checar se realmente sumiu do banco (opcional: pode ser validado via reload ou callback)
    } catch (e) {
      setSyncError("Erro ao excluir: operação não persistida no banco. Verifique sua conexão ou permissões.");
    } finally {
      setExcluindo(false);
    }
  };

  const csvSafe = (val: string) => {
    if (!val) return val;
    const escaped = val.replace(/"/g, '""');
    if (/^[=+\-@|\t`]/.test(escaped) || escaped.includes(";") || escaped.includes("\n") || escaped.includes("\r")) {
      return `"'${escaped}"`;
    }
    if (escaped !== val || /[\s,"]/.test(escaped)) return `"${escaped}"`;
    return escaped;
  };

  const exportCSV = () => {
    const h = ["Data","Turno","Hora Entrada","Hora Saída","Total Horas","Nome","Cargo","Unidade","CC","Operação","Fornecedor","Obs"];
    const rows = filtered.map(r => [r.data,r.turno,r.horaEntrada,r.horaSaida,r.totalHoras,r.nome,r.cargo,r.unidade,r.cc,r.motivo,r.fornecedor,r.obs].map(csvSafe).join(";"));
    const blob = new Blob(["﻿" + [h.join(";"), ...rows].join("\n")], { type:"text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `terceiros_${filtros.data || "todos"}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {syncError && (
        <div style={{ background: tk.redLight, color: tk.redDark, border: `1px solid ${tk.redBorder}`, borderRadius: 8, padding: "8px 12px", marginBottom: 8, fontSize: 13 }}>
          {syncError}
        </div>
      )}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <BlockHeader section={t("lanc_section")} title={t("lanc_title")} />
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="ghost" id="tour-btn-export" onClick={exportCSV} icon={<Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />}>{t("lanc_btn_export")}</Btn>
          {isAdmin && (
            <Btn variant="ghost" onClick={() => setImportModalOpen(true)} icon={<Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M12 3v12M7 8l5-5 5 5" />}>
              {t("lanc_btn_import")}
            </Btn>
          )}
          <Btn id="tour-btn-novo" onClick={() => setModal("new")} icon={<Icon d="M12 5v14M5 12h14" />}>{t("lanc_btn_new")}</Btn>
        </div>
      </div>

      {importModalOpen && (
        <ImportRegistrosCsvModal
          onClose={() => setImportModalOpen(false)}
          registros={registros}
          setRegistros={setRegistros}
          onImported={setImportFeedback}
        />
      )}

      {importFeedback && (
        <div style={{ background:tk.blueBg, border:`1px solid ${tk.blueBorder}`, borderRadius:10, padding:"10px 12px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
          <div style={{ fontSize:12, color:tk.blueDark }}>
            Importação "{importFeedback.fonte || "arquivo"}": {importFeedback.importados} incluídos, {importFeedback.rejeitados} rejeitados.
            {importadosOcultos > 0 ? ` ${importadosOcultos} fora do filtro atual.` : " Todos os importados estão visíveis."}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {importadosOcultos > 0 && (
              <Btn
                small
                variant="ghost"
                onClick={() => {
                  setFiltros({ data:"", turno:"", fornecedor:"", unidade:"", busca:"" });
                  setFiltroPeriodo({ mes: "", periodoIdx: null, customInicio: "", customFim: "" });
                }}
              >
                Mostrar importados
              </Btn>
            )}
            <Btn small variant="ghost" onClick={() => setImportFeedback(null)}>Fechar aviso</Btn>
          </div>
        </div>
      )}

      <div id="tour-filtros" style={{ background:tk.white, border:`1px solid ${tk.border}`, borderRadius:12, padding:"14px 18px", display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
        <LancamentosPeriodoFilters filtroPeriodo={filtroPeriodo} onChange={setFiltroPeriodo} />
        <Input label={t("form_label_data")} type="date" value={filtros.data} onChange={e => set("data", e.target.value)} style={{ width:150 }} />
        <Select label={t("form_label_turno")} value={filtros.turno} onChange={e => set("turno", e.target.value)} style={{ width:150 }}>
          <option value="">{t("lanc_filter_all_m")}</option>{opcoes.turnos.map(opt => <option key={opt}>{opt}</option>)}
        </Select>
        <Select label={t("form_label_forn")} value={filtros.fornecedor} onChange={e => set("fornecedor", e.target.value)} style={{ width:150 }}>
          <option value="">{t("lanc_filter_all_m")}</option>{opcoes.fornecedores.map(opt => <option key={opt}>{opt}</option>)}
        </Select>
        <Select label={t("form_label_unidade")} value={filtros.unidade} onChange={e => set("unidade", e.target.value)} style={{ width:150 }}>
          <option value="">{t("lanc_filter_all_f")}</option>{opcoes.unidades.map(opt => <option key={opt}>{opt}</option>)}
        </Select>
        <Input label={t("lanc_filter_busca")} value={filtros.busca} onChange={e => set("busca", e.target.value)} placeholder="Nome…" style={{ width:180 }} />
        <div style={{ marginLeft:"auto", alignSelf:"flex-end" }}>
          <Btn
            variant="ghost"
            small
            onClick={() => {
              setFiltros({ data:"", turno:"", fornecedor:"", unidade:"", busca:"" });
              setFiltroPeriodo({ mes: "", periodoIdx: null, customInicio: "", customFim: "" });
            }}
          >
            {t("lanc_filter_clear")}
          </Btn>
        </div>
      </div>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingLeft:2 }}>
        <span style={{ fontSize:12, color:tk.textMuted }}>
          {t("lanc_showing").replace("{n}", String(filtered.length)).replace("{total}", String(registros.length))}
        </span>
        {selectedIds.length > 0 && (
          <Btn
            variant="danger"
            small
            onClick={() => setConfirm(selectedIds)}
            icon={<Icon d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />}
          >
            {`Excluir selecionados (${selectedIds.length})`}
          </Btn>
        )}
      </div>

      <div id="tour-tabela" style={{ background:tk.white, border:`1px solid ${tk.border}`, borderRadius:12, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ background:tk.surfaceLight }}>
                <th style={{ padding:"10px 12px", textAlign:"center", width:32 }}>
                  <input type="checkbox"
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={e => setSelectedIds(e.target.checked ? filtered.map(r => r.id) : [])}
                  />
                </th>
                {[t("lanc_col_data"),t("lanc_col_turno"),t("lanc_col_nome"),"Excedente",t("lanc_col_forn"),t("lanc_col_unidade"),t("lanc_col_entrada"),t("lanc_col_saida"),t("lanc_col_horas"),t("lanc_col_motivo"),t("lanc_col_acoes")].map(h => (
                  <th key={h} style={{ padding:"10px 12px", textAlign:"left", color:tk.textSecondary, fontWeight:700, fontSize:10, textTransform:"uppercase", letterSpacing:.7, whiteSpace:"nowrap", borderBottom:`2px solid ${tk.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.length === 0 && (
                <tr><td colSpan={12} style={{ textAlign:"center", padding:48, color:tk.textMuted }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
                  {t("lanc_empty")}
                </td></tr>
              )}
              {grupos.map((item, i) => {
                const isLote = Array.isArray(item);
                const r = isLote ? item[0] : item;
                const count = isLote ? item.length : 1;
                const allIds = isLote ? item.map(x => x.id) : [r.id];
                const bgBase = i % 2 === 0 ? tk.white : tk.surfaceNearly;
                const isChecked = allIds.every(id => selectedIds.includes(id));
                return (
                  <tr key={isLote ? r.loteId : r.id}
                    style={{ borderBottom:`1px solid ${tk.surfaceAlt}`, background: bgBase, cursor:"pointer",
                      borderLeft: isLote ? `3px solid ${tk.blue}` : "3px solid transparent" }}
                    onClick={() => setDetalhe(item)}
                    onMouseEnter={e => (e.currentTarget.style.background = tk.blueHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = bgBase)}>
                    <td style={{ padding:"10px 12px", textAlign:"center" }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isChecked} onChange={e => {
                        e.stopPropagation();
                        setSelectedIds(val => e.target.checked ? [...new Set([...val, ...allIds])] : val.filter(id => !allIds.includes(id)));
                      }} />
                    </td>
                    <td style={{ padding:"10px 12px", fontFamily:"monospace", fontSize:11, color:tk.textSecondary }}>{fmt(r.data, lang)}</td>
                    <td style={{ padding:"10px 12px" }}><Chip label={r.turno} color={tk.blue} /></td>
                    <td style={{ padding:"10px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ fontWeight:700, color:tk.textPrimary, whiteSpace:"nowrap" }}>{r.nome}</div>
                        {isLote && <span style={{ background:tk.blue, color:tk.white, borderRadius:99, padding:"1px 7px", fontSize:10, fontWeight:800, flexShrink:0 }}>{count}×</span>}
                      </div>
                      {isLote && <div style={{ fontSize:10, color:tk.textMuted, marginTop:2 }}>{item.slice(1, 3).map(x => x.nome).join(", ")}{count > 3 ? ` +${count - 3}` : ""}</div>}
                    </td>
                    <td style={{ padding:"10px 12px", textAlign:"center" }}>
                      {(() => {
                        const info = excedenteMap.get(`${r.data}|${r.turno}`);
                        if (!info || info.limite === null) return <span style={{ color:tk.borderMuted, fontSize:11 }}>—</span>;
                        if (info.excedente > 0) return (
                          <span style={{ background:tk.redLight, color:tk.red, borderRadius:99, padding:"2px 8px", fontSize:11, fontWeight:800 }}>+{info.excedente}</span>
                        );
                        return <span style={{ color:tk.green, fontSize:11, fontWeight:700 }}>✓</span>;
                      })()}
                    </td>
                    <td style={{ padding:"10px 12px" }}><Chip label={r.fornecedor} color={fornCor(r.fornecedor, opcoes.fornecedores)} /></td>
                    <td style={{ padding:"10px 12px" }}><Chip label={r.unidade} color={tk.green} /></td>
                    <td style={{ padding:"10px 12px", fontFamily:"monospace", color:tk.textBody }}>{r.horaEntrada}</td>
                    <td style={{ padding:"10px 12px", fontFamily:"monospace", color:tk.textBody }}>{r.horaSaida}</td>
                    <td style={{ padding:"10px 12px", fontFamily:"monospace", fontWeight:800, color:tk.green }}>{r.totalHoras}</td>
                    <td style={{ padding:"10px 12px", color:tk.textSecondary, maxWidth:150, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.motivo}</td>
                    <td style={{ padding:"10px 12px" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display:"flex", gap:5 }}>
                        <button onClick={() => setDetalhe(item)} title="Ver detalhes" style={{ background:tk.surfaceAlt, border:"none", borderRadius:6, padding:"5px 8px", cursor:"pointer", color:tk.textSecondary, display:"flex" }}><Icon d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" size={14} /></button>
                        <button onClick={() => setModal(item)} title="Editar" style={{ background:tk.blueAccent, border:"none", borderRadius:6, padding:"5px 8px", cursor:"pointer", color:tk.blue, display:"flex" }}><Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={14} /></button>
                        <button onClick={() => setConfirm(isLote ? item.map(x => x.id) : [r.id])} title="Excluir" style={{ background:tk.redBg, border:"none", borderRadius:6, padding:"5px 8px", cursor:"pointer", color:tk.red, display:"flex" }}><Icon d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal
          title={modal === "new" ? t("lanc_modal_new") : Array.isArray(modal) ? `${t("lanc_modal_edit_lote")} — ${modal.length} ${modal.length !== 1 ? t("form_persons") : t("form_person")}` : t("lanc_modal_edit")}
          subtitle="Controle de Terceiros" onClose={() => setModal(null)} xl>
          <FormLancamento
            inicial={modal === "new" || Array.isArray(modal) ? null : modal as Registro}
            loteInicial={Array.isArray(modal) ? modal : undefined}
            onSave={salvar} onCancel={() => setModal(null)} opcoes={opcoes} hierarquia={hierarquia} registros={registros} turnosConfig={turnosConfig} />
        </Modal>
      )}

      {detalhe && (
        <Modal
          title={Array.isArray(detalhe) ? `${t("lanc_detail_lote")} — ${detalhe.length} ${detalhe.length !== 1 ? t("form_persons") : t("form_person")}` : t("lanc_detail_title")}
          subtitle={Array.isArray(detalhe) ? `${fmt(detalhe[0].data, lang)} · ${detalhe[0].turno}` : detalhe.nome}
          onClose={() => setDetalhe(null)} wide={!Array.isArray(detalhe)} xl={Array.isArray(detalhe)}>
          {Array.isArray(detalhe) ? (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div className="rsp-modal-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {([
                  [t("detail_data"), fmt(detalhe[0].data, lang)], [t("detail_turno"), detalhe[0].turno],
                  [t("detail_cargo"), detalhe[0].cargo], [t("detail_forn"), detalhe[0].fornecedor],
                  [t("detail_unidade"), detalhe[0].unidade],
                  [t("detail_cc"), detalhe[0].cc], [t("detail_motivo"), detalhe[0].motivo],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} style={{ background:tk.surfaceLight, borderRadius:8, padding:"10px 14px" }}>
                    <div style={{ fontSize:10, color:tk.textMuted, fontWeight:600, textTransform:"uppercase", letterSpacing:.7, marginBottom:4 }}>{k}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:tk.textPrimary }}>{v || "—"}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:tk.textSecondary, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>{t("lanc_detail_cols")} ({detalhe.length})</div>
                <div style={{ border:`1px solid ${tk.border}`, borderRadius:8, overflow:"hidden" }}>
                  <div style={{ overflowX:"auto" }}>
                  <div style={{ minWidth:380 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 96px 96px 72px", background:tk.surfaceLight, padding:"8px 14px", gap:8, borderBottom:`1px solid ${tk.border}` }}>
                    {[t("detail_col_nome"),t("detail_col_entrada"),t("detail_col_saida"),t("detail_col_total")].map(h => <div key={h} style={{ fontSize:10, fontWeight:700, color:tk.textSecondary, textTransform:"uppercase" }}>{h}</div>)}
                  </div>
                  {detalhe.map((rec, idx) => (
                    <div key={rec.id} style={{ display:"grid", gridTemplateColumns:"1fr 96px 96px 72px", gap:8, padding:"8px 14px", background: idx%2===0?tk.white:tk.surfaceNearly, borderTop: idx > 0 ? `1px solid ${tk.surfaceAlt}` : "none" }}>
                      <span style={{ fontWeight:600, color:tk.textPrimary, fontSize:12 }}>{rec.nome}</span>
                      <span style={{ fontFamily:"monospace", color:tk.textBody, fontSize:12 }}>{rec.horaEntrada}</span>
                      <span style={{ fontFamily:"monospace", color:tk.textBody, fontSize:12 }}>{rec.horaSaida}</span>
                      <span style={{ fontFamily:"monospace", fontWeight:700, color:tk.green, fontSize:12 }}>{rec.totalHoras}</span>
                    </div>
                  ))}
                  </div>
                  </div>
                </div>
              </div>
              {detalhe[0].obs && (
                <div style={{ background:tk.amberBg, borderRadius:8, padding:"10px 14px" }}>
                  <div style={{ fontSize:10, color:tk.textMuted, fontWeight:600, textTransform:"uppercase", letterSpacing:.7, marginBottom:4 }}>{t("lanc_detail_obs")}</div>
                  <div style={{ fontSize:13, color:tk.textPrimary }}>{detalhe[0].obs}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="rsp-modal-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {([
                  [t("detail_nome"), detalhe.nome], [t("detail_cargo"), detalhe.cargo], [t("detail_forn"), detalhe.fornecedor],
                  [t("detail_data"), fmt(detalhe.data, lang)], [t("detail_turno"), detalhe.turno],
                  [t("detail_unidade"), detalhe.unidade], [t("detail_cc"), detalhe.cc],
                  [t("detail_entrada"), detalhe.horaEntrada], [t("detail_saida"), detalhe.horaSaida],
                  [t("detail_total_horas"), detalhe.totalHoras], [t("detail_motivo"), detalhe.motivo],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ background:tk.surfaceLight, borderRadius:8, padding:"10px 14px" }}>
                  <div style={{ fontSize:10, color:tk.textMuted, fontWeight:600, textTransform:"uppercase", letterSpacing:.7, marginBottom:4 }}>{k}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:tk.textPrimary }}>{v || "—"}</div>
                </div>
              ))}
              {detalhe.obs && (
                <div style={{ gridColumn:"span 2", background:tk.amberBg, borderRadius:8, padding:"10px 14px" }}>
                  <div style={{ fontSize:10, color:tk.textMuted, fontWeight:600, textTransform:"uppercase", letterSpacing:.7, marginBottom:4 }}>{t("lanc_detail_obs")}</div>
                  <div style={{ fontSize:13, color:tk.textPrimary }}>{detalhe.obs}</div>
                </div>
              )}
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:16, paddingTop:16, borderTop:`1px solid ${tk.surfaceAlt}` }}>
            <Btn variant="ghost" onClick={() => setDetalhe(null)}>{t("lanc_detail_close")}</Btn>
            <button
              onClick={() => {
                const regs = Array.isArray(detalhe) ? detalhe : [detalhe];
                const msg = buildWhatsAppMessage(regs, waTemplate);
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
              }}
              style={{ display:"inline-flex", alignItems:"center", gap:6, background:tk.whatsapp, border:"none", borderRadius:8, padding:"8px 18px", cursor:"pointer", color:tk.white, fontWeight:700, fontSize:13, fontFamily:"inherit" }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill={tk.white}><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </button>
            <Btn onClick={() => { setModal(detalhe); setDetalhe(null); }}>{t("lanc_detail_edit")}</Btn>
          </div>
        </Modal>
      )}

      {confirm && (
        <Modal title={t("lanc_confirm_title")} onClose={() => setConfirm(null)}>
          <p style={{ color:tk.textBody, fontSize:13, lineHeight:1.6 }}>
            {confirm.length > 1
              ? t("lanc_confirm_lote").replace("{n}", String(confirm.length))
              : t("lanc_confirm_single")}
          </p>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:20 }}>
            <Btn variant="ghost" onClick={() => setConfirm(null)}>{t("lanc_confirm_cancel")}</Btn>
            <Btn variant="danger" onClick={() => excluir(confirm)}>{t("lanc_confirm_delete")}</Btn>
          </div>
        </Modal>
      )}

      {conflito && (
        <Modal title="⚠️ Colaborador já lançado em outro turno" onClose={() => setConflito(null)} wide>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ background:tk.amberSurface, border:`1.5px solid ${tk.amberAccent}`, borderRadius:10, padding:"14px 18px" }}>
              <div style={{ fontWeight:700, color:tk.amber, fontSize:13, marginBottom:8 }}>
                {conflito.nomes.length === 1
                  ? `${conflito.nomes[0]} já tem registro em outro turno nesta data.`
                  : `${conflito.nomes.length} colaboradores já têm registro em outro turno nesta data:`}
              </div>
              {conflito.nomes.length > 1 && (
                <ul style={{ margin:0, paddingLeft:18, fontSize:12, color:tk.amberDeep }}>
                  {conflito.nomes.map(n => <li key={n}>{n}</li>)}
                </ul>
              )}
            </div>
            <div style={{ fontSize:12, color:tk.textGray }}>
              Para registrar em dois turnos no mesmo dia, informe o motivo abaixo. A justificativa será salva no campo Obs do registro.
            </div>
            <textarea
              value={conflito.justificativa}
              onChange={e => setConflito(c => c ? { ...c, justificativa: sanitize(e.target.value) } : c)}
              placeholder="Ex: horas extras autorizadas, cobertura de falta emergencial, dobra de turno..."
              rows={3}
              style={{
                border:`1.5px solid ${conflito.justificativa.trim().length > 0 ? tk.amberAccent : tk.border}`,
                borderRadius:8, padding:"10px 12px", fontSize:12, fontFamily:"inherit",
                resize:"vertical", outline:"none", width:"100%", boxSizing:"border-box", background:tk.surfaceNearly
              }}
            />
            <div style={{ display:"flex", justifyContent:"flex-end", gap:8 }}>
              <Btn variant="ghost" onClick={() => setConflito(null)}>Cancelar</Btn>
              <Btn
                onClick={() => {
                  const j = conflito.justificativa.trim();
                  if (!j) return;
                  const novos = conflito.novos;
                  setConflito(null);
                  salvar(novos, j);
                }}
                disabled={conflito.justificativa.trim().length === 0}
                style={{
                  background: conflito.justificativa.trim().length > 0 ? tk.amber : undefined,
                  opacity: conflito.justificativa.trim().length === 0 ? 0.45 : 1
                }}>
                Confirmar com justificativa
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
