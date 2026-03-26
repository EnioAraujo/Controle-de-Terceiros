import { useState, useMemo, ReactNode } from "react";
import type { Registro } from "@/types/attendance";
import type { Opcoes } from "@/types/attendance";
import { fmtMes, hoje, mesAtual } from "@/lib/format-utils";
import { useI18n } from "@/hooks/use-i18n";
import { Icon, BlockHeader } from "@/components/atoms";

interface KPIProps { label: string; value: string | number; sub?: string; color?: string; icon?: ReactNode; }
const KPI = ({ label, value, sub, color = "#1A56DB", icon }: KPIProps) => (
  <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:"18px 20px", position:"relative", overflow:"hidden" }}>
    <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:color, borderRadius:"12px 12px 0 0" }} />
    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
      <div>
        <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:.8, marginBottom:8 }}>{label}</div>
        <div style={{ fontSize:30, fontWeight:800, color, letterSpacing:-1, lineHeight:1 }}>{value}</div>
        {sub && <div style={{ fontSize:12, color:"#64748B", marginTop:6 }}>{sub}</div>}
      </div>
      <div style={{ width:36, height:36, borderRadius:10, background:color + "15", display:"flex", alignItems:"center", justifyContent:"center", color }}>{icon}</div>
    </div>
  </div>
);

export const Dashboard = ({ registros, opcoes }: { registros: Registro[]; opcoes: Opcoes }) => {
  const { t, lang } = useI18n();
  const [periodo, setPeriodo] = useState(mesAtual());

  const doMes  = useMemo(() => registros.filter(r => r.data.startsWith(periodo)), [registros, periodo]);
  const deHoje = registros.filter(r => r.data === hoje());

  const porFornecedor = useMemo(() => {
    const m: Record<string, number> = {};
    doMes.filter(r => opcoes.fornecedores.includes(r.fornecedor))
         .forEach(r => { m[r.fornecedor] = (m[r.fornecedor] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [doMes, opcoes.fornecedores]);

  const CHART_CORES = ["#1A56DB","#0E9F6E","#D97706","#6C63FF","#E02424","#0891B2"];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <BlockHeader section={t("dash_section")} title={t("dash_title")} />
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={() => { const d = new Date(periodo + "-01"); d.setMonth(d.getMonth() - 1); setPeriodo(d.toISOString().slice(0, 7)); }}
            style={{ background:"#F1F5F9", border:"none", borderRadius:8, padding:"8px 12px", cursor:"pointer", fontWeight:700 }}>‹</button>
          <span style={{ fontSize:14, fontWeight:800, minWidth:100, textAlign:"center", color:"#0F1C2E" }}>{fmtMes(periodo, lang)}</span>
          <button onClick={() => { const d = new Date(periodo + "-01"); d.setMonth(d.getMonth() + 1); setPeriodo(d.toISOString().slice(0, 7)); }}
            style={{ background:"#F1F5F9", border:"none", borderRadius:8, padding:"8px 12px", cursor:"pointer", fontWeight:700 }}>›</button>
        </div>
      </div>

      <div className="rsp-grid-2" style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12 }}>
        <KPI label={t("dash_kpi_records")} value={doMes.length} sub={t("dash_kpi_today").replace("{n}", String(deHoje.length))} color="#1A56DB"
          icon={<Icon d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />} />
        <KPI label={t("dash_kpi_forn")} value={porFornecedor.length} sub={t("dash_kpi_period")} color="#D97706"
          icon={<Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />} />
      </div>

      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:16, color:"#0F1C2E" }}>{t("dash_chart_forn")}</div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {porFornecedor.length === 0 && <div style={{ color:"#94A3B8", fontSize:12, textAlign:"center", padding:20 }}>{t("dash_no_data")}</div>}
          {porFornecedor.map(([forn, n], i) => {
            const pct = doMes.length ? (n / doMes.length * 100) : 0;
            const cor = CHART_CORES[i % CHART_CORES.length];
            return (
              <div key={forn}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:5 }}>
                  <span style={{ fontWeight:600, color:"#334155" }}>{forn}</span>
                  <span style={{ fontFamily:"monospace", fontWeight:700, color:cor }}>{n} ({pct.toFixed(0)}%)</span>
                </div>
                <div style={{ height:8, background:"#F1F5F9", borderRadius:99, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:cor, borderRadius:99, transition:"width .6s" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:14, color:"#0F1C2E" }}>{t("dash_chart_turno")}</div>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
          {opcoes.turnos.map((turno, i) => {
            const doMes_t   = doMes.filter(r => r.turno === turno);
            const n         = doMes_t.length;
            const pct       = doMes.length ? (n / doMes.length * 100).toFixed(0) : 0;
            const cor       = CHART_CORES[i % CHART_CORES.length];
            const diasTurno = new Set(doMes_t.map(r => r.data)).size;
            const mediaDia  = diasTurno > 0 ? (n / diasTurno).toFixed(1) : "—";
            const allTurno  = registros.filter(r => r.turno === turno);
            const mesesTurno = new Set(allTurno.map(r => r.data.slice(0, 7))).size;
            const mediaMes  = mesesTurno > 0 ? (allTurno.length / mesesTurno).toFixed(1) : "—";
            return (
              <div key={turno} style={{ flex:1, minWidth:140, background: cor + "0F", border:`1.5px solid ${cor}33`, borderRadius:10, padding:"12px 16px" }}>
                <div style={{ fontSize:11, color:cor, fontWeight:700, marginBottom:8 }}>{turno}</div>
                <div style={{ fontSize:26, fontWeight:800, color:cor, lineHeight:1 }}>{n}</div>
                <div style={{ fontSize:11, color:"#94A3B8", marginTop:2, marginBottom:10 }}>{pct}{t("dash_pct")}</div>
                <div style={{ display:"flex", flexDirection:"column", gap:4, borderTop:`1px solid ${cor}22`, paddingTop:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                    <span style={{ color:"#94A3B8" }}>{t("dash_media_dia")}</span>
                    <span style={{ fontWeight:700, color:cor, fontFamily:"monospace" }}>{mediaDia}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                    <span style={{ color:"#94A3B8" }}>{t("dash_media_mes")}</span>
                    <span style={{ fontWeight:700, color:cor, fontFamily:"monospace" }}>{mediaMes}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
