import { useState, useMemo, useEffect } from "react";
import type { Registro } from "@/types/attendance";
import type { Opcoes } from "@/types/attendance";
import { fmtMes, hoje, mesAtual } from "@/lib/format-utils";
import { useI18n } from "@/hooks/use-i18n";
import { BlockHeader } from "@/components/atoms";
import { resolverDiaria, dbToDiariaConfig } from "@/lib/fechamento-utils";
import type { DiariaConfig } from "@/lib/fechamento-utils";
import { supabase, authReady } from "@/lib/supabase";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Legend,
} from "recharts";

// Cores fixas por posição de turno (exclui Intermediário)
const TURNO_CORES = ["#3B6FD4", "#22A06B", "#E07B39", "#8657C7", "#E02424", "#0891B2"];

// Paleta para os 3 períodos do mês
const PERIODO_CORES = ["#3B6FD4", "#22A06B", "#E07B39"];

// Formata valor monetário em BRL (sem centavos)
const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const Dashboard = ({
  registros,
  opcoes,
  isAdminOrMod = true,
}: {
  registros: Registro[];
  opcoes: Opcoes;
  isAdminOrMod?: boolean;
}) => {
  const { t, lang } = useI18n();
  const [periodo, setPeriodo] = useState(mesAtual());
  const [barMode, setBarMode] = useState<"stacked" | "grouped">("stacked");
  const [diariasConfig, setDiariasConfig] = useState<DiariaConfig[]>([]);

  useEffect(() => {
    let active = true;
    authReady.then(async () => {
      const { data } = await supabase.from("diarias_config").select("*").order("fornecedor");
      if (active && data) setDiariasConfig(data.map(dbToDiariaConfig));
    });
    return () => { active = false; };
  }, []);

  // Turnos excluindo "Intermediário"
  const turnos = useMemo(
    () => opcoes.turnos.filter(tr => !/intermedi/i.test(tr)),
    [opcoes.turnos],
  );

  const doMes  = useMemo(() => registros.filter(r => r.data.startsWith(periodo)), [registros, periodo]);
  const deHoje = registros.filter(r => r.data === hoje());

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalMes  = doMes.length;
  const diasComReg = useMemo(() => new Set(doMes.map(r => r.data)).size, [doMes]);
  const avgDia    = diasComReg > 0 ? (totalMes / diasComReg).toFixed(1) : "0";

  const kpisTurnos = useMemo(() =>
    turnos.map((tr, i) => {
      const n   = doMes.filter(r => r.turno === tr).length;
      const pct = totalMes > 0 ? (n / totalMes * 100).toFixed(1) : "0.0";
      const avg = diasComReg > 0 ? (n / diasComReg).toFixed(1) : "0";
      return { label: tr, value: n, sub: `${pct}% do total`, avg, color: TURNO_CORES[i % TURNO_CORES.length] };
    }), [turnos, doMes, totalMes, diasComReg]);

  // ── Custo por Fornecedor ──────────────────────────────────────────────────
  const custosPorFornecedor = useMemo(() => {
    const map = new Map<string, { presencas: number; totalCusto: number }>();
    doMes.forEach(r => {
      const forn = r.fornecedor || "—";
      const custo = resolverDiaria(r.fornecedor, r.turno, diariasConfig);
      const entry = map.get(forn) ?? { presencas: 0, totalCusto: 0 };
      entry.presencas += 1;
      entry.totalCusto += custo;
      map.set(forn, entry);
    });
    return Array.from(map.entries())
      .map(([fornecedor, { presencas, totalCusto }]) => ({
        fornecedor,
        presencas,
        totalCusto,
        avgCusto: presencas > 0 ? Math.round(totalCusto / presencas) : 0,
      }))
      .sort((a, b) => b.totalCusto - a.totalCusto);
  }, [doMes, diariasConfig]);

  // ── Gráfico diário (barras por turno + linha de média) ────────────────────
  const [ano, mes] = periodo.split("-").map(Number);
  const diasNoMes  = new Date(ano, mes, 0).getDate();

  const dadosDiarios = useMemo(() => {
    return Array.from({ length: diasNoMes }, (_, i) => {
      const day  = String(i + 1).padStart(2, "0");
      const data = `${periodo}-${day}`;
      const regs = doMes.filter(r => r.data === data);
      const ponto: Record<string, number> = { dia: i + 1 };
      turnos.forEach(tr => { ponto[tr] = regs.filter(r => r.turno === tr).length; });
      return ponto;
    });
  }, [doMes, turnos, periodo, diasNoMes]);

  const avgLine = totalMes > 0 ? parseFloat(avgDia) : 0;

  // ── Gráfico por período (01-10, 11-20, 21-fim) ────────────────────────────
  const periodLabels = [t("dash_period_1"), t("dash_period_2"), t("dash_period_3")];
  const dadosPeriodo = useMemo(() => {
    const grupos = [
      doMes.filter(r => { const d = parseInt(r.data.slice(8), 10); return d <= 10; }),
      doMes.filter(r => { const d = parseInt(r.data.slice(8), 10); return d >= 11 && d <= 20; }),
      doMes.filter(r => { const d = parseInt(r.data.slice(8), 10); return d >= 21; }),
    ];
    return grupos.map((regs, idx) => {
      const ponto: Record<string, number | string> = { periodo: periodLabels[idx] };
      turnos.forEach(tr => { ponto[tr] = regs.filter(r => r.turno === tr).length; });
      ponto._total = regs.length;
      ponto._custo = regs.reduce((s, r) => s + resolverDiaria(r.fornecedor, r.turno, diariasConfig), 0);
      return ponto;
    });
  }, [doMes, turnos, periodLabels, diariasConfig]);

  // ── Helpers de navegação ──────────────────────────────────────────────────
 const navMes = (delta: number) => {
    const [y, m] = periodo.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1); // construtor local
    setPeriodo(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
};

  // ── Tooltip customizado para gráfico diário ───────────────────────────────
  const TooltipDiario = ({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: number }) => {
    if (!active || !payload?.length) return null;
    const bars = payload.filter(p => p.dataKey !== "_avg");
    const total = bars.reduce((s, p) => s + (p.value || 0), 0);
    return (
      <div style={{ background:"#212B36", borderRadius:8, padding:"10px 14px", fontSize:12, minWidth:130 }}>
        <div style={{ color:"rgba(255,255,255,.55)", marginBottom:6, fontSize:11 }}>Dia {label} de {fmtMes(periodo, lang)}</div>
        {bars.map(p => (
          <div key={p.dataKey} style={{ display:"flex", justifyContent:"space-between", gap:16, color:"#fff", marginBottom:2 }}>
            <span style={{ color: p.color }}>{p.dataKey}</span>
            <span style={{ fontWeight:700 }}>{p.value}</span>
          </div>
        ))}
        <div style={{ borderTop:"1px solid rgba(255,255,255,.15)", marginTop:6, paddingTop:6, display:"flex", justifyContent:"space-between", color:"#fff" }}>
          <span style={{ fontSize:11, color:"rgba(255,255,255,.6)" }}>Total</span>
          <span style={{ fontWeight:800 }}>{total}</span>
        </div>
      </div>
    );
  };

  // ── Tooltip customizado para gráfico de período ───────────────────────────
  const TooltipPeriodo = ({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    const total = payload.reduce((s, p) => s + (p.value || 0), 0);
    return (
      <div style={{ background:"#212B36", borderRadius:8, padding:"10px 14px", fontSize:12, minWidth:140 }}>
        <div style={{ color:"rgba(255,255,255,.55)", marginBottom:6, fontSize:11 }}>Período {label}</div>
        {payload.map(p => (
          <div key={p.dataKey} style={{ display:"flex", justifyContent:"space-between", gap:16, color:"#fff", marginBottom:2 }}>
            <span style={{ color: p.color }}>{p.dataKey}</span>
            <span style={{ fontWeight:700 }}>{p.value}</span>
          </div>
        ))}
        <div style={{ borderTop:"1px solid rgba(255,255,255,.15)", marginTop:6, paddingTop:6, display:"flex", justifyContent:"space-between", color:"#fff" }}>
          <span style={{ fontSize:11, color:"rgba(255,255,255,.6)" }}>Total</span>
          <span style={{ fontWeight:800 }}>{total}</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* ── Cabeçalho + nav de mês ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <BlockHeader section={t("dash_section")} title={t("dash_title")} />
        <div style={{ display:"flex", alignItems:"center", background:"#fff", border:"1px solid #E2E6EC", borderRadius:10, overflow:"hidden" }}>
          <button onClick={() => navMes(-1)}
            style={{ width:36, height:36, border:"none", background:"none", cursor:"pointer", color:"#64748B", fontSize:18, display:"grid", placeItems:"center" }}>‹</button>
          <span style={{ padding:"0 16px", fontSize:13, fontWeight:700, color:"#212B36", minWidth:110, textAlign:"center", borderLeft:"1px solid #E2E6EC", borderRight:"1px solid #E2E6EC" }}>
            {fmtMes(periodo, lang)}
          </span>
          <button onClick={() => navMes(1)}
            style={{ width:36, height:36, border:"none", background:"none", cursor:"pointer", color:"#64748B", fontSize:18, display:"grid", placeItems:"center" }}>›</button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div id="tour-dashboard-kpis" style={{ display:"grid", gridTemplateColumns:`repeat(${1 + kpisTurnos.length}, 1fr)`, gap:12 }}>
        {/* Total no mês */}
        <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:"16px 18px", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:"#F37E38", borderRadius:"12px 12px 0 0" }} />
          <div style={{ fontSize:10, fontWeight:600, color:"#94A3B8", textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>{t("dash_kpi_records")}</div>
          <div style={{ fontSize:28, fontWeight:800, color:"#F37E38", letterSpacing:-1, lineHeight:1 }}>{totalMes}</div>
          <div style={{ fontSize:11, color:"#64748B", marginTop:4 }}>{diasComReg} dias · {avgDia} {t("dash_media_dia")}</div>
          <div style={{ height:3, background:"#F1F5F9", borderRadius:99, marginTop:10 }}>
            <div style={{ height:"100%", width:"100%", background:"#F37E38", borderRadius:99 }} />
          </div>
        </div>
        {/* KPI por turno */}
        {kpisTurnos.map(kpi => (
          <div key={kpi.label} style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:"16px 18px", position:"relative", overflow:"hidden" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:kpi.color, borderRadius:"12px 12px 0 0" }} />
            <div style={{ fontSize:10, fontWeight:600, color:"#94A3B8", textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>{kpi.label}</div>
            <div style={{ fontSize:28, fontWeight:800, color:kpi.color, letterSpacing:-1, lineHeight:1 }}>{kpi.value}</div>
            <div style={{ fontSize:11, color:"#64748B", marginTop:4 }}>{kpi.sub} · {kpi.avg} {t("dash_media_dia")}</div>
            <div style={{ height:3, background:"#F1F5F9", borderRadius:99, marginTop:10 }}>
              <div style={{ height:"100%", width: totalMes > 0 ? `${(kpi.value / totalMes * 100).toFixed(0)}%` : "0%", background:kpi.color, borderRadius:99, transition:"width .5s" }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Gráfico Dia a Dia ── */}
      <div id="tour-dashboard-chart" style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:8 }}>
          <div>
            <div style={{ fontWeight:700, fontSize:14, color:"#212B36" }}>{t("dash_presencas_dia")}</div>
            <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>
              {fmtMes(periodo, lang)} · {diasComReg} {diasComReg === 1 ? "dia" : "dias"} com registros
            </div>
          </div>
          {/* Legenda */}
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", alignItems:"center" }}>
            {turnos.map((tr, i) => (
              <span key={tr} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:500, color:"#445566" }}>
                <span style={{ width:10, height:10, borderRadius:3, background:TURNO_CORES[i % TURNO_CORES.length], display:"inline-block" }} />
                {tr}
              </span>
            ))}
            <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:500, color:"#445566" }}>
              <span style={{ width:20, borderTop:"2px dashed #F37E38", display:"inline-block" }} />
              Média
            </span>
          </div>
        </div>

        {totalMes === 0 ? (
          <div style={{ height:260, display:"flex", alignItems:"center", justifyContent:"center", color:"#94A3B8", fontSize:13 }}>{t("dash_no_data")}</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={dadosDiarios} margin={{ top:4, right:4, left:-20, bottom:0 }} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize:10, fill:"#7B8FA0" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:"#7B8FA0" }} axisLine={false} tickLine={false} />
              <Tooltip content={<TooltipDiario />} />
              {turnos.map((tr, i) => (
                <Bar key={tr} dataKey={tr} stackId="s" fill={TURNO_CORES[i % TURNO_CORES.length] + "CC"} radius={i === turnos.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
              ))}
              <Line dataKey="_avg" data={dadosDiarios.map(d => ({ ...d, _avg: avgLine }))}
                type="linear" stroke="#F37E38" strokeWidth={1.5} strokeDasharray="4 4"
                dot={false} activeDot={{ r: 4, fill:"#F37E38" }} legendType="none" />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {/* ── Stats bar (médias) ── */}
        <div style={{ display:"flex", marginTop:14, background:"#F8FAFC", borderRadius:10, border:"1px solid #E2E6EC", overflow:"hidden" }}>
          {[
            { label: t("dash_avg_total"), val: avgDia, color:"#F37E38" },
            ...turnos.map((tr, i) => {
              const n = doMes.filter(r => r.turno === tr).length;
              return { label: t("dash_avg_t").replace("{t}", tr), val: diasComReg > 0 ? (n / diasComReg).toFixed(1) : "0", color: TURNO_CORES[i % TURNO_CORES.length] };
            }),
          ].map((s, idx, arr) => (
            <div key={s.label} style={{ flex:1, padding:"10px 14px", borderRight: idx < arr.length - 1 ? "1px solid #E2E6EC" : "none" }}>
              <div style={{ fontSize:10, fontWeight:600, color:"#94A3B8", textTransform:"uppercase", letterSpacing:.7, marginBottom:3 }}>{s.label}</div>
              <div style={{ fontSize:20, fontWeight:700, color:s.color, letterSpacing:-.5 }}>{s.val}</div>
              <div style={{ fontSize:10, color:"#B0BEC9", marginTop:1 }}>{t("dash_presencas")}</div>
              <div style={{ height:2, background:"rgba(0,0,0,.08)", borderRadius:99, marginTop:6 }}>
                <div style={{ height:"100%", width: totalMes > 0 ? `${(parseFloat(s.val) / parseFloat(avgDia) * 100).toFixed(0)}%` : "0%", background:s.color, borderRadius:99 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Custo por Fornecedor (admin/mod only) ── */}
      {isAdminOrMod && custosPorFornecedor.length > 0 && (
        <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:"#212B36" }}>{t("dash_custo_forn")}</div>
              <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>
                {fmtMes(periodo, lang)} &middot; {custosPorFornecedor.length} fornecedor{custosPorFornecedor.length !== 1 ? "es" : ""}
              </div>
            </div>
            <div style={{ fontSize:15, fontWeight:800, color:"#22A06B" }}>
              {fmtBRL(custosPorFornecedor.reduce((s, f) => s + f.totalCusto, 0))}
            </div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {(() => {
              const maxCusto = custosPorFornecedor[0]?.totalCusto ?? 1;
              return custosPorFornecedor.map((f, idx) => (
                <div key={f.fornecedor} style={{ display:"flex", alignItems:"center", gap:12, background:"#F8FAFC", borderRadius:8, padding:"10px 14px" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", minWidth:20, textAlign:"center" }}>#{idx + 1}</div>
                  <div style={{ fontSize:12, fontWeight:600, color:"#212B36", flex:"0 0 140px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.fornecedor}</div>
                  <div style={{ flex:1, height:7, background:"#E2E6EC", borderRadius:99, overflow:"hidden" }}>
                    <div style={{ height:"100%", background:"#22A06B", borderRadius:99, width:`${(f.totalCusto / maxCusto * 100).toFixed(0)}%`, transition:"width .5s" }} />
                  </div>
                  <div style={{ fontSize:13, fontWeight:800, color:"#22A06B", minWidth:90, textAlign:"right" }}>{fmtBRL(f.totalCusto)}</div>
                  <div style={{ fontSize:11, color:"#94A3B8", minWidth:90, textAlign:"right" }}>{f.presencas} pres. &middot; {fmtBRL(f.avgCusto)}/pres.</div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* ── Bottom row: gráfico por período + detalhamento ── */}
      <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:16 }}>

        {/* Gráfico por período */}
        <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:16 }}>
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:"#212B36" }}>{t("dash_period_title")}</div>
              <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>Dias 1–10, 11–20, 21–fim</div>
            </div>
            <div style={{ display:"flex", gap:5 }}>
              {(["stacked", "grouped"] as const).map(mode => (
                <button key={mode} onClick={() => setBarMode(mode)}
                  style={{ padding:"3px 10px", borderRadius:99, fontSize:11, fontWeight:600, border:"1px solid", cursor:"pointer", fontFamily:"inherit",
                    background: barMode === mode ? "#212B36" : "#F8FAFC",
                    color: barMode === mode ? "#fff" : "#64748B",
                    borderColor: barMode === mode ? "#212B36" : "#E2E6EC" }}>
                  {mode === "stacked" ? t("dash_stacked") : t("dash_grouped")}
                </button>
              ))}
            </div>
          </div>
          {totalMes === 0 ? (
            <div style={{ height:200, display:"flex", alignItems:"center", justifyContent:"center", color:"#94A3B8", fontSize:13 }}>{t("dash_no_data")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dadosPeriodo} margin={{ top:4, right:4, left:-20, bottom:0 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis dataKey="periodo" tick={{ fontSize:11, fill:"#7B8FA0" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:"#7B8FA0" }} axisLine={false} tickLine={false} />
                <Tooltip content={<TooltipPeriodo />} />
                {turnos.map((tr, i) => (
                  <Bar key={tr} dataKey={tr}
                    stackId={barMode === "stacked" ? "s" : undefined}
                    fill={TURNO_CORES[i % TURNO_CORES.length]}
                    radius={barMode === "stacked" && i === turnos.length - 1 ? [3, 3, 0, 0] : barMode === "grouped" ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Detalhamento por período */}
        <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
          <div style={{ fontWeight:700, fontSize:14, color:"#212B36", marginBottom:4 }}>{t("dash_period_detail")}</div>
          <div style={{ fontSize:12, color:"#94A3B8", marginBottom:16 }}>
            {fmtMes(periodo, lang)} · 3 {totalMes > 0 ? "períodos" : "períodos"}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {dadosPeriodo.map((p, idx) => {
              const tot = p._total as number;
              const custo = p._custo as number;
              const maxTot = Math.max(...dadosPeriodo.map(x => x._total as number));
              const cor = PERIODO_CORES[idx];
              return (
                <div key={idx} style={{ display:"flex", alignItems:"center", gap:10, background:"#F8FAFC", borderRadius:7, padding:"10px 14px" }}>
                  <div style={{ fontSize:11, fontWeight:700, color:cor, minWidth:52 }}>{t("dash_period_days")} {p.periodo as string}</div>
                  <div style={{ flex:1, height:7, background:"#E2E6EC", borderRadius:99, overflow:"hidden" }}>
                    <div style={{ height:"100%", background:cor, borderRadius:99, width: maxTot > 0 ? `${(tot / maxTot * 100).toFixed(0)}%` : "0%", transition:"width .5s" }} />
                  </div>
                  <div style={{ fontSize:13, fontWeight:800, color:cor, minWidth:32, textAlign:"right" }}>{tot}</div>
                  <div style={{ fontSize:11, color:"#94A3B8", minWidth:78, textAlign:"right" }}>{fmtBRL(custo)}</div>
                </div>
              );
            })}
            {/* Linha total */}
            <div style={{ display:"flex", alignItems:"center", gap:10, borderTop:"1px solid #E2E6EC", paddingTop:12, marginTop:4, padding:"12px 14px 0" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", minWidth:52 }}>Total</div>
              <div style={{ flex:1, height:7, background:"#E2E6EC", borderRadius:99, overflow:"hidden" }}>
                <div style={{ height:"100%", background:"#F37E38", borderRadius:99, width:"100%" }} />
              </div>
              <div style={{ fontSize:13, fontWeight:800, color:"#F37E38", minWidth:32, textAlign:"right" }}>{totalMes}</div>
              <div style={{ fontSize:11, color:"#94A3B8", minWidth:78, textAlign:"right" }}>{fmtBRL(dadosPeriodo.reduce((s, p) => s + (p._custo as number), 0))}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
