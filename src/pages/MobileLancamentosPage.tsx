import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Registro } from "@/types/attendance";
import { supabase, authReady } from "@/lib/supabase";
import { uuid, sanitize, logAudit } from "@/lib/audit";
import {
  hoje, fmt, dataLimiteRetencao,
  fornCor,
  dbToRegistro, registroToDb,
  buildWhatsAppMessage, WA_DEFAULT_TEMPLATE,
} from "@/lib/format-utils";
import type { WhatsAppTemplate, WhatsAppField } from "@/lib/format-utils";
import { dbToTurnoConfig } from "@/lib/fechamento-utils";
import type { TurnoConfig } from "@/lib/fechamento-utils";
import { FormLancamento } from "@/components/FormLancamento";
import type { Opcoes } from "@/types/attendance";
import { useI18n } from "@/hooks/use-i18n";
import type { Lang } from "@/lib/i18n-translations";

const LANGS: { value: Lang; label: string }[] = [
  { value: "pt-BR", label: "PT" },
  { value: "en-US", label: "EN" },
];

// ─── CONSTANTES ─────────────────────────────────────────────────
const OPCOES_DEFAULT: Opcoes = {
  turnos: [], unidades: [], fornecedores: [], motivos: [], cargos: [], ccList: [], nomes: [],
};

// ─── CHIP ────────────────────────────────────────────────────────
const Chip = ({ label, color = "#1A56DB", bg }: { label: string; color?: string; bg?: string }) => (
  <span style={{
    display: "inline-flex", alignItems: "center",
    padding: "2px 10px", borderRadius: 99,
    fontSize: 11, fontWeight: 700, color,
    background: bg || `${color}1A`,
    whiteSpace: "nowrap", letterSpacing: 0.2,
  }}>{label}</span>
);

// ─── TIPOS LOCAIS ────────────────────────────────────────────────
interface Filtros { data: string; turno: string; fornecedor: string; }

// ─── CARD ────────────────────────────────────────────────────────
interface CardProps {
  item: Registro | Registro[];
  checked: boolean;
  onCheck: (checked: boolean) => void;
  onTap: () => void;
  fornecedores: string[];
  lang: string;
}

const RegistroCard = ({ item, checked, onCheck, onTap, fornecedores, lang }: CardProps) => {
  const isLote = Array.isArray(item);
  const r = isLote ? item[0] : item;
  const count = isLote ? item.length : 1;

  return (
    <div
      onClick={onTap}
      style={{
        background: "#fff",
        border: `1px solid ${checked ? "#1A56DB" : "#E2E6EC"}`,
        borderLeft: `4px solid ${isLote ? "#1A56DB" : fornCor(r.fornecedor, fornecedores)}`,
        borderRadius: 12,
        padding: "14px 14px 14px 12px",
        marginBottom: 10,
        cursor: "pointer",
        boxShadow: checked ? "0 0 0 2px #1A56DB22" : "0 1px 3px #00000010",
        wordBreak: "break-word",
        position: "relative",
      }}
    >
      {/* Linha topo: checkbox + turno badge + data */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span
          onClick={e => { e.stopPropagation(); onCheck(!checked); }}
          style={{
            width: 20, height: 20, flexShrink: 0,
            border: `2px solid ${checked ? "#1A56DB" : "#CBD5E1"}`,
            borderRadius: 5, background: checked ? "#1A56DB" : "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          {checked && (
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3}><polyline points="20 6 9 17 4 12" /></svg>
          )}
        </span>
        <Chip label={r.turno} color="#1A56DB" />
        {isLote && (
          <span style={{
            background: "#1A56DB", color: "#fff",
            borderRadius: 99, padding: "1px 8px",
            fontSize: 11, fontWeight: 800,
          }}>{count}×</span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#94A3B8", fontFamily: "monospace" }}>
          {fmt(r.data, lang)}
        </span>
      </div>

      {/* Nome(s) */}
      <div style={{ fontWeight: 700, fontSize: 15, color: "#0F1C2E", marginBottom: 4, lineHeight: 1.3 }}>
        {r.nome}
      </div>
      {isLote && item.length > 1 && (
        <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>
          {item.slice(1).map(x => (
            <div key={x.id} style={{ lineHeight: 1.4 }}>{x.nome}</div>
          ))}
        </div>
      )}

      {/* Horários + horas */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "#475569", fontFamily: "monospace" }}>
          {r.horaEntrada}{r.horaSaida ? ` — ${r.horaSaida}` : ""}
        </span>
        {r.totalHoras && (
          <span style={{
            fontSize: 12, fontWeight: 700, color: "#0E9F6E",
            background: "#ECFDF5", padding: "1px 8px", borderRadius: 8,
          }}>{r.totalHoras}</span>
        )}
      </div>

      {/* Fornecedor + cargo */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Chip label={r.fornecedor} color={fornCor(r.fornecedor, fornecedores)} />
        {r.cargo && <span style={{ fontSize: 11, color: "#94A3B8", alignSelf: "center" }}>{r.cargo}</span>}
      </div>
    </div>
  );
};

// ─── BOTTOM SHEET ────────────────────────────────────────────────
interface BottomSheetProps {
  item: Registro | Registro[] | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onWhatsApp: () => void;
}

const BottomSheet = ({ item, onClose, onEdit, onDelete, onWhatsApp }: BottomSheetProps) => {
  if (!item) return null;
  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.4)" }}
      />
      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 201,
        background: "#fff", borderRadius: "20px 20px 0 0",
        padding: "20px 20px 36px",
        boxShadow: "0 -4px 24px rgba(0,0,0,0.15)",
      }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, background: "#E2E6EC", borderRadius: 2, margin: "0 auto 20px" }} />
        {/* Ações */}
        <SheetBtn icon="✏️" label="Editar" color="#1A56DB" bg="#EBF0FD" onClick={onEdit} />
        <SheetBtn icon="🗑️" label="Excluir" color="#E02424" bg="#FDE8E8" onClick={onDelete} />
        <SheetBtn icon="💬" label="Enviar WhatsApp" color="#0E9F6E" bg="#ECFDF5" onClick={onWhatsApp} />
      </div>
    </>
  );
};

const SheetBtn = ({ icon, label, color, bg, onClick }: { icon: string; label: string; color: string; bg: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    style={{
      width: "100%", display: "flex", alignItems: "center", gap: 14,
      padding: "14px 16px", border: "none", borderRadius: 12,
      background: bg, color, fontWeight: 700, fontSize: 15,
      fontFamily: "inherit", cursor: "pointer", marginBottom: 8,
    }}
  >
    <span style={{ fontSize: 20 }}>{icon}</span>
    {label}
  </button>
);

// ─── CONFIRM DIALOG ──────────────────────────────────────────────
const ConfirmDialog = ({ count, onConfirm, onCancel }: { count: number; onConfirm: () => void; onCancel: () => void }) => (
  <>
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.5)" }} />
    <div style={{
      position: "fixed", top: "50%", left: "50%", zIndex: 301,
      transform: "translate(-50%,-50%)",
      background: "#fff", borderRadius: 16, padding: 24,
      width: "calc(100% - 48px)", maxWidth: 340,
      boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
    }}>
      <div style={{ fontWeight: 800, fontSize: 17, color: "#0F1C2E", marginBottom: 8 }}>
        Confirmar exclusão
      </div>
      <div style={{ fontSize: 14, color: "#475569", marginBottom: 20, lineHeight: 1.5 }}>
        Excluir {count} registro{count !== 1 ? "s" : ""}? Esta ação não pode ser desfeita.
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: "12px", border: "1px solid #E2E6EC",
          borderRadius: 10, background: "#fff", cursor: "pointer",
          fontWeight: 600, fontSize: 14, fontFamily: "inherit", color: "#475569",
        }}>Cancelar</button>
        <button onClick={onConfirm} style={{
          flex: 1, padding: "12px", border: "none",
          borderRadius: 10, background: "#E02424", cursor: "pointer",
          fontWeight: 700, fontSize: 14, fontFamily: "inherit", color: "#fff",
        }}>Excluir</button>
      </div>
    </div>
  </>
);

// ─── MODAL WRAPPER ───────────────────────────────────────────────
const MobileModal = ({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) => (
  <>
    {/*
      CSS override: transforma a grid de colaboradores (Bloco 5 do FormLancamento)
      em layout vertical empilhado no mobile, evitando colunas espremidas e nomes
      truncados. O autocomplete usa position:fixed (relativo à viewport) e funciona
      corretamente pois o modal também está na viewport.
    */}
    <style>{`
      /* Remove minWidth do container para não causar scroll horizontal no modal */
      .mobile-form-worker-outer {
        min-width: unset !important;
        overflow: visible !important;
      }
      /* Oculta o header da tabela (colunas #, NOME, ENTRADA, SAÍDA, TOTAL) */
      .mobile-form-worker-header {
        display: none !important;
      }
      /* Cada linha de colaborador vira layout vertical empilhado */
      .mobile-form-worker-grid {
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
        padding: 10px 12px !important;
        border-radius: 0 !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
      /* Número do colaborador (primeiro filho div) */
      .mobile-form-worker-grid > div:first-child {
        font-size: 11px !important;
        color: #94A3B8 !important;
        text-align: left !important;
        font-weight: 700 !important;
        width: auto !important;
      }
      /* Cargo select (segundo filho — select direto) */
      .mobile-form-worker-grid > select {
        width: 100% !important;
        font-size: 15px !important;
        padding: 10px 12px !important;
        border-radius: 8px !important;
        border: 1.5px solid #E2E6EC !important;
        background: #FAFBFC !important;
        box-sizing: border-box !important;
      }
      /* Autocomplete de nome (segundo filho div) */
      .mobile-form-worker-grid > div:not(:first-child):not(:last-child) {
        width: 100% !important;
      }
      .mobile-form-worker-grid > div:not(:first-child):not(:last-child) > div {
        width: 100% !important;
      }
      .mobile-form-worker-grid > div:not(:first-child):not(:last-child) input {
        width: 100% !important;
        font-size: 15px !important;
        padding: 11px 12px !important;
      }
      /* Inputs de hora (filhos diretos input) */
      .mobile-form-worker-grid > input[type="time"] {
        width: 100% !important;
        font-size: 15px !important;
        padding: 11px 12px !important;
        border-radius: 8px !important;
        box-sizing: border-box !important;
      }
      /* Total de horas (último filho div) */
      .mobile-form-worker-grid > div:last-child {
        text-align: left !important;
        font-size: 12px !important;
        width: auto !important;
      }
    `}</style>
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.5)" }} />
    <div style={{
      position: "fixed", inset: 0, zIndex: 401,
      background: "#F1F5F9", overflowY: "auto",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header do modal */}
      <div style={{
        background: "#0B1628", padding: "16px 20px",
        display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 1,
      }}>
        <button onClick={onClose} style={{
          width: 36, height: 36, border: "none",
          background: "rgba(255,255,255,0.1)", borderRadius: 8,
          cursor: "pointer", color: "#fff", display: "flex",
          alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        </button>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>{title}</span>
      </div>
      <div style={{ padding: "16px", flex: 1 }}>
        {children}
      </div>
    </div>
  </>
);

// ─── PÁGINA PRINCIPAL ────────────────────────────────────────────
const MobileLancamentosPage = () => {
  const navigate = useNavigate();
  const { lang, setLang } = useI18n();

  // ── Estado dos dados ──
  const [registros, setRegistrosState] = useState<Registro[]>([]);
  const [opcoes, setOpcoes] = useState<Opcoes>(OPCOES_DEFAULT);
  const [turnosConfig, setTurnosConfig] = useState<TurnoConfig[]>([]);
  const [waTemplate, setWaTemplate] = useState<WhatsAppTemplate>(WA_DEFAULT_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const prevRef = useRef<Registro[]>([]);

  // ── Filtros ──
  const [filtros, setFiltros] = useState<Filtros>({ data: hoje(), turno: "", fornecedor: "" });
  const [showFiltros, setShowFiltros] = useState(false);

  // ── UI ──
  const [modal, setModal] = useState<null | "new" | Registro | Registro[]>(null);
  const [sheet, setSheet] = useState<null | Registro | Registro[]>(null);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // ── Carregar registros ──
  useEffect(() => {
    authReady.then(() =>
      supabase
        .from("registros")
        .select("*")
        .order("created_at", { ascending: true })
        .then(({ data: rows, error }) => {
          if (error) {
            console.error("Erro ao carregar registros:", error.message);
          } else if (rows && rows.length > 0) {
            const parsed = (rows as unknown[]).map(r => dbToRegistro(r as Parameters<typeof dbToRegistro>[0]));
            setRegistrosState(parsed);
            prevRef.current = parsed;
          }
          setLoading(false);

          // LGPD: purga registros antigos
          const limite = dataLimiteRetencao();
          void supabase.from("registros").delete().lt("data", limite).select("id")
            .then(({ data: purged, error: pe }) => {
              if (pe) { console.error("Erro ao purgar:", pe.message); return; }
              if (purged && purged.length > 0) {
                logAudit("PURGE", "registros", undefined, {
                  motivo: `Retenção LGPD — anteriores a ${limite}`,
                  registros_removidos: purged.length,
                });
                setRegistrosState(prev => prev.filter(r => r.data >= limite));
                prevRef.current = prevRef.current.filter(r => r.data >= limite);
              }
            });
        })
    ).catch((err: unknown) => {
      console.error("Erro ao carregar registros:", err);
      setLoading(false);
    });
  }, []);

  // ── Carregar opções, turnosConfig e waTemplate ──
  useEffect(() => {
    authReady.then(async () => {
      const [opcoesRes, nomesRes, tcRes, waRes] = await Promise.all([
        supabase.from("opcoes").select("chave, valor").neq("chave", "nomes").order("id", { ascending: true }),
        supabase.from("terceiros").select("nome").order("nome", { ascending: true }),
        supabase.from("turnos_config").select("*").order("turno"),
        supabase.from("opcoes").select("valor").eq("chave", "whatsapp_template").maybeSingle(),
      ]);

      if (!opcoesRes.error && opcoesRes.data) {
        const rows = opcoesRes.data as { chave: string; valor: string }[];
        const nomes = (nomesRes.data ?? []).map((r: { nome: string }) => r.nome);
        const byKey = new Map<string, string[]>();
        rows.forEach(row => {
          if (!byKey.has(row.chave)) byKey.set(row.chave, []);
          byKey.get(row.chave)!.push(row.valor);
        });
        const built: Opcoes = { ...OPCOES_DEFAULT };
        byKey.forEach((vals, k) => {
          if (k !== "nomes" && k in built) Object.assign(built, { [k]: vals });
        });
        built.nomes = nomes;
        setOpcoes(built);
      }

      if (!tcRes.error && tcRes.data) {
        setTurnosConfig(tcRes.data.map(dbToTurnoConfig));
      }

      if (waRes.data?.valor) {
        try {
          const parsed = JSON.parse(waRes.data.valor) as { header?: string; campos?: WhatsAppField[] };
          if (parsed.header && Array.isArray(parsed.campos) && parsed.campos.length > 0) {
            setWaTemplate({ header: parsed.header, campos: parsed.campos });
          }
        } catch { /* ignore bad JSON */ }
      }
    }).catch((err: unknown) => console.error("Erro ao carregar opções:", err));
  }, []);

  // ── Persistência (mesma lógica do useStorage em Index.tsx) ──
  const setRegistros = useCallback((newValRaw: Registro[]) => {
    // Dedup intra-lote
    const loteVisto = new Map<string, Set<string>>();
    const newVal = newValRaw.filter(r => {
      if (!r.loteId) return true;
      if (!loteVisto.has(r.loteId)) loteVisto.set(r.loteId, new Set());
      const k = r.nome.trim().toLowerCase();
      if (loteVisto.get(r.loteId)!.has(k)) return false;
      loteVisto.get(r.loteId)!.add(k);
      return true;
    });

    const prev = prevRef.current;
    setRegistrosState(newVal);
    prevRef.current = newVal;

    const newIds = new Set(newVal.map(r => r.id));
    const deletedIds = prev.filter(r => !newIds.has(r.id)).map(r => r.id);
    const prevMap = new Map(prev.map(r => [r.id, r]));
    const toUpsert = newVal.filter(r => {
      const p = prevMap.get(r.id);
      return !p || JSON.stringify(p) !== JSON.stringify(r);
    });

    if (deletedIds.length > 0) {
      supabase.from("registros").delete().in("id", deletedIds)
        .then(({ error }) => {
          if (error) console.error("Erro ao deletar:", error.message);
          else deletedIds.forEach(id => logAudit("DELETE", "registros", id));
        });
    }
    if (toUpsert.length > 0) {
      supabase.from("registros").upsert(toUpsert.map(registroToDb))
        .then(({ error }) => {
          if (error) console.error("Erro ao salvar:", error.message);
          else toUpsert.forEach(r => {
            logAudit(prevMap.has(r.id) ? "UPDATE" : "INSERT", "registros", r.id);
          });
        });
    }
  }, []);

  // ── Filtros ──
  const filtered = useMemo(() => registros.filter(r => {
    if (filtros.data && r.data !== filtros.data) return false;
    if (filtros.turno && r.turno !== filtros.turno) return false;
    if (filtros.fornecedor && r.fornecedor !== filtros.fornecedor) return false;
    return true;
  }), [registros, filtros]);

  // ── Grupos por data+turno (igual ao Index.tsx) ──
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

  // ── Salvar (sem detecção de conflito de turno para simplificar mobile) ──
  const salvar = (novos: Registro[]) => {
    // Dedup por nome dentro do lote
    const nomesLote = novos.map(r => r.nome.toLowerCase());
    const semDup = novos.filter((r, idx) => nomesLote.indexOf(r.nome.toLowerCase()) === idx);

    if (modal === "new") {
      setRegistros([...registros, ...semDup]);
    } else if (Array.isArray(modal)) {
      const ids = new Set((modal as Registro[]).map(r => r.id));
      setRegistros([...registros.filter(r => !ids.has(r.id)), ...semDup]);
    } else if (modal) {
      setRegistros(registros.map(r => r.id === semDup[0]?.id ? semDup[0] : r));
    }
    setModal(null);
  };

  const excluir = (ids: string[]) => {
    setRegistros(registros.filter(r => !ids.includes(r.id)));
    setSelectedIds([]);
    setConfirm(null);
    setSheet(null);
  };

  // ── Helpers de seleção ──
  const allIds = (item: Registro | Registro[]) =>
    Array.isArray(item) ? item.map(x => x.id) : [item.id];

  const isChecked = (item: Registro | Registro[]) =>
    allIds(item).every(id => selectedIds.includes(id));

  const toggleCheck = (item: Registro | Registro[], checked: boolean) => {
    const ids = allIds(item);
    setSelectedIds(val =>
      checked
        ? [...new Set([...val, ...ids])]
        : val.filter(id => !ids.includes(id))
    );
  };

  // ── Navegar para desktop ──
  const irParaDesktop = () => {
    sessionStorage.removeItem("deviceMode");
    navigate("/", { replace: true });
  };

  // ── Título do modal ──
  const modalTitle = () => {
    if (modal === "new") return "Novo Lançamento";
    if (Array.isArray(modal)) return `Editar Lote — ${(modal as Registro[]).length} pessoa(s)`;
    return "Editar Lançamento";
  };

  return (
    <div style={{ minHeight: "100dvh", background: "#F1F5F9", fontFamily: "inherit" }}>

      {/* ═══ HEADER FIXO ═══ */}
      <div style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "#0B1628",
        padding: "14px 16px 12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 16, lineHeight: 1 }}>
              Controle de Terceiros
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              marginTop: 4, background: "#1A56DB", borderRadius: 99,
              padding: "2px 8px", fontSize: 10, fontWeight: 700, color: "#fff",
            }}>
              <span>📱</span> Mobile
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {/* Toggle de idioma */}
            {LANGS.map(l => (
              <button
                key={l.value}
                onClick={() => setLang(l.value)}
                style={{
                  border: lang === l.value ? "1.5px solid #60A5FA" : "1px solid rgba(255,255,255,0.2)",
                  background: lang === l.value ? "rgba(96,165,250,0.2)" : "rgba(255,255,255,0.05)",
                  borderRadius: 6, padding: "5px 9px",
                  color: lang === l.value ? "#BFDBFE" : "#94A3B8",
                  fontSize: 11, fontWeight: 700,
                  fontFamily: "inherit", cursor: "pointer",
                  letterSpacing: 0.5,
                }}
              >
                {l.label}
              </button>
            ))}
            {/* Botão Desktop */}
            <button
              onClick={irParaDesktop}
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(255,255,255,0.08)",
                borderRadius: 8, padding: "8px 12px",
                color: "#CBD5E1", fontSize: 12, fontWeight: 600,
                fontFamily: "inherit", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              <span>💻</span> Desktop
            </button>
          </div>
        </div>
      </div>

      {/* ═══ CONTEÚDO ═══ */}
      <div style={{ padding: "16px 12px 120px" }}>

        {/* Botão de filtros */}
        <button
          onClick={() => setShowFiltros(f => !f)}
          style={{
            width: "100%", border: "1px solid #E2E6EC",
            background: "#fff", borderRadius: 10,
            padding: "11px 16px", marginBottom: 10,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontFamily: "inherit", cursor: "pointer", fontSize: 14,
            fontWeight: 600, color: "#334155",
          }}
        >
          <span>Filtros</span>
          <span style={{ color: "#94A3B8", fontSize: 16 }}>{showFiltros ? "▴" : "▾"}</span>
        </button>

        {/* Painel de filtros */}
        {showFiltros && (
          <div style={{
            background: "#fff", border: "1px solid #E2E6EC",
            borderRadius: 10, padding: "14px 14px",
            marginBottom: 10, display: "flex", flexDirection: "column", gap: 10,
          }}>
            {/* Data */}
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.7 }}>Data</span>
              <input
                type="date"
                value={filtros.data}
                onChange={e => setFiltros(f => ({ ...f, data: e.target.value }))}
                style={{
                  border: "1px solid #E2E6EC", borderRadius: 8,
                  padding: "10px 12px", fontSize: 14, fontFamily: "inherit",
                  color: "#0F1C2E", background: "#F8FAFC", width: "100%", boxSizing: "border-box",
                }}
              />
            </label>

            {/* Turno */}
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.7 }}>Turno</span>
              <select
                value={filtros.turno}
                onChange={e => setFiltros(f => ({ ...f, turno: e.target.value }))}
                style={{
                  border: "1px solid #E2E6EC", borderRadius: 8,
                  padding: "10px 12px", fontSize: 14, fontFamily: "inherit",
                  color: "#0F1C2E", background: "#F8FAFC", width: "100%",
                }}
              >
                <option value="">Todos os turnos</option>
                {opcoes.turnos.map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </label>

            {/* Fornecedor */}
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.7 }}>Fornecedor</span>
              <select
                value={filtros.fornecedor}
                onChange={e => setFiltros(f => ({ ...f, fornecedor: e.target.value }))}
                style={{
                  border: "1px solid #E2E6EC", borderRadius: 8,
                  padding: "10px 12px", fontSize: 14, fontFamily: "inherit",
                  color: "#0F1C2E", background: "#F8FAFC", width: "100%",
                }}
              >
                <option value="">Todos os fornecedores</option>
                {opcoes.fornecedores.map(opt => <option key={opt}>{opt}</option>)}
              </select>
            </label>

            {/* Botão limpar */}
            <button
              onClick={() => setFiltros({ data: "", turno: "", fornecedor: "" })}
              style={{
                border: "1px solid #E2E6EC", background: "#F8FAFC",
                borderRadius: 8, padding: "9px", fontFamily: "inherit",
                fontSize: 13, fontWeight: 600, color: "#64748B", cursor: "pointer",
              }}
            >
              Limpar filtros
            </button>
          </div>
        )}

        {/* Contador */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#94A3B8", fontSize: 14 }}>
            Carregando...
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 12, paddingLeft: 2 }}>
              Exibindo {filtered.length} de {registros.length} registros
            </div>

            {/* Barra de seleção em massa */}
            {selectedIds.length > 0 && (
              <div style={{
                background: "#FDE8E8", borderRadius: 10,
                padding: "12px 14px", marginBottom: 12,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontSize: 13, color: "#B91C1C", fontWeight: 600 }}>
                  {selectedIds.length} selecionado{selectedIds.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => setConfirm(selectedIds)}
                  style={{
                    background: "#E02424", border: "none", borderRadius: 8,
                    padding: "8px 14px", color: "#fff", fontWeight: 700,
                    fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                  }}
                >
                  Excluir selecionados
                </button>
              </div>
            )}

            {/* Lista de cards */}
            {grupos.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "48px 20px",
                background: "#fff", borderRadius: 12,
                border: "1px solid #E2E6EC",
                color: "#94A3B8", fontSize: 14, lineHeight: 1.6,
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                Nenhum registro encontrado.
              </div>
            ) : (
              grupos.map((item, i) => (
                <RegistroCard
                  key={Array.isArray(item) ? item[0].loteId || item[0].id : item.id}
                  item={item}
                  checked={isChecked(item)}
                  onCheck={checked => toggleCheck(item, checked)}
                  onTap={() => setSheet(item)}
                  fornecedores={opcoes.fornecedores}
                  lang={lang}
                />
              ))
            )}
          </>
        )}
      </div>

      {/* ═══ FAB ═══ */}
      <button
        onClick={() => setModal("new")}
        style={{
          position: "fixed", bottom: 24, right: 20, zIndex: 150,
          width: 56, height: 56, borderRadius: 99,
          background: "#1A56DB", border: "none",
          boxShadow: "0 4px 16px rgba(26,86,219,0.45)",
          cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center",
          color: "#fff",
        }}
        aria-label="Novo lançamento"
      >
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></svg>
      </button>

      {/* ═══ BOTTOM SHEET ═══ */}
      <BottomSheet
        item={sheet}
        onClose={() => setSheet(null)}
        onEdit={() => { setModal(sheet); setSheet(null); }}
        onDelete={() => { setConfirm(allIds(sheet!)); setSheet(null); }}
        onWhatsApp={() => {
          if (!sheet) return;
          const regs = Array.isArray(sheet) ? sheet : [sheet];
          const msg = buildWhatsAppMessage(regs, waTemplate);
          const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
          window.open(url, "_blank", "noopener,noreferrer");
          setSheet(null);
        }}
      />

      {/* ═══ CONFIRMAÇÃO ═══ */}
      {confirm && (
        <ConfirmDialog
          count={confirm.length}
          onConfirm={() => excluir(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ═══ MODAL DE FORMULÁRIO ═══ */}
      {modal && (
        <MobileModal title={modalTitle()} onClose={() => setModal(null)}>
          <FormLancamento
            inicial={modal === "new" || Array.isArray(modal) ? null : modal as Registro}
            loteInicial={Array.isArray(modal) ? (modal as Registro[]) : undefined}
            onSave={salvar}
            onCancel={() => setModal(null)}
            opcoes={opcoes}
            registros={registros}
            turnosConfig={turnosConfig}
          />
        </MobileModal>
      )}
    </div>
  );
};

export default MobileLancamentosPage;
