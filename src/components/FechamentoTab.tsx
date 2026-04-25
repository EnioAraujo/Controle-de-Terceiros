import { useState, useMemo, useCallback, useEffect } from "react";
import type { Registro } from "@/types/attendance";
import type { Opcoes } from "@/types/attendance";
import { supabase, authReady } from "@/lib/supabase";
import { logAudit, sanitize } from "@/lib/audit";
import type { TranslationKey } from "@/lib/i18n-translations";
import { fmt, mesAtual } from "@/lib/format-utils";
import {
  type TurnoConfig, type DiariaConfig, type FechamentoItem, type Fechamento,
  type FechamentoStatus, type ResumoPessoa, type TurnoCapacidade,
  dbToTurnoConfig, dbToDiariaConfig,
  dbToFechamento, fechamentoToDb,
  dbToFechamentoItem, fechamentoItemToDb,
  gerarItensFechamento, calcularTotal, agruparPorPessoa,
  periodosPadrao,
  STATUS_COLORS, NEXT_STATUS,
} from "@/lib/fechamento-utils";
import {
  dividirItensPorFornecedor,
  filtrarRegistrosPorFornecedoresEPeriodo,
  mapearFornecedorPorRegistroId,
} from "@/lib/fechamento-multifornecedor-utils";
import { gerarDadosRelatorioExcedentes } from "@/lib/excedente-utils";
import { useI18n } from "@/hooks/use-i18n";
import { BlockHeader } from "@/components/atoms";
import { FornecedoresMultiSelect } from "@/components/fechamento/FornecedoresMultiSelect";

const STATUS_LABEL_KEY: Record<FechamentoStatus, TranslationKey> = {
  rascunho: "fech_status_rascunho",
  enviado:  "fech_status_enviado",
  revisao:  "fech_status_revisao",
  aprovado: "fech_status_aprovado",
};

export const FechamentoTab = ({ registros, opcoes, capacidadeConfig }: { registros: Registro[]; opcoes: Opcoes; capacidadeConfig: TurnoCapacidade[] }) => {
  const { t, lang } = useI18n();

  // ── Filtros ──
  const [mes, setMes] = useState(mesAtual());
  const [periodoIdx, setPeriodoIdx] = useState(0);
  const [customInicio, setCustomInicio] = useState("");
  const [customFim, setCustomFim] = useState("");
  const [fornecedores, setFornecedores] = useState<string[]>([]);
  const [fornecedorPorRegistroId, setFornecedorPorRegistroId] = useState<Record<string, string>>({});

  // ── Dados calculados ──
  const [itens, setItens] = useState<FechamentoItem[]>([]);
  const [resumoPessoas, setResumoPessoas] = useState<ResumoPessoa[]>([]);
  const [total, setTotal] = useState(0);
  const [calculado, setCalculado] = useState(false);

  // ── Fechamento salvo ──
  const [fechamento, setFechamento] = useState<Fechamento | null>(null);
  const [historico, setHistorico] = useState<Fechamento[]>([]);
  const [feedback, setFeedback] = useState("");
  const [feedbackTipo, setFeedbackTipo] = useState<"success" | "error" | null>(null);

  // ── Configs (carregar do DB) ──
  const [turnosConfig, setTurnosConfig] = useState<TurnoConfig[]>([]);
  const [diariasConfig, setDiariasConfig] = useState<DiariaConfig[]>([]);

  // ── Edição inline ──
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editValor, setEditValor] = useState("");
  const [editObs, setEditObs] = useState("");

  useEffect(() => {
    let isMounted = true;
    authReady.then(async () => {
      const { data: tData, error: tErr } = await supabase.from("turnos_config").select("*").order("turno");
      if (tErr) console.error("Erro ao carregar turnos_config:", tErr.message);
      const { data: dData, error: dErr } = await supabase.from("diarias_config").select("*").order("fornecedor");
      if (dErr) console.error("Erro ao carregar diarias_config:", dErr.message);
      const { data: hData, error: hErr } = await supabase.from("fechamentos").select("*").order("created_at", { ascending: false }).limit(50);
      if (hErr) console.error("Erro ao carregar histórico:", hErr.message);
      if (!isMounted) return;
      if (tData) setTurnosConfig(tData.map(dbToTurnoConfig));
      if (dData) setDiariasConfig(dData.map(dbToDiariaConfig));
      if (hData) setHistorico(hData.map(dbToFechamento));
    }).catch((err: unknown) => console.error("Erro ao carregar configs do fechamento:", err));
    return () => { isMounted = false; };
  }, []);

  const periodos = useMemo(() => periodosPadrao(mes), [mes]);

  const intervalo = useMemo(() => {
    if (periodoIdx === 3) return { inicio: customInicio, fim: customFim };
    const p = periodos[periodoIdx];
    return p ? { inicio: p.inicio, fim: p.fim } : { inicio: "", fim: "" };
  }, [periodoIdx, periodos, customInicio, customFim]);

  const calcular = useCallback(() => {
    if (fornecedores.length === 0 || !intervalo.inicio || !intervalo.fim) return;
    const regs = filtrarRegistrosPorFornecedoresEPeriodo(
      registros,
      fornecedores,
      intervalo.inicio,
      intervalo.fim,
    );
    const items = gerarItensFechamento(
      regs.map(r => ({
        id: r.id, nome: r.nome, data: r.data,
        turno: r.turno, totalHoras: r.totalHoras, fornecedor: r.fornecedor,
      })),
      diariasConfig, turnosConfig,
    );
    setItens(items);
    setResumoPessoas(agruparPorPessoa(items));
    setTotal(calcularTotal(items));
    setFornecedorPorRegistroId(mapearFornecedorPorRegistroId(regs));
    setCalculado(true);
    setFechamento(null);
    setEditIdx(null);
    setFeedback("");
    setFeedbackTipo(null);
  }, [fornecedores, intervalo, registros, diariasConfig, turnosConfig]);

  const aplicarEdicao = (idx: number) => {
    const val = parseFloat(editValor);
    if (isNaN(val) || val <= 0 || val > 100_000) return;
    setItens(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], valorCalculado: val, ajusteManual: true, obs: editObs };
      setTotal(calcularTotal(next));
      setResumoPessoas(agruparPorPessoa(next));
      return next;
    });
    setEditIdx(null);
  };

  const salvarFechamentoFornecedor = async (
    fornecedorAlvo: string,
    itensAlvo: FechamentoItem[],
    totalAlvo: number,
    fechamentoAtual: Fechamento | null,
  ): Promise<{ success: boolean; saved?: Fechamento }> => {
    if (itensAlvo.length === 0) return { success: false };

    const fech: Fechamento = fechamentoAtual ?? {
      fornecedor: fornecedorAlvo,
      dataInicio: intervalo.inicio,
      dataFim: intervalo.fim,
      status: "rascunho",
      valorTotal: totalAlvo,
    };

    fech.valorTotal = totalAlvo;
    const dbFech = fechamentoToDb(fech);

    const { data: savedFech, error } = fech.id
      ? await supabase.from("fechamentos").update(dbFech).eq("id", fech.id).select().single()
      : await supabase.from("fechamentos").insert(dbFech).select().single();

    if (error || !savedFech) return { success: false };

    const fechId = savedFech.id as string;
    const { error: delErr } = await supabase.from("fechamento_itens").delete().eq("fechamento_id", fechId);
    if (delErr) {
      console.error("Erro ao limpar itens:", delErr.message);
      return { success: false };
    }

    const { error: insErr } = await supabase.from("fechamento_itens").insert(itensAlvo.map((i) => fechamentoItemToDb(i, fechId)));
    if (insErr) {
      console.error("Erro ao inserir itens:", insErr.message);
      return { success: false };
    }

    const savedObj = dbToFechamento(savedFech);
    logAudit(fech.id ? "UPDATE" : "INSERT", "fechamentos", fechId, { fornecedor: fornecedorAlvo, total: totalAlvo });
    return { success: true, saved: savedObj };
  };

  const salvar = async () => {
    if (fornecedores.length === 0 || itens.length === 0) return;

    if (fornecedores.length === 1) {
      const fornecedorAtual = fornecedores[0];
      const result = await salvarFechamentoFornecedor(fornecedorAtual, itens, total, fechamento?.fornecedor === fornecedorAtual ? fechamento : null);
      if (!result.success || !result.saved) {
        setFeedback(t("fech_erro_salvar"));
        setFeedbackTipo("error");
        return;
      }

      setFechamento(result.saved);
      setHistorico((prev) => [result.saved!, ...prev.filter((h) => h.id !== result.saved!.id)]);
      setFeedback(t("fech_salvo_sucesso"));
      setFeedbackTipo("success");
      setTimeout(() => {
        setFeedback("");
        setFeedbackTipo(null);
      }, 3000);
      return;
    }

    const lotes = dividirItensPorFornecedor(itens, fornecedores, fornecedorPorRegistroId).filter((l) => l.itens.length > 0);
    let sucesso = 0;
    let erro = 0;
    const salvos: Fechamento[] = [];

    for (const lote of lotes) {
      const result = await salvarFechamentoFornecedor(lote.fornecedor, lote.itens, lote.total, null);
      if (result.success && result.saved) {
        sucesso += 1;
        salvos.push(result.saved);
      } else {
        erro += 1;
      }
    }

    if (salvos.length > 0) {
      setHistorico((prev) => [...salvos, ...prev.filter((h) => !salvos.some((s) => s.id === h.id))]);
    }

    if (sucesso > 0 && erro === 0) {
      setFeedback(t("fech_salvo_lote_sucesso").replace("{ok}", String(sucesso)));
      setFeedbackTipo("success");
    } else if (sucesso > 0 && erro > 0) {
      setFeedback(t("fech_salvo_lote_parcial").replace("{ok}", String(sucesso)).replace("{erro}", String(erro)));
      setFeedbackTipo("error");
    } else {
      setFeedback(t("fech_erro_salvar"));
      setFeedbackTipo("error");
    }

    setFechamento(null);
    setTimeout(() => {
      setFeedback("");
      setFeedbackTipo(null);
    }, 3000);
  };

  const avancarStatus = async () => {
    if (!fechamento?.id) return;
    const next = NEXT_STATUS[fechamento.status];
    if (!next) return;
    const { error } = await supabase.from("fechamentos").update({ status: next }).eq("id", fechamento.id);
    if (!error) {
      const updated = { ...fechamento, status: next };
      setFechamento(updated);
      logAudit("UPDATE", "fechamentos", fechamento.id, { status: next });
      setHistorico(prev => prev.map(h => h.id === fechamento.id ? updated : h));
    }
  };

  const voltarRevisao = async () => {
    if (!fechamento?.id || fechamento.status !== "enviado") return;
    const { error } = await supabase.from("fechamentos").update({ status: "revisao" }).eq("id", fechamento.id);
    if (!error) {
      const updated = { ...fechamento, status: "revisao" as FechamentoStatus };
      setFechamento(updated);
      logAudit("UPDATE", "fechamentos", fechamento.id, { status: "revisao" });
      setHistorico(prev => prev.map(h => h.id === fechamento.id ? updated : h));
    }
  };

  const abrirFechamento = async (f: Fechamento) => {
    if (!f.id) return;
    setFornecedores([f.fornecedor]);
    setMes(f.dataInicio.slice(0, 7));
    setPeriodoIdx(3);
    setCustomInicio(f.dataInicio);
    setCustomFim(f.dataFim);
    const { data, error } = await supabase.from("fechamento_itens").select("*").eq("fechamento_id", f.id).order("nome").order("data");
    if (error) { console.error("Erro ao carregar itens:", error.message); return; }
    if (data) {
      const items = data.map(dbToFechamentoItem);
      setItens(items);
      setResumoPessoas(agruparPorPessoa(items));
      setTotal(calcularTotal(items));
      const map: Record<string, string> = {};
      items.forEach((item) => {
        if (item.registroId) map[item.registroId] = f.fornecedor;
      });
      setFornecedorPorRegistroId(map);
    }
    setFechamento(f);
    setCalculado(true);
    setEditIdx(null);
    setFeedback("");
    setFeedbackTipo(null);
  };

  const excluirFechamento = async (f: Fechamento) => {
    if (!f.id || !confirm(t("fech_confirmar_excluir"))) return;
    const { error: eiErr } = await supabase.from("fechamento_itens").delete().eq("fechamento_id", f.id);
    if (eiErr) { console.error("Erro ao excluir itens:", eiErr.message); return; }
    const { error: efErr } = await supabase.from("fechamentos").delete().eq("id", f.id);
    if (efErr) { console.error("Erro ao excluir fechamento:", efErr.message); return; }
    logAudit("DELETE", "fechamentos", f.id);
    setHistorico(prev => prev.filter(h => h.id !== f.id));
    if (fechamento?.id === f.id) { setFechamento(null); setItens([]); setCalculado(false); }
  };

  const exportarPdf = async () => {
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(`Fechamento — ${fornecedoresLabel} (${fmt(intervalo.inicio, lang)} a ${fmt(intervalo.fim, lang)})`, 14, 16);
      autoTable(doc, {
        startY: 22,
        head: [[t("fech_col_data"), t("fech_col_turno"), t("fech_col_nome"), t("fech_col_horas"), t("fech_col_diaria"), t("fech_col_vlr_dia"), t("fech_col_diff"), t("fech_col_obs")]],
        body: itens.map(i => [fmt(i.data, lang), i.turno, i.nome, i.horas, fmtCurrency(i.valorDiaria), fmtCurrency(i.valorCalculado), (() => { const d = i.valorCalculado - i.valorDiaria; return d !== 0 ? fmtCurrency(d) : "—"; })(), i.obs ?? ""]),
        foot: [[""  , "", "", "", t("fech_total"), fmtCurrency(total), "", ""]],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [26, 86, 219], textColor: 255, fontStyle: "bold" },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 28, 46], fontStyle: "bold" },
        columnStyles: { 5: { textColor: [14, 159, 110] } },
      });
      doc.save(`fechamento_${fornecedoresSlug}_${intervalo.inicio}_${intervalo.fim}.pdf`);
    } catch (err) { console.error("Erro ao exportar PDF:", err); }
  };

  const exportarXlsx = async () => {
    try {
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Fechamento");
      const headers = [
        t("fech_col_data"), t("fech_col_turno"), t("fech_col_nome"), t("fech_col_horas"),
        t("fech_col_diaria"), t("fech_col_vlr_dia"), t("fech_col_diff"), t("fech_col_obs"),
      ];
      ws.columns = headers.map(h => ({ header: h, key: h, width: 18 }));
      itens.forEach(i => ws.addRow({
        [t("fech_col_data")]: fmt(i.data, lang),
        [t("fech_col_turno")]: i.turno,
        [t("fech_col_nome")]: i.nome,
        [t("fech_col_horas")]: i.horas,
        [t("fech_col_diaria")]: i.valorDiaria,
        [t("fech_col_vlr_dia")]: i.valorCalculado,
        [t("fech_col_diff")]: i.valorCalculado - i.valorDiaria,
        [t("fech_col_obs")]: i.obs ?? "",
      }));
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fechamento_${fornecedoresSlug}_${intervalo.inicio}_${intervalo.fim}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error("Erro ao exportar XLSX:", err); }
  };

  const exportarExcedentesXlsx = async () => {
    try {
      const regs = registros.filter(r =>
        r.data >= intervalo.inicio && r.data <= intervalo.fim,
      );
      const linhas = gerarDadosRelatorioExcedentes(regs, capacidadeConfig);
      if (linhas.length === 0) return;
      const ExcelJS = await import("exceljs");
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Excedentes");
      ws.columns = [
        { header: "Data",         key: "data",       width: 14 },
        { header: "Turno",        key: "turno",      width: 14 },
        { header: "Capacidade",   key: "capacidade", width: 14 },
        { header: "Total Pessoas",key: "total",      width: 16 },
        { header: "Excedente",    key: "excedente",  width: 14 },
      ];
      linhas.forEach(l => ws.addRow({
        data:       fmt(l.data, lang),
        turno:      l.turno,
        capacidade: l.capacidade ?? "—",
        total:      l.total,
        excedente:  l.excedente,
      }));
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `excedentes_${intervalo.inicio}_${intervalo.fim}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error("Erro ao exportar excedentes XLSX:", err); }
  };

  const fmtCurrency = (v: number) => v.toLocaleString(lang, { style: "currency", currency: "BRL" });
  const fornecedoresLabel = fornecedores.join(", ");
  const fornecedoresSlug = fornecedores.join("_").replace(/\s+/g, "-");

  // suprimir warning de resumoPessoas não usado — o dado existe para extensões futuras
  void resumoPessoas;

  const periodoBtns = [
    { label: t("fech_periodo_1"), idx: 0 },
    { label: t("fech_periodo_2"), idx: 1 },
    { label: t("fech_periodo_3"), idx: 2 },
    { label: t("fech_periodo_custom"), idx: 3 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <BlockHeader section={t("fech_section")} title={t("fech_title")} desc={t("fech_desc")} />

      {/* ── Barra de Filtros ── */}
      <div style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, padding: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div>
          <label style={{ fontSize: 11, color: "#64748B", fontWeight: 600, display: "block", marginBottom: 4 }}>{t("fech_mes")}</label>
          <input type="month" value={mes} onChange={e => { setMes(e.target.value); setCalculado(false); }}
            style={{ border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC", outline: "none" }} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "#64748B", fontWeight: 600, display: "block", marginBottom: 4 }}>{t("fech_periodo")}</label>
          <div style={{ display: "flex", gap: 4 }}>
            {periodoBtns.map(pb => (
              <button key={pb.idx} onClick={() => { setPeriodoIdx(pb.idx); setCalculado(false); }}
                style={{ padding: "6px 12px", borderRadius: 7, border: "1.5px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: periodoIdx === pb.idx ? "#1A56DB" : "#fff", color: periodoIdx === pb.idx ? "#fff" : "#64748B", borderColor: periodoIdx === pb.idx ? "#1A56DB" : "#E2E6EC" }}>
                {pb.label}
              </button>
            ))}
          </div>
        </div>
        {periodoIdx === 3 && (
          <>
            <div>
              <label style={{ fontSize: 11, color: "#64748B", fontWeight: 600, display: "block", marginBottom: 4 }}>{t("fech_data_inicio")}</label>
              <input type="date" value={customInicio} onChange={e => { setCustomInicio(e.target.value); setCalculado(false); }}
                style={{ border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC", outline: "none" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#64748B", fontWeight: 600, display: "block", marginBottom: 4 }}>{t("fech_data_fim")}</label>
              <input type="date" value={customFim} onChange={e => { setCustomFim(e.target.value); setCalculado(false); }}
                style={{ border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC", outline: "none" }} />
            </div>
          </>
        )}
        <div>
          <FornecedoresMultiSelect
            fornecedores={opcoes.fornecedores}
            selecionados={fornecedores}
            onChange={(novos) => {
              setFornecedores(novos);
              setCalculado(false);
              setFechamento(null);
              setFeedback("");
              setFeedbackTipo(null);
            }}
            label={t("fech_fornecedor")}
            placeholder={t("fech_selecione_forn")}
            selectedSuffix={t("fech_fornecedores_sel")}
          />
        </div>
        <button onClick={calcular} disabled={fornecedores.length === 0 || !intervalo.inicio || !intervalo.fim}
          style={{ background: "#1A56DB", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit", opacity: fornecedores.length === 0 ? 0.5 : 1 }}>
          {calculado ? t("fech_recalcular") : t("fech_calcular")}
        </button>
      </div>

      {/* ── Resumo + Tabela + Ações ── */}
      {calculado && (
        <div style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
            <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 20px", flex: 1, minWidth: 120, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: .6, marginBottom: 4 }}>{t("fech_presencas")}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1A56DB" }}>{itens.length}</div>
            </div>
            <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 20px", flex: 1, minWidth: 120, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: .6, marginBottom: 4 }}>{t("fech_total")}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0E9F6E" }}>{fmtCurrency(total)}</div>
            </div>
            {fechamento && (
              <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 20px", flex: 1, minWidth: 120, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: .6, marginBottom: 4 }}>{t("fech_status")}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: STATUS_COLORS[fechamento.status] }}>
                  {t(STATUS_LABEL_KEY[fechamento.status])}
                </div>
              </div>
            )}
          </div>

          {itens.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>{t("fech_sem_registros")}</div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#F1F5F9", textAlign: "left" }}>
                      {[t("fech_col_data"), t("fech_col_turno"), t("fech_col_nome"), t("fech_col_horas"), t("fech_col_diaria"), t("fech_col_vlr_dia"), t("fech_col_diff"), t("fech_col_obs"), t("fech_col_acoes")].map(h => (
                        <th key={h} style={{ padding: "8px 10px", fontWeight: 700, color: "#475569", borderBottom: "2px solid #E2E6EC", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9", background: item.ajusteManual ? "#FFFBEB" : "transparent" }}>
                        <td style={{ padding: "7px 10px", color: "#64748B", fontFamily: "monospace" }}>{fmt(item.data, lang)}</td>
                        <td style={{ padding: "7px 10px", color: "#64748B" }}>{item.turno}</td>
                        <td style={{ padding: "7px 10px", fontWeight: 600, color: "#0F1C2E", whiteSpace: "nowrap" }}>{item.nome}</td>
                        <td style={{ padding: "7px 10px", color: "#64748B", fontFamily: "monospace" }}>{item.horas}</td>
                        <td style={{ padding: "7px 10px", color: "#64748B" }}>{fmtCurrency(item.valorDiaria)}</td>
                        {editIdx === idx ? (
                          <>
                            <td style={{ padding: "4px 6px" }}>
                              <input type="number" step="0.01" value={editValor} onChange={e => setEditValor(e.target.value)}
                                style={{ width: 80, border: "1.5px solid #1A56DB", borderRadius: 5, padding: "4px 6px", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                            </td>
                            <td></td>
                            <td style={{ padding: "4px 6px" }}>
                              <input value={editObs} onChange={e => setEditObs(sanitize(e.target.value))} placeholder={t("fech_col_obs")}
                                style={{ width: 100, border: "1.5px solid #E2E6EC", borderRadius: 5, padding: "4px 6px", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                            </td>
                            <td style={{ padding: "4px 6px", whiteSpace: "nowrap" }}>
                              <button onClick={() => aplicarEdicao(idx)} style={{ background: "#0E9F6E", border: "none", borderRadius: 5, padding: "4px 10px", color: "#fff", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit", marginRight: 4 }}>✓</button>
                              <button onClick={() => setEditIdx(null)} style={{ background: "#F1F5F9", border: "none", borderRadius: 5, padding: "4px 10px", color: "#64748B", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: "7px 10px", fontWeight: 700, color: item.ajusteManual ? "#D97706" : "#0E9F6E" }}>{fmtCurrency(item.valorCalculado)}</td>
                            {(() => { const diff = item.valorCalculado - item.valorDiaria; return (
                              <td style={{ padding: "7px 10px", fontWeight: 700, color: diff < 0 ? "#E02424" : diff > 0 ? "#0E9F6E" : "#94A3B8" }}>
                                {diff !== 0 ? fmtCurrency(diff) : "—"}
                              </td>
                            ); })()}
                            <td style={{ padding: "7px 10px", color: "#94A3B8", fontSize: 11, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.obs}</td>
                            <td style={{ padding: "7px 10px" }}>
                              <button onClick={() => { setEditIdx(idx); setEditValor(String(item.valorCalculado)); setEditObs(item.obs); }}
                                title={t("fech_ajuste")}
                                style={{ background: "transparent", border: "1px solid #E2E6EC", borderRadius: 5, padding: "3px 8px", cursor: "pointer", color: "#64748B", fontSize: 11, fontFamily: "inherit" }}>
                                ✎
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F1F5F9" }}>
                      <td colSpan={5} style={{ padding: "8px 10px", fontWeight: 800, color: "#0F1C2E", textAlign: "right" }}>{t("fech_total")}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 800, color: "#0E9F6E" }}>{fmtCurrency(total)}</td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16, alignItems: "center" }}>
                <button onClick={salvar} style={{ background: "#1A56DB", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                  {fornecedores.length > 1 ? t("fech_salvar_lote") : t("fech_salvar")}
                </button>
                {fechamento && NEXT_STATUS[fechamento.status] && (
                  <button onClick={avancarStatus} style={{ background: STATUS_COLORS[NEXT_STATUS[fechamento.status]!], border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                    {t("fech_avancar_status")}
                  </button>
                )}
                {fechamento?.status === "enviado" && (
                  <button onClick={voltarRevisao} style={{ background: "#E02424", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                    {t("fech_voltar_revisao")}
                  </button>
                )}
                <button onClick={exportarXlsx} style={{ background: "#0E9F6E", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                  {t("fech_exportar_xlsx")}
                </button>
                <button onClick={exportarExcedentesXlsx} disabled={capacidadeConfig.length === 0}
                  title={capacidadeConfig.length === 0 ? "Configure a capacidade por turno em Configurações" : "Exportar relatório de excedentes por turno/dia"}
                  style={{ background: "#6C63FF", border: "none", borderRadius: 8, padding: "8px 16px", cursor: capacidadeConfig.length === 0 ? "not-allowed" : "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit", opacity: capacidadeConfig.length === 0 ? 0.5 : 1 }}>
                  Excedentes XLSX
                </button>
                <button onClick={exportarPdf} style={{ background: "#E02424", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                  {t("fech_exportar_pdf")}
                </button>
                {feedback && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: feedbackTipo === "success" ? "#0E9F6E" : "#E02424", background: feedbackTipo === "success" ? "#E6F9F4" : "#FEF2F2", borderRadius: 7, padding: "6px 14px" }}>
                    {feedback}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Histórico de fechamentos ── */}
      <div style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#0F1C2E", marginBottom: 12 }}>{t("fech_historico")}</div>
        {historico.length === 0 ? (
          <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 12, padding: 24 }}>{t("fech_nenhum_salvo")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {historico.map(h => (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC", borderRadius: 8, padding: "8px 14px", fontSize: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  <span style={{ fontWeight: 700, color: "#0F1C2E" }}>{h.fornecedor}</span>
                  <span style={{ color: "#64748B", fontFamily: "monospace" }}>{fmt(h.dataInicio, lang)} → {fmt(h.dataFim, lang)}</span>
                  <span style={{ fontWeight: 700, color: STATUS_COLORS[h.status], fontSize: 11, background: `${STATUS_COLORS[h.status]}18`, borderRadius: 99, padding: "2px 8px" }}>
                    {t(STATUS_LABEL_KEY[h.status])}
                  </span>
                  <span style={{ fontWeight: 700, color: "#0E9F6E" }}>{fmtCurrency(h.valorTotal)}</span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => abrirFechamento(h)} style={{ background: "#1A56DB18", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", color: "#1A56DB", fontWeight: 700, fontSize: 11, fontFamily: "inherit" }}>
                    {t("fech_abrir")}
                  </button>
                  <button onClick={() => excluirFechamento(h)} style={{ background: "#FEF2F2", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", color: "#E02424", fontWeight: 700, fontSize: 11, fontFamily: "inherit" }}>
                    {t("fech_excluir")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
