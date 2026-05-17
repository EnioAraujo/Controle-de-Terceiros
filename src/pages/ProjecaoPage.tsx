import { useState, useMemo, useEffect, CSSProperties } from "react";
import { Registro, type Opcoes } from "@/types/attendance";
import { supabase, authReady } from "@/lib/supabase";
import { useI18n } from "@/hooks/use-i18n";
import { hoje, fmt, mesAtual } from "@/lib/format-utils";
import { type DiariaConfig, dbToDiariaConfig, resolverDiaria } from "@/lib/fechamento-utils";
import { TURNOS_PROJECAO, gerarDias, calcMediaPorTurno, calcDadosPorDia } from "@/lib/projecao-utils";
import { tk } from "@/lib/design-tokens";

// ─── CONSTANTES ──────────────────────────────────────────────────
const TURNOS_DEMANDA = TURNOS_PROJECAO;
const TURNO_CORES: Record<string, string> = { "1ª TURNO": tk.blue, "2ª TURNO": tk.amber, "3ª TURNO": tk.green };

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────
const ProjecaoPage = ({ registros, opcoes }: { registros: Registro[]; opcoes: Opcoes }) => {
  const { t, lang } = useI18n();
  const fmtCurrency = (v: number) => v.toLocaleString(lang, { style: "currency", currency: "BRL" });

  // ── Filtros ──
  const [fornFiltro, setFornFiltro] = useState("");
  const [mesFiltro, setMesFiltro] = useState(mesAtual());
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  // ── Projeção futura (range de datas + qtd total) ──
  const [projInicio, setProjInicio] = useState("");
  const [projFim, setProjFim] = useState("");
  const [projQtdTotal, setProjQtdTotal] = useState("");

  // ── Config de diárias ──
  const [diariasConfig, setDiariasConfig] = useState<DiariaConfig[]>([]);
  useEffect(() => {
    authReady.then(async () => {
      const { data, error } = await supabase.from("diarias_config").select("*").order("fornecedor");
      if (error && import.meta.env.DEV) console.error("Erro ao carregar diarias_config:", error.message);
      if (data) setDiariasConfig(data.map(dbToDiariaConfig));
    }).catch((err: unknown) => { if (import.meta.env.DEV) console.error("Erro ao carregar diarias_config:", err); });
  }, []);

  // Calcular range (do mês selecionado ou range custom)
  const range = useMemo(() => {
    if (dataInicio && dataFim) return { inicio: dataInicio, fim: dataFim };
    const [y, m] = mesFiltro.split("-").map(Number);
    const ultimoDia = new Date(y, m, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    return { inicio: `${mesFiltro}-01`, fim: `${mesFiltro}-${pad(ultimoDia)}` };
  }, [mesFiltro, dataInicio, dataFim]);

  // Registros reais filtrados
  const regsFiltrados = useMemo(() => {
    return registros.filter(r => {
      if (r.data < range.inicio || r.data > range.fim) return false;
      if (fornFiltro && r.fornecedor !== fornFiltro) return false;
      if (!TURNOS_DEMANDA.includes(r.turno)) return false;
      return true;
    });
  }, [registros, range, fornFiltro]);

  // Gerar todos os dias do range
  const diasDoRange = useMemo(() => gerarDias(range.inicio, range.fim), [range]);

  // Médias históricas por turno (usa TODOS os registros, não só o mês filtrado)
  const mediasHistoricas = useMemo(
    () => calcMediaPorTurno(registros, TURNOS_DEMANDA, fornFiltro),
    [registros, fornFiltro],
  );

  // Dias de projeção futura (auto-swap se datas invertidas)
  const diasProjecao = useMemo(() => gerarDias(projInicio, projFim), [projInicio, projFim]);

  const diasProjecaoSet = useMemo(() => new Set(diasProjecao), [diasProjecao]);

  // Todos os dias = range histórico + projeção (sem duplicatas)
  const todosDias = useMemo(() => {
    const todos = [...diasDoRange];
    for (const d of diasProjecao) {
      if (!todos.includes(d)) todos.push(d);
    }
    return todos.sort();
  }, [diasDoRange, diasProjecao]);

  // Combinar registros reais + projeção automática
  const dadosPorDia = useMemo(
    () => calcDadosPorDia(
      todosDias, regsFiltrados, diasProjecao, mediasHistoricas,
      projQtdTotal ? parseInt(projQtdTotal, 10) : 0,
    ),
    [todosDias, regsFiltrados, diasProjecao, mediasHistoricas, projQtdTotal],
  );

  // Estatísticas
  const stats = useMemo(() => {
    const diasComDados = todosDias.filter(d => {
      const row = dadosPorDia[d];
      return row && (row["1ª TURNO"] + row["2ª TURNO"] + row["3ª TURNO"]) > 0;
    });
    const totalPessoas = todosDias.reduce((acc, d) => {
      const row = dadosPorDia[d];
      return acc + (row ? row["1ª TURNO"] + row["2ª TURNO"] + row["3ª TURNO"] : 0);
    }, 0);
    const mediaDia = diasComDados.length > 0 ? totalPessoas / diasComDados.length : 0;

    const porTurno: Record<string, number> = { "1ª TURNO": 0, "2ª TURNO": 0, "3ª TURNO": 0 };
    for (const d of todosDias) {
      const row = dadosPorDia[d];
      if (row) { for (const t of TURNOS_DEMANDA) porTurno[t] += row[t]; }
    }
    const mediaPorTurno: Record<string, number> = {};
    for (const t of TURNOS_DEMANDA) {
      const diasTurno = todosDias.filter(d => dadosPorDia[d]?.[t] > 0).length;
      mediaPorTurno[t] = diasTurno > 0 ? porTurno[t] / diasTurno : 0;
    }

    return { mediaDia, totalPessoas, porTurno, mediaPorTurno, diasComDados: diasComDados.length };
  }, [todosDias, dadosPorDia]);

  const thStyle: CSSProperties = { padding: "8px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, borderBottom: `2px solid ${tk.border}`, textAlign: "center", whiteSpace: "nowrap" };
  const tdStyle: CSSProperties = { padding: "6px 10px", fontSize: 12, borderBottom: `1px solid ${tk.surfaceAlt}`, textAlign: "center", fontFamily: "'DM Mono',monospace" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 11, color: tk.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{t("demand_section")}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: tk.textPrimary }}>{t("demand_title")}</div>
      </div>

      {/* Filtros */}
      <div style={{ background: tk.white, border: `1px solid ${tk.border}`, borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 10, color: tk.textMuted, fontWeight: 600, textTransform: "uppercase" }}>{t("demand_filter_forn")}</label>
            <select value={fornFiltro} onChange={e => setFornFiltro(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${tk.border}`, fontSize: 12, fontFamily: "inherit", minWidth: 160 }}>
              <option value="">{t("demand_filter_all")}</option>
              {opcoes.fornecedores.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 10, color: tk.textMuted, fontWeight: 600, textTransform: "uppercase" }}>{t("demand_filter_mes")}</label>
            <input type="month" value={mesFiltro} onChange={e => { setMesFiltro(e.target.value); setDataInicio(""); setDataFim(""); }}
              style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${tk.border}`, fontSize: 12, fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 10, color: tk.textMuted, fontWeight: 600, textTransform: "uppercase" }}>{t("demand_filter_de")}</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${tk.border}`, fontSize: 12, fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 10, color: tk.textMuted, fontWeight: 600, textTransform: "uppercase" }}>{t("demand_filter_ate")}</label>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${tk.border}`, fontSize: 12, fontFamily: "inherit" }} />
          </div>
        </div>
      </div>

      {/* Resumo estatístico */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 180px", background: tk.white, border: `1px solid ${tk.border}`, borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 10, color: tk.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>{t("demand_value_table")}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: tk.blue, lineHeight: 1 }}>{stats.mediaDia.toFixed(1)}</div>
        </div>
        {TURNOS_DEMANDA.map(turno => (
          <div key={turno} style={{ flex: "1 1 120px", background: (TURNO_CORES[turno] || tk.textSecondary) + "0A", border: `1.5px solid ${(TURNO_CORES[turno] || tk.textSecondary)}33`, borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: TURNO_CORES[turno] || tk.textSecondary, fontWeight: 700, letterSpacing: 0.4, marginBottom: 4 }}>{turno.replace(" TURNO", "")}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: TURNO_CORES[turno] || tk.textSecondary, lineHeight: 1 }}>{stats.mediaPorTurno[turno]?.toFixed(0) ?? 0}</div>
          </div>
        ))}
        <div style={{ flex: "1 1 100px", background: tk.textPrimary, borderRadius: 10, padding: "12px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 10, color: tk.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 }}>{t("demand_sum")}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: tk.surfaceLight, lineHeight: 1 }}>{stats.totalPessoas}</div>
        </div>
      </div>

      {/* Projeção futura */}
      <div style={{ background: tk.amberSurface, border: `1px solid ${tk.amberBorder}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: tk.amberDeep, marginBottom: 4 }}>{t("demand_proj_title")}</div>
        <div style={{ fontSize: 11, color: tk.amberDark, marginBottom: 12 }}>{t("demand_proj_hint")}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 10, color: tk.amberDeep, fontWeight: 600 }}>{t("demand_proj_from")}</label>
            <input type="date" value={projInicio} onChange={e => setProjInicio(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${tk.amberBorder}`, fontSize: 12, fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 10, color: tk.amberDeep, fontWeight: 600 }}>{t("demand_proj_to")}</label>
            <input type="date" value={projFim} onChange={e => setProjFim(e.target.value)}
              style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${tk.amberBorder}`, fontSize: 12, fontFamily: "inherit" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <label style={{ fontSize: 10, color: tk.amberDeep, fontWeight: 600 }}>{t("demand_proj_qty")}</label>
            <input type="number" min="1" max="500" value={projQtdTotal} onChange={e => setProjQtdTotal(e.target.value)}
              placeholder={t("demand_proj_qty_hint")}
              style={{ padding: "6px 10px", borderRadius: 6, border: `1px solid ${tk.amberBorder}`, fontSize: 12, fontFamily: "inherit", width: 100 }} />
          </div>
          {(projInicio || projFim) && (
            <button onClick={() => { setProjInicio(""); setProjFim(""); setProjQtdTotal(""); }}
              style={{ padding: "6px 14px", borderRadius: 6, border: `1px solid ${tk.amberBorder}`, background: "transparent", color: tk.amberDeep, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {t("demand_proj_clear")}
            </button>
          )}
        </div>
        {diasProjecao.length > 0 && (
          <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ fontSize: 11, color: tk.amberDeep, fontWeight: 600 }}>{projQtdTotal ? t("demand_proj_dist") : t("demand_proj_avg")}:</div>
            {TURNOS_DEMANDA.map(turno => {
              const totalMediaHist = TURNOS_DEMANDA.reduce((s, t2) => s + (mediasHistoricas[t2] ?? 0), 0);
              const qtdC = projQtdTotal ? parseInt(projQtdTotal, 10) : 0;
              const proporcao = totalMediaHist > 0 ? (mediasHistoricas[turno] ?? 0) / totalMediaHist : 1 / 3;
              const perDay = qtdC > 0 ? Math.round(qtdC * proporcao) : Math.round(mediasHistoricas[turno] ?? 0);
              const pct = (proporcao * 100).toFixed(0);
              return (
                <div key={turno} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: tk.amberBg, border: `1px solid ${tk.amberBorder}`, borderRadius: 6, padding: "3px 8px", fontSize: 11 }}>
                  <span style={{ color: TURNO_CORES[turno] || tk.amberDeep, fontWeight: 700 }}>{turno.replace(" TURNO", "")}</span>
                  <span style={{ color: tk.amberDark, fontSize: 10 }}>({pct}%)</span>
                  <span style={{ fontWeight: 600 }}>→ {perDay}/dia</span>
                </div>
              );
            })}
            <div style={{ fontSize: 11, color: tk.amberDeep }}>
              ({diasProjecao.length} {diasProjecao.length === 1 ? "dia" : "dias"})
            </div>
          </div>
        )}
      </div>

      {/* Tabela unificada: Por turno + Valor */}
      <div style={{ background: tk.white, border: `1px solid ${tk.border}`, borderRadius: 12, padding: 20, overflowX: "auto" }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: tk.textPrimary, marginBottom: 8 }}>{t("demand_shift_table")}</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: tk.navyDeep }}>
              <th style={{ ...thStyle, color: tk.surfaceLight, textAlign: "left" }}>{t("demand_col_date")}</th>
              {TURNOS_DEMANDA.map(turno => (
                <th key={turno} style={{ ...thStyle, color: TURNO_CORES[turno] || tk.surfaceLight }}>{turno.replace(" TURNO", "")}</th>
              ))}
              <th style={{ ...thStyle, color: tk.surfaceLight }}>{t("demand_col_total")}</th>
              <th style={{ ...thStyle, color: tk.green }}>{t("demand_col_value")}</th>
            </tr>
          </thead>
          <tbody>
            {todosDias.map(dia => {
              const row = dadosPorDia[dia];
              const t1 = row?.["1ª TURNO"] ?? 0;
              const t2 = row?.["2ª TURNO"] ?? 0;
              const t3 = row?.["3ª TURNO"] ?? 0;
              const total = t1 + t2 + t3;
              let valorDia = 0;
              if (row && fornFiltro) {
                for (const turno of TURNOS_DEMANDA) {
                  if (row[turno] > 0) {
                    valorDia += row[turno] * resolverDiaria(fornFiltro, turno, diariasConfig, dia);
                  }
                }
              } else if (row) {
                valorDia = total * 250;
              }
              const isProj = diasProjecaoSet.has(dia);
              return (
                <tr key={dia} style={{ background: isProj ? tk.amberBg : dia === hoje() ? tk.blueBg : "transparent" }}>
                  <td style={{ ...tdStyle, textAlign: "left", fontWeight: dia === hoje() ? 700 : 400 }}>
                    {fmt(dia, lang)}
                    {isProj && <span style={{ marginLeft: 6, fontSize: 9, color: tk.amberDeep, background: tk.amberBorder, borderRadius: 4, padding: "1px 5px", fontWeight: 600 }}>{t("demand_proj_badge")}</span>}
                  </td>
                  <td style={{ ...tdStyle, color: t1 > 0 ? TURNO_CORES["1ª TURNO"] : tk.borderMuted, fontWeight: 700 }}>{t1}</td>
                  <td style={{ ...tdStyle, color: t2 > 0 ? TURNO_CORES["2ª TURNO"] : tk.borderMuted, fontWeight: 700 }}>{t2}</td>
                  <td style={{ ...tdStyle, color: t3 > 0 ? TURNO_CORES["3ª TURNO"] : tk.borderMuted, fontWeight: 700 }}>{t3}</td>
                  <td style={{ ...tdStyle, fontWeight: 800, color: total > 0 ? tk.textPrimary : tk.borderMuted }}>{total}</td>
                  <td style={{ ...tdStyle, color: tk.green, fontWeight: 600 }}>{fmtCurrency(valorDia)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjecaoPage;
