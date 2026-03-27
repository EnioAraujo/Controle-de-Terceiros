import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, authReady } from "@/lib/supabase";
import { useI18n } from "@/hooks/use-i18n";
import { hoje, mesAtual, WA_DEFAULT_TEMPLATE } from "@/lib/format-utils";
import type { WhatsAppTemplate, WhatsAppField } from "@/lib/format-utils";
import { dbToTurnoConfig, dbToDiariaConfig } from "@/lib/fechamento-utils";
import type { TurnoConfig, DiariaConfig } from "@/lib/fechamento-utils";
import { useStorage } from "@/hooks/useStorage";
import { useOpcoes } from "@/hooks/useOpcoes";
import { useTour } from "@/hooks/use-tour";
import { usePrivacyAccepted, PrivacyNotice } from "@/components/PrivacyNotice";
import { Icon } from "@/components/atoms";
import { Dashboard } from "@/components/Dashboard";
import GuidedTour from "@/components/GuidedTour";
import type { TourStep } from "@/components/GuidedTour";
import { Lancamentos } from "@/components/Lancamentos";
import { Configuracoes } from "@/components/Configuracoes";
import { FechamentoTab } from "@/components/FechamentoTab";
import ProjecaoPage from "@/pages/ProjecaoPage";

// Re-exports para backward-compat (MobileLancamentosPage)
export type { Opcoes } from "@/types/attendance";
export { FormLancamento } from "@/components/FormLancamento";
export type { PessoaRow, FormLancamentoProps } from "@/components/FormLancamento";

// ─── TIPOS ───────────────────────────────────────────────────────
type TabId = "dashboard" | "lancamentos" | "projecao" | "fechamento" | "configuracoes";
interface NavItem { id: TabId; label: string; icon: string; }

// ─── TOUR STEPS ──────────────────────────────────────────────────
const ALL_STEPS: (TourStep & { adminOnly?: boolean })[] = [
  { target: "#tour-nav",              icon: "🧭", title: "Navegação principal",    desc: "Use estas abas para navegar entre as seções do sistema." },
  { target: "#tour-nav-dashboard",    icon: "📊", title: "Dashboard",              desc: "Visão analítica com KPIs e gráficos de presenças por dia e por período.", tabBefore: "dashboard" },
  { target: "#tour-dashboard-kpis",   icon: "📈", title: "Indicadores do mês",     desc: "Total de presenças e distribuição por turno. Cada card mostra % do total e média/dia." },
  { target: "#tour-dashboard-chart",  icon: "📉", title: "Gráfico dia a dia",      desc: "Barras empilhadas por turno e linha de média diária. Navegue entre meses pelas setas." },
  { target: "#tour-nav-lancamentos",  icon: "📋", title: "Lançamentos",            desc: "Registre, consulte e filtre as presenças de terceiros.", tabBefore: "lancamentos" },
  { target: "#tour-btn-novo",         icon: "➕", title: "Novo Lançamento",        desc: "Abre o formulário para registrar uma presença individual ou em lote." },
  { target: "#tour-filtros",          icon: "🔍", title: "Filtros",                desc: "Filtre por data, turno, fornecedor, unidade ou busque pelo nome do colaborador." },
  { target: "#tour-tabela",           icon: "📄", title: "Tabela de registros",    desc: "Clique em uma linha para ver detalhes, editar ou compartilhar via WhatsApp." },
  { target: "#tour-btn-export",       icon: "📥", title: "Exportar CSV",           desc: "Baixe os registros filtrados em formato CSV compatível com Excel." },
  { target: "#tour-nav-projecao",     icon: "🔮", title: "Projeção",               desc: "Analise a demanda histórica e projete quantidades futuras por turno.", tabBefore: "projecao",  adminOnly: true },
  { target: "#tour-nav-fechamento",   icon: "💰", title: "Fechamento Financeiro",  desc: "Calcule e aprove o fechamento mensal por fornecedor com exportação XLSX/PDF.", tabBefore: "fechamento", adminOnly: true },
  { target: "#tour-nav-configuracoes",icon: "⚙️", title: "Configurações",          desc: "Gerencie turnos, fornecedores, unidades, valores de diárias e template WhatsApp.", tabBefore: "configuracoes" },
];

// ═══════════════════════════════════════════════════════════════
// INDEX
// ═══════════════════════════════════════════════════════════════
const Index = () => {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const [tab, setTab]                             = useState<TabId>("lancamentos");
  const [registros, setRegistros, loadingRegs]    = useStorage();
  const [opcoes, setOpcoes, loadingOpts]           = useOpcoes();
  const [saved, setSaved]                         = useState(false);
  const loading                                   = loadingRegs || loadingOpts;
  const [privacyAccepted, acceptPrivacy]          = usePrivacyAccepted();
  const [dpoCfg, setDpoCfg]                       = useState<{ nome: string; email: string }>({ nome: "", email: "" });
  const [isAdmin, setIsAdmin]                     = useState(false);
  const [isModerator, setIsModerator]             = useState(false);
  const [turnosConfig, setTurnosConfig]           = useState<TurnoConfig[]>([]);
  const [diariasConfig, setDiariasConfig]         = useState<DiariaConfig[]>([]);
  const [waTemplate, setWaTemplate]               = useState<WhatsAppTemplate>(WA_DEFAULT_TEMPLATE);

  useEffect(() => {
    authReady.then(async () => {
      const [tcResult, dcResult] = await Promise.all([
        supabase.from("turnos_config").select("*").order("turno"),
        supabase.from("diarias_config").select("*"),
      ]);
      if (tcResult.error) console.error("Erro ao carregar turnos_config:", tcResult.error.message);
      if (tcResult.data) setTurnosConfig(tcResult.data.map(dbToTurnoConfig));
      if (dcResult.error) console.error("Erro ao carregar diarias_config:", dcResult.error.message);
      if (dcResult.data) setDiariasConfig(dcResult.data.map(dbToDiariaConfig));
    }).catch((err: unknown) => console.error("Erro ao carregar configs:", err));
  }, []);

  useEffect(() => {
    authReady.then(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      // DPO config
      supabase.from("opcoes").select("chave,valor")
        .in("chave", ["dpo_nome", "dpo_email"])
        .then(({ data }) => {
          if (!data) return;
          const m: Record<string, string> = {};
          data.forEach((r: { chave: string; valor: string }) => { m[r.chave] = r.valor; });
          setDpoCfg({ nome: m["dpo_nome"] ?? "", email: m["dpo_email"] ?? "" });
        })
        .catch((err: unknown) => console.error("Erro ao carregar DPO config:", err));
      // WhatsApp template
      supabase.from("opcoes").select("valor").eq("chave", "whatsapp_template").maybeSingle()
        .then(({ data }) => {
          if (!data?.valor) return;
          try {
            const parsed = JSON.parse(data.valor) as { header?: string; campos?: WhatsAppField[] };
            if (parsed.header && Array.isArray(parsed.campos) && parsed.campos.length > 0) {
              setWaTemplate({ header: parsed.header, campos: parsed.campos });
            }
          } catch { /* ignore bad JSON */ }
        })
        .catch((err: unknown) => console.error("Erro ao carregar WA template:", err));
      // Admin check — usa RPC is_admin() (SECURITY DEFINER)
      const { data: isAdminResult, error: adminErr } = await supabase.rpc('is_admin');
      if (adminErr) console.error("Erro ao verificar admin:", adminErr.message);
      else if (isAdminResult) setIsAdmin(true);
      // Moderator check — via user_roles
      const { data: roleData, error: roleErr } = await supabase
        .from("user_roles").select("role").eq("user_id", session.user.id).maybeSingle();
      if (roleErr) console.error("Erro ao verificar role:", roleErr.message);
      else if (roleData?.role === "moderator") setIsModerator(true);
    }).catch((err: unknown) => console.error("authReady falhou:", err));
  }, []);

  const isAdminOrMod = isAdmin || isModerator;

  // ── Tour guiado ────────────────────────────────────────────────────────
  const { active: tourActive, step: tourStep, start: tourStart, finish: tourFinish, next: tourNext, prev: tourPrev } = useTour("tour_done");

  const tourSteps = useMemo<TourStep[]>(() =>
    ALL_STEPS.filter(s => !s.adminOnly || isAdminOrMod),
    [isAdminOrMod]
  );

  const handleTourNext = useCallback(() => {
    const nextIndex = tourStep + 1;
    const nextStep = tourSteps[nextIndex];
    if (nextStep?.tabBefore) {
      setTab(nextStep.tabBefore);
      setTimeout(() => tourNext(tourSteps.length), 150);
    } else {
      tourNext(tourSteps.length);
    }
  }, [tourStep, tourSteps, tourNext]);

  const handleTourStart = useCallback(() => {
    const idx = tourSteps.findIndex(s => s.tabBefore === tab);
    tourStart(idx >= 0 ? idx : 0);
  }, [tab, tourSteps, tourStart]);

  // Guard: se tab restrita e user sem permissão, volta para lancamentos
  useEffect(() => {
    if (!isAdminOrMod && (tab === "projecao" || tab === "fechamento")) setTab("lancamentos");
  }, [isAdminOrMod, tab]);

  const wrap = (fn: (val: Parameters<typeof setRegistros>[0]) => void) => (val: Parameters<typeof setRegistros>[0]) => {
    fn(val); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const hoje_ = registros.filter(r => r.data === hoje()).length;
  const mes_  = registros.filter(r => r.data.startsWith(mesAtual())).length;

  const NAV: NavItem[] = [
    { id: "dashboard",      label: t("nav_tab_dashboard"), icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" },
    { id: "lancamentos",    label: t("nav_tab_lanc"),      icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" },
    ...(isAdminOrMod ? [{ id: "projecao" as TabId,   label: t("nav_tab_proj"), icon: "M2 20h20M5 20V10l3-7 3 7v10M15 20V6l3-4 3 4v14" }] : []),
    ...(isAdminOrMod ? [{ id: "fechamento" as TabId, label: t("nav_tab_fech"), icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" }] : []),
    { id: "configuracoes",  label: t("nav_tab_cfg"),       icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.94 11a8 8 0 0 0-15.88 0H2v2h2.06a8 8 0 0 0 15.88 0H22v-2h-2.06z" },
  ];

  return (
    <>
      {!privacyAccepted && (
        <PrivacyNotice dpoNome={dpoCfg.nome} dpoEmail={dpoCfg.email} onAccept={acceptPrivacy} />
      )}
    <div style={{ minHeight:"100vh", background:"#FAF9FB", fontFamily:"'DM Sans',system-ui,sans-serif", display:"flex", flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
      `}</style>

      <header className="rsp-header" style={{ background:"#212B36", borderBottom:"1px solid #2E3B4A", height:58, display:"flex", alignItems:"center", padding:"0 24px", gap:0, position:"sticky", top:0, zIndex:200 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, paddingRight:28, borderRight:"1px solid #2E3B4A", marginRight:20 }}>
          <img src="/logo.png" alt="Controle de Terceiros" style={{ width:34, height:34, borderRadius:9, objectFit:"cover" }} />
          <div>
            <div style={{ color:"#F8FAFC", fontWeight:800, fontSize:14, letterSpacing:-.4, lineHeight:1.1 }}>Controle de</div>
            <div style={{ color:"#F37E38", fontWeight:800, fontSize:14, letterSpacing:-.4, lineHeight:1.1 }}>Terceiros</div>
          </div>
        </div>

        <nav id="tour-nav" style={{ display:"flex", gap:2, flex:1 }}>
          {NAV.map(n => (
            <button id={`tour-nav-${n.id}`} key={n.id} onClick={() => setTab(n.id)} style={{
              display:"flex", alignItems:"center", gap:7, padding:"7px 15px", borderRadius:8, border:"none", cursor:"pointer",
              fontFamily:"inherit", fontWeight:600, fontSize:13,
              background: tab === n.id ? "#F37E38" : "transparent",
              color: tab === n.id ? "#fff" : "#9898B0",
            }}>
              <Icon d={n.icon} size={15} /><span className="rsp-nav-label">{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="rsp-header-right" style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div className="rsp-header-stats" style={{ display:"flex", gap:12, fontSize:11 }}>
            <div style={{ color:"#9898B0" }}>{t("nav_hoje")} <strong style={{ color:"#F8FAFC" }}>{hoje_}</strong></div>
            <div style={{ color:"#9898B0" }}>{t("nav_mes")} <strong style={{ color:"#F8FAFC" }}>{mes_}</strong></div>
          </div>
          {loading && (
            <div style={{ display:"flex", alignItems:"center", gap:6, background:"#F37E3818", border:"1px solid #F37E3833", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#F37E38", fontWeight:600 }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              {t("nav_loading")}
            </div>
          )}
          {saved && !loading && (
            <div style={{ display:"flex", alignItems:"center", gap:5, background:"#0E9F6E22", border:"1px solid #0E9F6E44", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#0E9F6E", fontWeight:600 }}>
              <Icon d="M5 13l4 4L19 7" size={12} /> {t("nav_saved")}
            </div>
          )}
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#9898B0", fontFamily:"'DM Mono',monospace" }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:"#0E9F6E", boxShadow:"0 0 0 3px #0E9F6E30" }} />
            {new Date().toLocaleTimeString(lang, { hour:"2-digit", minute:"2-digit" })}
          </div>
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              title="Painel de administração"
              style={{ display:"flex", alignItems:"center", gap:5, background:"#F37E3818", border:"1px solid #F37E3844", borderRadius:8, padding:"4px 10px", cursor:"pointer", color:"#F37E38", fontSize:11, fontFamily:"inherit", fontWeight:600 }}
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              {t("nav_admin")}
            </button>
          )}
          <button
            onClick={() => supabase.auth.signOut()}
            title="Sair do sistema"
            style={{ display:"flex", alignItems:"center", gap:5, background:"transparent", border:"1px solid #2E3B4A", borderRadius:8, padding:"4px 10px", cursor:"pointer", color:"#9898B0", fontSize:11, fontFamily:"inherit", fontWeight:600 }}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            {t("nav_logout")}
          </button>
        </div>
      </header>

      <main className="rsp-main" style={{ flex:1, padding:"24px", maxWidth:1440, width:"100%", margin:"0 auto" }}>
        {loading ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh", gap:16 }}>
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#F37E38" strokeWidth={2} style={{ animation:"spin 1s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            <div style={{ fontSize:14, color:"#9898B0", fontWeight:600 }}>{t("nav_loading_data")}</div>
            <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
          </div>
        ) : (
          <>
            {tab === "dashboard"     && <Dashboard    registros={registros} opcoes={opcoes} diariasConfig={diariasConfig} isAdminOrMod={isAdminOrMod} />}
            {tab === "lancamentos"   && <Lancamentos  registros={registros} setRegistros={wrap(setRegistros)} opcoes={opcoes} turnosConfig={turnosConfig} isAdmin={isAdmin} waTemplate={waTemplate} />}
            {tab === "projecao"      && isAdminOrMod && <ProjecaoPage  registros={registros} opcoes={opcoes} />}
            {tab === "fechamento"    && isAdminOrMod && <FechamentoTab registros={registros} opcoes={opcoes} />}
            {tab === "configuracoes" && <Configuracoes opcoes={opcoes} setOpcoes={setOpcoes} registros={registros} setRegistros={setRegistros} isAdmin={isAdmin} isAdminOrMod={isAdminOrMod} setWaTemplate={setWaTemplate} />}
          </>
        )}
      </main>
    </div>

    {/* Botão FAB para abrir o tour */}
    <button
      onClick={handleTourStart}
      title="Ver tutorial do sistema"
      style={{
        position:"fixed", bottom:24, right:24, zIndex:1000,
        width:44, height:44, borderRadius:"50%",
        background:"#212B36", border:"1px solid #334155",
        color:"#9898B0", fontSize:20, fontWeight:700,
        cursor:"pointer", boxShadow:"0 4px 16px rgba(0,0,0,0.35)",
        display:"flex", alignItems:"center", justifyContent:"center",
        fontFamily:"inherit",
      }}
    >?</button>

    <GuidedTour
      steps={tourSteps}
      active={tourActive}
      step={tourStep}
      onNext={handleTourNext}
      onPrev={tourPrev}
      onFinish={tourFinish}
    />
    </>
  );
};

export default Index;
