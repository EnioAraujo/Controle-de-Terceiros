import { useState, useMemo, useCallback, useRef, useEffect, ReactNode, InputHTMLAttributes, SelectHTMLAttributes, CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import DOMPurify from "dompurify";
import { Registro } from "@/types/attendance";
import { supabase, authReady } from "@/lib/supabase";
import { useI18n } from "@/hooks/use-i18n";
import {
  hoje, fmt, fmtMes, mesAtual, calcHoras,
  RETENCAO_ANOS, dataLimiteRetencao,
  FORN_PALETTE, fornCor,
  dbToRegistro, registroToDb,
  KEY_TO_FIELD,
} from "@/lib/format-utils";
import {
  type TurnoConfig, type DiariaConfig, type FechamentoItem, type Fechamento,
  type FechamentoStatus, type ResumoPessoa,
  dbToTurnoConfig, dbToDiariaConfig,
  dbToFechamento, fechamentoToDb,
  dbToFechamentoItem, fechamentoItemToDb,
  horasToDecimal, decimalToHoras,
  periodosPadrao,
  gerarItensFechamento, calcularTotal, agruparPorPessoa,
  STATUS_COLORS, NEXT_STATUS,
} from "@/lib/fechamento-utils";

// ─── CONSTANTES DEFAULT ──────────────────────────────────────────
const D_TURNOS       = ["1ª TURNO", "2ª TURNO", "3ª TURNO", "INTERMEDIÁRIO"];
const D_UNIDADES     = ["HUB", "COD DIURNO", "COD NOTURNO", "Administrativo"];
const D_FORNECEDORES = ["LIDER MASTER", "TRANSLOG", "SERVILOG", "LOGFLEX", "OUTRO"];
const D_MOTIVOS      = ["OPERAÇÃO BAT HUB BRASIL", "REFORÇO TURNO", "COBERTURA FALTA", "PROJETO ESPECIAL", "OUTRO"];
const D_CARGOS       = ["AUXILIAR DE DEPÓSITO", "CONFERENTE JR", "CONFERENTE SR", "OPERADOR DE EMPILHADEIRA", "LÍDER OPERACIONAL", "SUPERVISOR", "ANALISTA", "COORDENADOR"];
const D_CC_LIST      = ["100001 - SOUZA CRUZ-COD", "100002 - SOUZA CRUZ-HUB", "100003 - ADMINISTRATIVO"];
const D_SETORES      = ["RECEBIMENTO", "EXPEDIÇÃO", "SEPARAÇÃO", "CONFERÊNCIA", "ENDEREÇAMENTO", "ADMINISTRATIVO", "PÁTIO"];

// ─── TIPOS ───────────────────────────────────────────────────────
interface Opcoes {
  turnos:       string[];
  unidades:     string[];
  fornecedores: string[];
  motivos:      string[];
  cargos:       string[];
  ccList:       string[];
  setores:      string[];
  nomes:        string[];
}

const OPCOES_DEFAULT: Opcoes = {
  turnos:       D_TURNOS,
  unidades:     D_UNIDADES,
  fornecedores: D_FORNECEDORES,
  motivos:      D_MOTIVOS,
  cargos:       D_CARGOS,
  ccList:       D_CC_LIST,
  setores:      D_SETORES,
  nomes:        [],
};

// ─── UTILITÁRIOS (importados de @/lib/format-utils) ─────────────
const uuid = () => crypto.randomUUID();

// ─── LGPD (importado de @/lib/format-utils) ──────────────────────

const logAudit = (
  operacao: "INSERT" | "UPDATE" | "DELETE" | "PURGE" | "EXCLUSAO_TITULAR",
  tabela: string,
  registroId?: string,
  dados?: unknown
) => {
  authReady.then(() =>
    supabase.from("audit_log").insert({
      operacao,
      tabela,
      registro_id: registroId ?? null,
      dados: dados ? dados : null,
    }).then(({ error }) => {
      if (error) console.warn("audit_log:", error.message);
    })
  );
};

// ─── MAPEAMENTO DB ↔ MODELO (importado de @/lib/format-utils) ──

// ─── HOOKS ───────────────────────────────────────────────────────
const useStorage = (): [Registro[], (val: Registro[]) => void, boolean] => {
  const [data, setData]       = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const prevRef               = useRef<Registro[]>([]);

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
            const parsed = (rows as DbRegistro[]).map(dbToRegistro);
            setData(parsed);
            prevRef.current = parsed;
          }
          setLoading(false);

          // LGPD Art. 15/16 — purga client-side de registros com mais de 5 anos
          const limite = dataLimiteRetencao();
          supabase
            .from("registros")
            .delete()
            .lt("data", limite)
            .select("id")
            .then(({ data: purged, error: pe }) => {
              if (pe) { console.error("Erro ao purgar registros antigos:", pe.message); return; }
              if (purged && purged.length > 0) {
                logAudit("PURGE", "registros", undefined, {
                  motivo: `Retenção LGPD — registros anteriores a ${limite}`,
                  registros_removidos: purged.length,
                });
                setData(prev => prev.filter(r => r.data >= limite));
                prevRef.current = prevRef.current.filter(r => r.data >= limite);
              }
            });
        })
    );
  }, []);

  const save = useCallback((newVal: Registro[]) => {
    const prev = prevRef.current;
    setData(newVal);
    prevRef.current = newVal;

    // Detectar deletados: estavam antes e não estão agora
    const newIds     = new Set(newVal.map(r => r.id));
    const deletedIds = prev.filter(r => !newIds.has(r.id)).map(r => r.id);

    // Detectar inseridos/alterados: novos ou com conteúdo diferente
    const prevMap  = new Map(prev.map(r => [r.id, r]));
    const toUpsert = newVal.filter(r => {
      const p = prevMap.get(r.id);
      return !p || JSON.stringify(p) !== JSON.stringify(r);
    });

    if (deletedIds.length > 0) {
      supabase
        .from("registros")
        .delete()
        .in("id", deletedIds)
        .then(({ error }) => {
          if (error) console.error("Erro ao deletar registros:", error.message);
          else deletedIds.forEach(id => logAudit("DELETE", "registros", id));
        });
    }
    if (toUpsert.length > 0) {
      supabase
        .from("registros")
        .upsert(toUpsert.map(registroToDb))
        .then(({ error }) => {
          if (error) console.error("Erro ao salvar registros:", error.message);
          else toUpsert.forEach(r => {
            const isNew = !prevMap.has(r.id);
            logAudit(isNew ? "INSERT" : "UPDATE", "registros", r.id);
          });
        });
    }
  }, []);

  return [data, save, loading];
};

const useOpcoes = (): [Opcoes, (val: Opcoes) => void, boolean] => {
  const [data, setData]       = useState<Opcoes>(OPCOES_DEFAULT);
  const [loading, setLoading] = useState(true);
  const prevRef               = useRef<Opcoes>(OPCOES_DEFAULT);

  useEffect(() => {
    authReady.then(async () => {
      // Carrega opções (sem nomes) e nomes em paralelo
      const [opcoesRes, nomesRes] = await Promise.all([
        supabase.from("opcoes").select("chave, valor").neq("chave", "nomes").order("id", { ascending: true }),
        supabase.from("terceiros").select("nome").order("nome", { ascending: true }),
      ]);

      // Limpeza: remove nomes residuais da tabela opcoes (devem estar apenas em terceiros)
      supabase.from("opcoes").delete().eq("chave", "nomes")
        .then(({ error }) => { if (error) console.error("Erro ao limpar nomes residuais:", error.message); });

      if (opcoesRes.error) console.error("Erro ao carregar opções:", opcoesRes.error.message);
      if (nomesRes.error)  console.error("Erro ao carregar nomes:", nomesRes.error.message);

      const rows  = opcoesRes.data ?? [];
      const nomes = (nomesRes.data ?? []).map((r: { nome: string }) => r.nome);

      const byKey = new Map<string, string[]>();
      (rows as { chave: string; valor: string }[]).forEach(row => {
        if (!byKey.has(row.chave)) byKey.set(row.chave, []);
        byKey.get(row.chave)!.push(row.valor);
      });

      const built: Opcoes = { ...OPCOES_DEFAULT };
      byKey.forEach((vals, k) => {
        if (k !== "nomes" && k in built) {
          Object.assign(built, { [k]: vals });
        }
      });
      built.nomes = nomes;

      setData(built);
      prevRef.current = built;
      setLoading(false);
    });
  }, []);

  const save = useCallback((newVal: Opcoes) => {
    const prev = prevRef.current;
    setData(newVal);
    prevRef.current = newVal;

    // ── Salva opções (excepto nomes, que têm tabela própria) ──
    const KEYS = (Object.keys(newVal) as (keyof Opcoes)[]).filter(k => k !== "nomes");
    for (const key of KEYS) {
      const prevList = prev[key] as string[];
      const nextList = newVal[key] as string[];
      if (JSON.stringify(prevList) === JSON.stringify(nextList)) continue;

      const toAdd    = nextList.filter(v => !prevList.includes(v));
      const toRemove = prevList.filter(v => !nextList.includes(v));

      if (toAdd.length > 0) {
        const CHUNK = 100;
        (async () => {
          for (let i = 0; i < toAdd.length; i += CHUNK) {
            const batch = toAdd.slice(i, i + CHUNK);
            const { error } = await supabase
              .from("opcoes")
              .upsert(batch.map(valor => ({ chave: key, valor })), { onConflict: "chave,valor", ignoreDuplicates: true });
            if (error) console.error(`Erro ao inserir opções [${key}]:`, error.message);
          }
        })();
      }
      if (toRemove.length > 0) {
        supabase.from("opcoes").delete().eq("chave", key).in("valor", toRemove)
          .then(({ error }) => { if (error) console.error(`Erro ao remover opções [${key}]:`, error.message); });
      }
    }

    // ── Salva nomes na tabela terceiros ──
    const prevNomes = prev.nomes;
    const nextNomes = newVal.nomes;
    if (JSON.stringify(prevNomes) !== JSON.stringify(nextNomes)) {
      const toAdd    = nextNomes.filter(v => !prevNomes.includes(v));
      const toRemove = prevNomes.filter(v => !nextNomes.includes(v));

      if (toAdd.length > 0) {
        const CHUNK = 100;
        (async () => {
          for (let i = 0; i < toAdd.length; i += CHUNK) {
            const batch = toAdd.slice(i, i + CHUNK);
            const { error } = await supabase
              .from("terceiros")
              .upsert(batch.map(nome => ({ nome })), { onConflict: "nome", ignoreDuplicates: true });
            if (error) console.error("Erro ao inserir nomes:", error.message);
          }
        })();
      }
      if (toRemove.length > 0) {
        supabase.from("terceiros").delete().in("nome", toRemove)
          .then(({ error }) => { if (error) console.error("Erro ao remover nomes:", error.message); });
      }
    }
  }, []);

  return [data, save, loading];
};

// ─── LGPD: AVISO DE PRIVACIDADE ──────────────────────────────────
const usePrivacyAccepted = () => {
  const [accepted, setAccepted] = useState(() => localStorage.getItem("lgpd_aceito") === "1");
  const accept = () => { localStorage.setItem("lgpd_aceito", "1"); setAccepted(true); };
  return [accepted, accept] as const;
};

const PrivacyNotice = ({ dpoNome, dpoEmail, onAccept }: { dpoNome: string; dpoEmail: string; onAccept: () => void }) => {
  const { t } = useI18n();
  return (
  <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(11,22,40,.92)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
    <div style={{ background:"#fff", borderRadius:16, maxWidth:620, width:"100%", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 80px rgba(0,0,0,.4)" }}>
      <div style={{ background:"linear-gradient(135deg,#0B1628,#1A2C4A)", padding:"24px 28px", borderRadius:"16px 16px 0 0", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:40, height:40, background:"#1A56DB", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div>
          <div style={{ color:"#F8FAFC", fontWeight:800, fontSize:16 }}>{t("privacy_title")}</div>
          <div style={{ color:"#64748B", fontSize:12, marginTop:2 }}>{t("privacy_law")}</div>
        </div>
      </div>

      <div style={{ padding:"24px 28px", display:"flex", flexDirection:"column", gap:18, fontSize:13, color:"#334155", lineHeight:1.7 }}>
        <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:10, padding:"12px 16px", fontSize:12, color:"#1A56DB", fontWeight:600 }}>
          {t("privacy_intro")}
        </div>

        <section>
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>{t("privacy_col_title")}</div>
          <ul style={{ paddingLeft:18, margin:0, display:"flex", flexDirection:"column", gap:3, fontSize:12 }}>
            <li>{t("privacy_col_1")}</li>
            <li>{t("privacy_col_2")}</li>
            <li>{t("privacy_col_3")}</li>
            <li>{t("privacy_col_4")}</li>
            <li>{t("privacy_col_5")}</li>
          </ul>
        </section>

        <section>
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>{t("privacy_legal_title")}</div>
          <p style={{ margin:0, fontSize:12 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(t("privacy_legal_text")) }} />
        </section>

        <section>
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>{t("privacy_ret_title")}</div>
          <p style={{ margin:0, fontSize:12 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(t("privacy_ret_text").replace("{years}", String(RETENCAO_ANOS))) }} />
        </section>

        <section>
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>{t("privacy_sec_title")}</div>
          <p style={{ margin:0, fontSize:12 }}>{t("privacy_sec_text")}</p>
        </section>

        <section>
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>{t("privacy_rights_title")}</div>
          <p style={{ margin:0, fontSize:12 }}>{t("privacy_rights_text")}</p>
        </section>

        {(dpoNome || dpoEmail) && (
          <section style={{ background:"#F8FAFC", border:"1px solid #E2E6EC", borderRadius:10, padding:"12px 16px" }}>
            <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>{t("privacy_dpo_title")}</div>
            {dpoNome  && <div style={{ fontSize:12 }}><strong>{t("privacy_dpo_name")}</strong> {dpoNome}</div>}
            {dpoEmail && <div style={{ fontSize:12 }}><strong>{t("privacy_dpo_email_lbl")}</strong> {dpoEmail}</div>}
          </section>
        )}

        <button onClick={onAccept} style={{ background:"#1A56DB", border:"none", borderRadius:10, padding:"14px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:14, fontFamily:"inherit", marginTop:4 }}>
          {t("privacy_accept_btn")}
        </button>
        <div style={{ fontSize:11, color:"#94A3B8", textAlign:"center", marginTop:-8 }}>
          {t("privacy_footer")}
        </div>
      </div>
    </div>
  </div>
  );
};

// ─── UI ATOMS ────────────────────────────────────────────────────
const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
);

interface ChipProps { label: string; color?: string; bg?: string; size?: "sm" | "lg"; }
const Chip = ({ label, color = "#1A56DB", bg, size = "sm" }: ChipProps) => (
  <span style={{ display:"inline-flex", alignItems:"center", padding: size === "lg" ? "4px 12px" : "2px 8px", borderRadius:99, fontSize: size === "lg" ? 12 : 11, fontWeight:700, color, background: bg || color + "1A", whiteSpace:"nowrap", letterSpacing:.2 }}>{label}</span>
);

interface InputProps extends InputHTMLAttributes<HTMLInputElement> { label?: string; }
const Input = ({ label, ...props }: InputProps) => (
  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
    {label && <label style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.7 }}>{label}</label>}
    <input {...props} style={{ border:"1.5px solid #E2E6EC", borderRadius:8, padding:"8px 11px", fontSize:13, fontFamily:"inherit", background:"#FAFBFC", width:"100%", outline:"none", transition:"border .15s", ...props.style }} />
  </div>
);

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label?: string; children: ReactNode; }
const Select = ({ label, children, ...props }: SelectProps) => (
  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
    {label && <label style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.7 }}>{label}</label>}
    <select {...props} style={{ border:"1.5px solid #E2E6EC", borderRadius:8, padding:"8px 11px", fontSize:13, fontFamily:"inherit", background:"#FAFBFC", width:"100%", outline:"none", ...props.style }}>
      {children}
    </select>
  </div>
);

type BtnVariant = "primary" | "ghost" | "danger" | "success" | "warning" | "outline";
interface BtnProps { children: ReactNode; onClick?: () => void; variant?: BtnVariant; small?: boolean; icon?: ReactNode; disabled?: boolean; full?: boolean; style?: CSSProperties; }
const Btn = ({ children, onClick, variant = "primary", small, icon, disabled, full, style: s }: BtnProps) => {
  const V: Record<BtnVariant, { bg: string; c: string; border?: string }> = {
    primary: { bg:"#1A56DB", c:"#fff" },
    ghost:   { bg:"#F1F5F9", c:"#334155" },
    danger:  { bg:"#FDE8E8", c:"#E02424" },
    success: { bg:"#E6F9F4", c:"#0E9F6E" },
    warning: { bg:"#FEF3C7", c:"#B45309" },
    outline: { bg:"transparent", c:"#1A56DB", border:"1.5px solid #1A56DB" },
  };
  const v = V[variant] || V.primary;
  return (
    <button onClick={onClick} disabled={disabled} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6, padding: small ? "5px 11px" : "9px 16px", borderRadius:8, border: v.border || "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily:"inherit", fontWeight:600, fontSize: small ? 12 : 13, background: v.bg, color: v.c, opacity: disabled ? .5 : 1, transition:"all .15s", width: full ? "100%" : "auto", whiteSpace:"nowrap", ...s }}>
      {icon}{children}
    </button>
  );
};

interface ModalProps { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean; xl?: boolean; }
const Modal = ({ title, subtitle, onClose, children, wide, xl }: ModalProps) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(10,18,35,.6)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16, backdropFilter:"blur(2px)" }}>
    <div style={{ background:"#fff", borderRadius:16, width:"100%", maxWidth: xl ? 960 : wide ? 680 : 520, maxHeight:"92vh", overflowY:"auto", boxShadow:"0 32px 80px rgba(10,18,35,.22)", display:"flex", flexDirection:"column" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"18px 24px", borderBottom:"1px solid #F1F5F9", position:"sticky", top:0, background:"#fff", zIndex:1, borderRadius:"16px 16px 0 0" }}>
        <div>
          <div style={{ fontWeight:800, fontSize:15, color:"#0F1C2E" }}>{title}</div>
          {subtitle && <div style={{ fontSize:12, color:"#94A3B8", marginTop:2 }}>{subtitle}</div>}
        </div>
        <button onClick={onClose} style={{ background:"#F1F5F9", border:"none", borderRadius:8, padding:7, cursor:"pointer", color:"#64748B", display:"flex" }}>
          <Icon d="M18 6L6 18M6 6l12 12" />
        </button>
      </div>
      <div style={{ padding:"20px 24px", flex:1 }}>{children}</div>
    </div>
  </div>
);

// ─── AUTOCOMPLETE DE NOME ────────────────────────────────────────
interface AutocompleteNomeProps { value: string; onChange: (val: string) => void; suggestions: string[]; placeholder?: string; style?: CSSProperties; }
const AutocompleteNome = ({ value, onChange, suggestions, placeholder, style }: AutocompleteNomeProps) => {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!value.trim()) return suggestions.slice(0, 8);
    const q = value.toLowerCase();
    return suggestions.filter(s => s.toLowerCase().includes(q)).slice(0, 10);
  }, [value, suggestions]);

  useEffect(() => { setHighlighted(0); }, [filtered.length]);

  const calcPos = () => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + 2, left: r.left, width: r.width });
  };

  const openDropdown = () => { calcPos(); setOpen(true); };

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const reposition = () => { calcPos(); };
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  const select = (name: string) => { onChange(name); setOpen(false); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); openDropdown(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (open && filtered[highlighted]) select(filtered[highlighted]); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position:"relative", width:"100%" }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => { onChange(e.target.value.toUpperCase()); openDropdown(); setHighlighted(0); }}
        onFocus={openDropdown}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"7px 10px", fontSize:12, fontFamily:"inherit", background:"#FAFBFC", width:"100%", outline:"none", fontWeight:600, boxSizing:"border-box", ...style }}
      />
      {open && filtered.length > 0 && (
        <div style={{ position:"fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, background:"#fff", border:"1.5px solid #BFDBFE", borderRadius:8, boxShadow:"0 8px 24px rgba(10,18,35,.13)", zIndex:9999, maxHeight:200, overflowY:"auto", marginTop:0 }}>
          {filtered.map((name, idx) => (
            <div key={name} onMouseDown={() => select(name)} onMouseEnter={() => setHighlighted(idx)}
              style={{ padding:"8px 12px", fontSize:12, fontWeight:600, color:"#334155", cursor:"pointer", background: idx === highlighted ? "#EFF6FF" : "transparent", borderBottom: idx < filtered.length - 1 ? "1px solid #F1F5F9" : "none" }}>
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── FORM DE LANÇAMENTO ─────────────────────────────────────────
interface PessoaRow { nome: string; horaEntrada: string; horaSaida: string; }
interface FormLancamentoProps { inicial?: Registro | null; loteInicial?: Registro[]; onSave: (registros: Registro[]) => void; onCancel: () => void; opcoes: Opcoes; }

const FormLancamento = ({ inicial, loteInicial, onSave, onCancel, opcoes }: FormLancamentoProps) => {
  const { t } = useI18n();
  const isEdit = !!inicial;
  const isLoteEdit = !!loteInicial?.length;
  const base = loteInicial?.[0] ?? inicial;

  const [comum, setComum] = useState({
    data:        base?.data        || hoje(),
    turno:       base?.turno       || opcoes.turnos[0]       || "",
    horaEntrada: base?.horaEntrada || "05:00",
    horaSaida:   base?.horaSaida   || "13:20",
    cargo:       base?.cargo       || opcoes.cargos[0]       || "",
    setor:       base?.setor       || opcoes.setores[0]      || "",
    unidade:     base?.unidade     || opcoes.unidades[0]     || "",
    cc:          base?.cc          || opcoes.ccList[0]       || "",
    motivo:      base?.motivo      || opcoes.motivos[0]      || "",
    fornecedor:  base?.fornecedor  || opcoes.fornecedores[0] || "",
    obs:         base?.obs         || "",
  });

  const [pessoas, setPessoas] = useState<PessoaRow[]>(
    isLoteEdit
      ? loteInicial!.map(r => ({ nome: r.nome, horaEntrada: r.horaEntrada, horaSaida: r.horaSaida }))
      : [{ nome: inicial?.nome || "", horaEntrada: base?.horaEntrada || "05:00", horaSaida: base?.horaSaida || "13:20" }]
  );

  const setC = (k: string, v: string) => {
    if (k === "horaEntrada") setPessoas(ps => ps.map(p => p.horaEntrada === comum.horaEntrada ? { ...p, horaEntrada: v } : p));
    if (k === "horaSaida")   setPessoas(ps => ps.map(p => p.horaSaida   === comum.horaSaida   ? { ...p, horaSaida: v }   : p));
    setComum(prev => ({ ...prev, [k]: v }));
  };

  const handleQtd = (n: number) => {
    const cap = Math.max(1, Math.min(20, n));
    setPessoas(prev => {
      if (cap > prev.length)
        return [...prev, ...Array.from({ length: cap - prev.length }, () => ({ nome: "", horaEntrada: comum.horaEntrada, horaSaida: comum.horaSaida }))];
      return prev.slice(0, cap);
    });
  };

  const setP = (i: number, k: keyof PessoaRow, v: string) =>
    setPessoas(ps => ps.map((p, idx) => idx === i ? { ...p, [k]: v } : p));

  const validCount = pessoas.filter(p => p.nome.trim().length > 2).length;
  const valid = isEdit ? pessoas[0]?.nome.trim().length > 2 : validCount > 0;

  const handleSave = () => {
    if (!valid) return;
    if (isEdit) {
      const p = pessoas[0];
      onSave([{ ...inicial!, ...comum, nome: p.nome.trim(), horaEntrada: p.horaEntrada, horaSaida: p.horaSaida, totalHoras: calcHoras(p.horaEntrada, p.horaSaida) }]);
    } else {
      const validPessoas = pessoas.filter(p => p.nome.trim().length > 2);
      const lId = isLoteEdit ? loteInicial![0].loteId : (validPessoas.length > 1 ? uuid() : undefined);
      onSave(validPessoas.map((p, i) => ({
        id: isLoteEdit ? (loteInicial![i]?.id ?? uuid()) : uuid(),
        ...(lId ? { loteId: lId } : {}),
        ...comum,
        nome: p.nome.trim(),
        horaEntrada: p.horaEntrada,
        horaSaida: p.horaSaida,
        totalHoras: calcHoras(p.horaEntrada, p.horaSaida),
      })));
    }
  };

  const G = ({ children, cols = 2 }: { children: ReactNode; cols?: number }) => {
    const cls = cols >= 4 ? "rsp-grid-4" : cols === 3 ? "rsp-grid-3" : "rsp-grid-2";
    return <div className={cls} style={{ display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`, gap:14 }}>{children}</div>;
  };

  const totalPadrao = calcHoras(comum.horaEntrada, comum.horaSaida);
  const btnLabel = (isEdit || isLoteEdit)
    ? t("form_btn_save_edit")
    : validCount > 1
      ? t("form_btn_save_multi").replace("{n}", String(validCount))
      : t("form_btn_save");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Bloco 0 — Quantidade */}
      {!isEdit && !isLoteEdit && (
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

      {/* Bloco 1 — Identificação */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:20, height:20, borderRadius:6, background:"#1A56DB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:800 }}>1</div>
          {t("form_block_1")}
        </div>
        <G cols={2}>
          <Select label={t("form_label_cargo")} value={comum.cargo} onChange={e => setC("cargo", e.target.value)}>{opcoes.cargos.map(c => <option key={c}>{c}</option>)}</Select>
          <Select label={t("form_label_forn")} value={comum.fornecedor} onChange={e => setC("fornecedor", e.target.value)}>{opcoes.fornecedores.map(c => <option key={c}>{c}</option>)}</Select>
        </G>
      </div>

      {/* Bloco 2 — Lotação */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:20, height:20, borderRadius:6, background:"#0E9F6E", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:800 }}>2</div>
          {t("form_block_2")}
        </div>
        <G cols={3}>
          <Select label={t("form_label_unidade")} value={comum.unidade} onChange={e => setC("unidade", e.target.value)}>{opcoes.unidades.map(c => <option key={c}>{c}</option>)}</Select>
          <Select label={t("form_label_setor")} value={comum.setor} onChange={e => setC("setor", e.target.value)}>{opcoes.setores.map(c => <option key={c}>{c}</option>)}</Select>
          <Select label={t("form_label_cc")} value={comum.cc} onChange={e => setC("cc", e.target.value)}>{opcoes.ccList.map(c => <option key={c}>{c}</option>)}</Select>
        </G>
      </div>

      {/* Bloco 3 — Jornada */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:20, height:20, borderRadius:6, background:"#D97706", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:800 }}>3</div>
          {t("form_block_3")}
          {!isEdit && <span style={{ fontSize:10, color:"#94A3B8", fontWeight:400, letterSpacing:.3, marginLeft:4 }}>{t("form_block_3_note")}</span>}
        </div>
        <G cols={4}>
          <Input label={t("form_label_data")} type="date" value={comum.data} onChange={e => setC("data", e.target.value)} />
          <Select label={t("form_label_turno")} value={comum.turno} onChange={e => setC("turno", e.target.value)}>{opcoes.turnos.map(c => <option key={c}>{c}</option>)}</Select>
          <Input label={isEdit ? t("form_label_entrada") : t("form_label_entrada_padrao")} type="time" value={comum.horaEntrada} onChange={e => setC("horaEntrada", e.target.value)} />
          <Input label={isEdit ? t("form_label_saida") : t("form_label_saida_padrao")} type="time" value={comum.horaSaida} onChange={e => setC("horaSaida", e.target.value)} />
        </G>
        {totalPadrao && (
          <div style={{ marginTop:10, display:"inline-flex", alignItems:"center", gap:8, background:"#E6F9F4", borderRadius:8, padding:"8px 14px" }}>
            <Icon d="M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" size={14} />
            <span style={{ fontSize:13, fontWeight:700, color:"#0E9F6E", fontFamily:"monospace" }}>{isEdit ? t("form_total") : t("form_padrao")} {totalPadrao}</span>
          </div>
        )}
      </div>

      {/* Bloco 4 — Motivo */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:20, height:20, borderRadius:6, background:"#6C63FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:800 }}>4</div>
          {t("form_block_4")}
        </div>
        <G cols={1}>
          <Select label={t("form_label_motivo")} value={comum.motivo} onChange={e => setC("motivo", e.target.value)}>{opcoes.motivos.map(c => <option key={c}>{c}</option>)}</Select>
          <Input label={t("form_label_obs")} value={comum.obs} onChange={e => setC("obs", e.target.value)} placeholder={t("form_obs_placeholder")} />
        </G>
      </div>

      {/* Bloco 5 — Colaboradores */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:20, height:20, borderRadius:6, background:"#0891B2", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:800 }}>5</div>
          {isEdit ? t("form_block_5") : `${t("form_block_5_multi")} — ${pessoas.length} ${pessoas.length !== 1 ? t("form_persons") : t("form_person")}`}
        </div>
        <div style={{ border:"1px solid #E2E6EC", borderRadius:10, overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
          <div style={{ minWidth:460 }}>
          <div style={{ display:"grid", gridTemplateColumns:"36px 1fr 124px 124px 72px", background:"#F8FAFC", borderBottom:"1px solid #E2E6EC", padding:"9px 14px", gap:8 }}>
            {[t("form_col_num"), t("form_col_nome"), t("form_col_entrada"), t("form_col_saida"), t("form_col_total")].map(h => (
              <div key={h} style={{ fontSize:10, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:.6 }}>{h}</div>
            ))}
          </div>
          {pessoas.map((p, i) => {
            const total = calcHoras(p.horaEntrada, p.horaSaida);
            return (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"36px 1fr 124px 124px 72px", gap:8, padding:"8px 14px", borderBottom: i < pessoas.length - 1 ? "1px solid #F1F5F9" : "none", alignItems:"center", background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textAlign:"center" }}>{i + 1}</div>
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
    </div>
  );
};

// ─── TELA: LANÇAMENTOS ──────────────────────────────────────────
interface Filtros { data: string; turno: string; fornecedor: string; unidade: string; setor: string; busca: string; }

const Lancamentos = ({ registros, setRegistros, opcoes }: { registros: Registro[]; setRegistros: (val: Registro[]) => void; opcoes: Opcoes }) => {
  const { t, lang } = useI18n();
  const [filtros, setFiltros] = useState<Filtros>({ data: hoje(), turno: "", fornecedor: "", unidade: "", setor: "", busca: "" });
  const [modal, setModal]     = useState<null | "new" | Registro | Registro[]>(null);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [detalhe, setDetalhe] = useState<Registro | Registro[] | null>(null);

  const set = (k: keyof Filtros, v: string) => setFiltros(f => ({ ...f, [k]: v }));

  const filtered = useMemo(() => registros.filter(r => {
    if (filtros.data       && r.data !== filtros.data)               return false;
    if (filtros.turno      && r.turno !== filtros.turno)             return false;
    if (filtros.fornecedor && r.fornecedor !== filtros.fornecedor)   return false;
    if (filtros.unidade    && r.unidade !== filtros.unidade)         return false;
    if (filtros.setor      && r.setor !== filtros.setor)             return false;
    if (filtros.busca      && !r.nome.toLowerCase().includes(filtros.busca.toLowerCase())) return false;
    return true;
  }), [registros, filtros]);

  // Agrupa registros do mesmo lote em uma única entrada para exibição
  const grupos = useMemo(() => {
    const loteMap = new Map<string, Registro[]>();
    filtered.forEach(r => {
      if (r.loteId) {
        if (!loteMap.has(r.loteId)) loteMap.set(r.loteId, []);
        loteMap.get(r.loteId)!.push(r);
      }
    });
    const seen = new Set<string>();
    const result: (Registro | Registro[])[] = [];
    filtered.forEach(r => {
      if (r.loteId) {
        if (!seen.has(r.loteId)) { seen.add(r.loteId); result.push(loteMap.get(r.loteId)!); }
      } else {
        result.push(r);
      }
    });
    return result;
  }, [filtered]);

  const salvar = (novos: Registro[]) => {
    if (modal === "new") {
      setRegistros([...registros, ...novos]);
    } else if (Array.isArray(modal)) {
      const ids = new Set(modal.map(r => r.id));
      setRegistros([...registros.filter(r => !ids.has(r.id)), ...novos]);
    } else {
      setRegistros(registros.map(r => r.id === novos[0].id ? novos[0] : r));
    }
    setModal(null);
  };

  const excluir = (ids: string[]) => { setRegistros(registros.filter(r => !ids.includes(r.id))); setConfirm(null); };

  const exportCSV = () => {
    const h = ["Data","Turno","Hora Entrada","Hora Saída","Total Horas","Nome","Cargo","Setor","Unidade","CC","Motivo","Fornecedor","Obs"];
    const rows = filtered.map(r => [r.data,r.turno,r.horaEntrada,r.horaSaida,r.totalHoras,r.nome,r.cargo,r.setor||"",r.unidade,r.cc,r.motivo,r.fornecedor,r.obs].join(";"));
    const blob = new Blob(["\uFEFF" + [h.join(";"), ...rows].join("\n")], { type:"text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `terceiros_${filtros.data || "todos"}.csv`; a.click();
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>{t("lanc_section")}</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#0F1C2E" }}>{t("lanc_title")}</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="ghost" onClick={exportCSV} icon={<Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />}>{t("lanc_btn_export")}</Btn>
          <Btn onClick={() => setModal("new")} icon={<Icon d="M12 5v14M5 12h14" />}>{t("lanc_btn_new")}</Btn>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:"14px 18px", display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
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
        <Select label={t("form_label_setor")} value={filtros.setor} onChange={e => set("setor", e.target.value)} style={{ width:150 }}>
          <option value="">{t("lanc_filter_all_m")}</option>{opcoes.setores.map(opt => <option key={opt}>{opt}</option>)}
        </Select>
        <Input label={t("lanc_filter_busca")} value={filtros.busca} onChange={e => set("busca", e.target.value)} placeholder="Nome…" style={{ width:180 }} />
        <div style={{ marginLeft:"auto", alignSelf:"flex-end" }}>
          <Btn variant="ghost" small onClick={() => setFiltros({ data:"", turno:"", fornecedor:"", unidade:"", setor:"", busca:"" })}>{t("lanc_filter_clear")}</Btn>
        </div>
      </div>

      {/* Contador */}
      <div style={{ fontSize:12, color:"#94A3B8", paddingLeft:2 }}>
        {t("lanc_showing").replace("{n}", String(filtered.length)).replace("{total}", String(registros.length))}
      </div>

      {/* Tabela */}
      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ background:"#F8FAFC" }}>
                {[t("lanc_col_data"),t("lanc_col_turno"),t("lanc_col_nome"),t("lanc_col_cargo"),t("lanc_col_forn"),t("lanc_col_setor"),t("lanc_col_unidade"),t("lanc_col_entrada"),t("lanc_col_saida"),t("lanc_col_horas"),t("lanc_col_motivo"),t("lanc_col_acoes")].map(h => (
                  <th key={h} style={{ padding:"10px 12px", textAlign:"left", color:"#64748B", fontWeight:700, fontSize:10, textTransform:"uppercase", letterSpacing:.7, whiteSpace:"nowrap", borderBottom:"2px solid #E2E6EC" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.length === 0 && (
                <tr><td colSpan={12} style={{ textAlign:"center", padding:48, color:"#94A3B8" }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
                  {t("lanc_empty")}
                </td></tr>
              )}
              {grupos.map((item, i) => {
                const isLote = Array.isArray(item);
                const r = isLote ? item[0] : item;
                const count = isLote ? item.length : 1;
                const bgBase = i % 2 === 0 ? "#fff" : "#FAFBFC";
                return (
                  <tr key={isLote ? r.loteId : r.id}
                    style={{ borderBottom:"1px solid #F1F5F9", background: bgBase, cursor:"pointer",
                      borderLeft: isLote ? "3px solid #1A56DB" : "3px solid transparent" }}
                    onClick={() => setDetalhe(item)}
                    onMouseEnter={e => (e.currentTarget.style.background = "#F0F6FF")}
                    onMouseLeave={e => (e.currentTarget.style.background = bgBase)}>
                    <td style={{ padding:"10px 12px", fontFamily:"monospace", fontSize:11, color:"#64748B" }}>{fmt(r.data, lang)}</td>
                    <td style={{ padding:"10px 12px" }}><Chip label={r.turno} color="#1A56DB" /></td>
                    <td style={{ padding:"10px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ fontWeight:700, color:"#0F1C2E", whiteSpace:"nowrap" }}>{r.nome}</div>
                        {isLote && <span style={{ background:"#1A56DB", color:"#fff", borderRadius:99, padding:"1px 7px", fontSize:10, fontWeight:800, flexShrink:0 }}>{count}×</span>}
                      </div>
                      {isLote && <div style={{ fontSize:10, color:"#94A3B8", marginTop:2 }}>{item.slice(1, 3).map(x => x.nome).join(", ")}{count > 3 ? ` +${count - 3}` : ""}</div>}
                    </td>
                    <td style={{ padding:"10px 12px", color:"#475569", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.cargo}</td>
                    <td style={{ padding:"10px 12px" }}><Chip label={r.fornecedor} color={fornCor(r.fornecedor, opcoes.fornecedores)} /></td>
                    <td style={{ padding:"10px 12px" }}><Chip label={r.setor || "—"} color="#6C63FF" /></td>
                    <td style={{ padding:"10px 12px" }}><Chip label={r.unidade} color="#0E9F6E" /></td>
                    <td style={{ padding:"10px 12px", fontFamily:"monospace", color:"#475569" }}>{r.horaEntrada}</td>
                    <td style={{ padding:"10px 12px", fontFamily:"monospace", color:"#475569" }}>{r.horaSaida}</td>
                    <td style={{ padding:"10px 12px", fontFamily:"monospace", fontWeight:800, color:"#0E9F6E" }}>{r.totalHoras}</td>
                    <td style={{ padding:"10px 12px", color:"#64748B", maxWidth:150, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.motivo}</td>
                    <td style={{ padding:"10px 12px" }} onClick={e => e.stopPropagation()}>
                      <div style={{ display:"flex", gap:5 }}>
                        <button onClick={() => setDetalhe(item)} title="Ver detalhes" style={{ background:"#F1F5F9", border:"none", borderRadius:6, padding:"5px 8px", cursor:"pointer", color:"#64748B", display:"flex" }}><Icon d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" size={14} /></button>
                        <button onClick={() => setModal(item)} title="Editar" style={{ background:"#EBF0FD", border:"none", borderRadius:6, padding:"5px 8px", cursor:"pointer", color:"#1A56DB", display:"flex" }}><Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={14} /></button>
                        <button onClick={() => setConfirm(isLote ? item.map(x => x.id) : [r.id])} title="Excluir" style={{ background:"#FDE8E8", border:"none", borderRadius:6, padding:"5px 8px", cursor:"pointer", color:"#E02424", display:"flex" }}><Icon d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" size={14} /></button>
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
            onSave={salvar} onCancel={() => setModal(null)} opcoes={opcoes} />
        </Modal>
      )}

      {detalhe && (
        <Modal
          title={Array.isArray(detalhe) ? `${t("lanc_detail_lote")} — ${detalhe.length} ${detalhe.length !== 1 ? t("form_persons") : t("form_person")}` : t("lanc_detail_title")}
          subtitle={Array.isArray(detalhe) ? `${fmt(detalhe[0].data, lang)} · ${detalhe[0].turno}` : detalhe.nome}
          onClose={() => setDetalhe(null)} wide={!Array.isArray(detalhe)} xl={Array.isArray(detalhe)}>
          {Array.isArray(detalhe) ? (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {/* Campos comuns */}
              <div className="rsp-modal-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {([
                  [t("detail_data"), fmt(detalhe[0].data, lang)], [t("detail_turno"), detalhe[0].turno],
                  [t("detail_cargo"), detalhe[0].cargo], [t("detail_forn"), detalhe[0].fornecedor],
                  [t("detail_unidade"), detalhe[0].unidade], [t("detail_setor"), detalhe[0].setor],
                  [t("detail_cc"), detalhe[0].cc], [t("detail_motivo"), detalhe[0].motivo],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} style={{ background:"#F8FAFC", borderRadius:8, padding:"10px 14px" }}>
                    <div style={{ fontSize:10, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:.7, marginBottom:4 }}>{k}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#0F1C2E" }}>{v || "—"}</div>
                  </div>
                ))}
              </div>
              {/* Lista de colaboradores */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>{t("lanc_detail_cols")} ({detalhe.length})</div>
                <div style={{ border:"1px solid #E2E6EC", borderRadius:8, overflow:"hidden" }}>
                  <div style={{ overflowX:"auto" }}>
                  <div style={{ minWidth:380 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 96px 96px 72px", background:"#F8FAFC", padding:"8px 14px", gap:8, borderBottom:"1px solid #E2E6EC" }}>
                    {[t("detail_col_nome"),t("detail_col_entrada"),t("detail_col_saida"),t("detail_col_total")].map(h => <div key={h} style={{ fontSize:10, fontWeight:700, color:"#64748B", textTransform:"uppercase" }}>{h}</div>)}
                  </div>
                  {detalhe.map((rec, idx) => (
                    <div key={rec.id} style={{ display:"grid", gridTemplateColumns:"1fr 96px 96px 72px", gap:8, padding:"8px 14px", background: idx%2===0?"#fff":"#FAFBFC", borderTop: idx > 0 ? "1px solid #F1F5F9" : "none" }}>
                      <span style={{ fontWeight:600, color:"#0F1C2E", fontSize:12 }}>{rec.nome}</span>
                      <span style={{ fontFamily:"monospace", color:"#475569", fontSize:12 }}>{rec.horaEntrada}</span>
                      <span style={{ fontFamily:"monospace", color:"#475569", fontSize:12 }}>{rec.horaSaida}</span>
                      <span style={{ fontFamily:"monospace", fontWeight:700, color:"#0E9F6E", fontSize:12 }}>{rec.totalHoras}</span>
                    </div>
                  ))}
                  </div>
                  </div>
                </div>
              </div>
              {detalhe[0].obs && (
                <div style={{ background:"#FEF3C7", borderRadius:8, padding:"10px 14px" }}>
                  <div style={{ fontSize:10, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:.7, marginBottom:4 }}>{t("lanc_detail_obs")}</div>
                  <div style={{ fontSize:13, color:"#0F1C2E" }}>{detalhe[0].obs}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="rsp-modal-grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {([
                  [t("detail_nome"), detalhe.nome], [t("detail_cargo"), detalhe.cargo], [t("detail_forn"), detalhe.fornecedor],
                  [t("detail_data"), fmt(detalhe.data, lang)], [t("detail_turno"), detalhe.turno], [t("detail_setor"), detalhe.setor],
                  [t("detail_unidade"), detalhe.unidade], [t("detail_cc"), detalhe.cc],
                  [t("detail_entrada"), detalhe.horaEntrada], [t("detail_saida"), detalhe.horaSaida],
                  [t("detail_total_horas"), detalhe.totalHoras], [t("detail_motivo"), detalhe.motivo],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ background:"#F8FAFC", borderRadius:8, padding:"10px 14px" }}>
                  <div style={{ fontSize:10, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:.7, marginBottom:4 }}>{k}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#0F1C2E" }}>{v || "—"}</div>
                </div>
              ))}
              {detalhe.obs && (
                <div style={{ gridColumn:"span 2", background:"#FEF3C7", borderRadius:8, padding:"10px 14px" }}>
                  <div style={{ fontSize:10, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:.7, marginBottom:4 }}>{t("lanc_detail_obs")}</div>
                  <div style={{ fontSize:13, color:"#0F1C2E" }}>{detalhe.obs}</div>
                </div>
              )}
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:16, paddingTop:16, borderTop:"1px solid #F1F5F9" }}>
            <Btn variant="ghost" onClick={() => setDetalhe(null)}>{t("lanc_detail_close")}</Btn>
            <Btn onClick={() => { setModal(detalhe); setDetalhe(null); }}>{t("lanc_detail_edit")}</Btn>
          </div>
        </Modal>
      )}

      {confirm && (
        <Modal title={t("lanc_confirm_title")} onClose={() => setConfirm(null)}>
          <p style={{ color:"#475569", fontSize:13, lineHeight:1.6 }}>
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
    </div>
  );
};

// ─── TELA: DASHBOARD ────────────────────────────────────────────
const Dashboard = ({ registros, opcoes }: { registros: Registro[]; opcoes: Opcoes }) => {
  const { t, lang } = useI18n();
  const [periodo, setPeriodo] = useState(mesAtual());

  const doMes  = useMemo(() => registros.filter(r => r.data.startsWith(periodo)), [registros, periodo]);
  const deHoje = registros.filter(r => r.data === hoje());

  const totalHorasMes = useMemo(() => {
    const mins = doMes.reduce((acc, r) => {
      if (!r.totalHoras) return acc;
      const [h, m] = r.totalHoras.split(":").map(Number);
      return acc + h * 60 + m;
    }, 0);
    return `${Math.floor(mins / 60)}h ${mins % 60}min`;
  }, [doMes]);

  const porFornecedor = useMemo(() => {
    const m: Record<string, number> = {};
    doMes.filter(r => opcoes.fornecedores.includes(r.fornecedor))
         .forEach(r => { m[r.fornecedor] = (m[r.fornecedor] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [doMes, opcoes.fornecedores]);

  const porSetor = useMemo(() => {
    const m: Record<string, number> = {};
    doMes.forEach(r => { const k = r.setor || "SEM SETOR"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [doMes]);

  const CHART_CORES = ["#1A56DB","#0E9F6E","#D97706","#6C63FF","#E02424","#0891B2"];

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

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>{t("dash_section")}</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#0F1C2E" }}>{t("dash_title")}</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={() => { const d = new Date(periodo + "-01"); d.setMonth(d.getMonth() - 1); setPeriodo(d.toISOString().slice(0, 7)); }}
            style={{ background:"#F1F5F9", border:"none", borderRadius:8, padding:"8px 12px", cursor:"pointer", fontWeight:700 }}>‹</button>
          <span style={{ fontSize:14, fontWeight:800, minWidth:100, textAlign:"center", color:"#0F1C2E" }}>{fmtMes(periodo, lang)}</span>
          <button onClick={() => { const d = new Date(periodo + "-01"); d.setMonth(d.getMonth() + 1); setPeriodo(d.toISOString().slice(0, 7)); }}
            style={{ background:"#F1F5F9", border:"none", borderRadius:8, padding:"8px 12px", cursor:"pointer", fontWeight:700 }}>›</button>
        </div>
      </div>

      <div className="rsp-grid-4" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        <KPI label={t("dash_kpi_records")} value={doMes.length} sub={t("dash_kpi_today").replace("{n}", String(deHoje.length))} color="#1A56DB"
          icon={<Icon d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />} />
        <KPI label={t("dash_kpi_forn")} value={porFornecedor.length} sub={t("dash_kpi_period")} color="#D97706"
          icon={<Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />} />
        <KPI label={t("dash_kpi_horas")} value={totalHorasMes} sub={t("dash_kpi_horas_sub")} color="#0E9F6E"
          icon={<Icon d="M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" />} />
        <KPI label={t("dash_kpi_setores")} value={porSetor.length} sub={t("dash_kpi_period")} color="#6C63FF"
          icon={<Icon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />} />
      </div>

      <div className="rsp-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
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
          <div style={{ fontWeight:700, fontSize:13, marginBottom:16, color:"#0F1C2E" }}>{t("dash_chart_setor")}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {porSetor.length === 0 && <div style={{ color:"#94A3B8", fontSize:12, textAlign:"center", padding:20 }}>{t("dash_no_data")}</div>}
            {porSetor.map(([setor, n], i) => {
              const pct = doMes.length ? (n / doMes.length * 100) : 0;
              const cor = CHART_CORES[(i + 2) % CHART_CORES.length];
              return (
                <div key={setor}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:5 }}>
                    <span style={{ fontWeight:600, color:"#334155" }}>{setor}</span>
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
      </div>

      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:14, color:"#0F1C2E" }}>{t("dash_chart_turno")}</div>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
          {opcoes.turnos.map((turno, i) => {
            const doMes_t  = doMes.filter(r => r.turno === turno);
            const n        = doMes_t.length;
            const pct      = doMes.length ? (n / doMes.length * 100).toFixed(0) : 0;
            const cor      = CHART_CORES[i % CHART_CORES.length];
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

// ─── TELA: FORNECEDORES ─────────────────────────────────────────
const Fornecedores = ({ registros, opcoes }: { registros: Registro[]; opcoes: Opcoes }) => {
  const { t, lang } = useI18n();
  const resumo = useMemo(() => {
    return opcoes.fornecedores.map(forn => {
      const regs    = registros.filter(r => r.fornecedor === forn);
      const hoje_   = regs.filter(r => r.data === hoje()).length;
      const mes_    = regs.filter(r => r.data.startsWith(mesAtual())).length;
      const mins    = regs.reduce((acc, r) => { if (!r.totalHoras) return acc; const [h, m] = r.totalHoras.split(":").map(Number); return acc + h * 60 + m; }, 0);
      const horas   = `${Math.floor(mins / 60)}h ${mins % 60}min`;
      const setores = [...new Set(regs.map(r => r.setor).filter(Boolean))];
      const ultimos = [...regs].sort((a, b) => a.data > b.data ? -1 : 1).slice(0, 5);
      return { forn, total: regs.length, hoje: hoje_, mes: mes_, horas, setores, ultimos };
    }).filter(f => f.total > 0);
  }, [registros, opcoes.fornecedores]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div>
        <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>{t("forn_section")}</div>
        <div style={{ fontSize:20, fontWeight:800, color:"#0F1C2E" }}>{t("forn_title")}</div>
      </div>
      {resumo.length === 0 && (
        <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:48, textAlign:"center", color:"#94A3B8" }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🏢</div>
          {t("forn_empty")}
        </div>
      )}
      <div className="rsp-grid-autofill" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:14 }}>
        {resumo.map(({ forn, total, hoje: hj, mes, horas, setores, ultimos }) => {
          const cor = fornCor(forn, opcoes.fornecedores);
          return (
            <div key={forn} style={{ background:"#fff", border:`1px solid ${cor}33`, borderRadius:12, overflow:"hidden", boxShadow:"0 1px 4px rgba(15,28,46,.06)" }}>
              <div style={{ background:cor, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ fontWeight:800, fontSize:14, color:"#fff" }}>{forn}</div>
                <div style={{ background:"rgba(255,255,255,.2)", borderRadius:8, padding:"4px 10px", fontSize:12, fontWeight:700, color:"#fff" }}>{total} {t("forn_registros")}</div>
              </div>
              <div style={{ padding:"14px 18px" }}>
                <div className="rsp-grid-3" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
                  {([[t("forn_card_today"), hj, cor], [t("forn_card_mes"), mes, "#334155"], [t("forn_card_horas"), horas, "#0E9F6E"]] as [string, string | number, string][]).map(([l, v, c]) => (
                    <div key={l} style={{ background:"#F8FAFC", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                      <div style={{ fontSize:10, color:"#94A3B8", textTransform:"uppercase", letterSpacing:.6, marginBottom:3 }}>{l}</div>
                      <div style={{ fontSize:14, fontWeight:800, color:c }}>{v}</div>
                    </div>
                  ))}
                </div>
                {setores.length > 0 && (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:10, color:"#94A3B8", textTransform:"uppercase", letterSpacing:.6, marginBottom:6 }}>{t("forn_setores")}</div>
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                      {setores.map(s => <Chip key={s} label={s} color={cor} size="sm" />)}
                    </div>
                  </div>
                )}
                {ultimos.length > 0 && (
                  <div>
                    <div style={{ fontSize:10, color:"#94A3B8", textTransform:"uppercase", letterSpacing:.6, marginBottom:6 }}>{t("forn_ultimos")}</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                      {ultimos.map(r => (
                        <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:11, padding:"4px 0", borderBottom:"1px solid #F1F5F9" }}>
                          <span style={{ fontWeight:600, color:"#334155", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:160 }}>{r.nome}</span>
                          <span style={{ color:"#94A3B8", fontFamily:"monospace", flexShrink:0, marginLeft:8 }}>{fmt(r.data, lang)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── TELA: CONFIGURAÇÕES ────────────────────────────────────────
const OPCOES_CONFIG: { key: keyof Omit<Opcoes, "nomes">; label: string; cor: string }[] = [
  { key: "turnos",       label: "Turnos",          cor: "#1A56DB" },
  { key: "unidades",     label: "Unidades",         cor: "#0E9F6E" },
  { key: "fornecedores", label: "Fornecedores",     cor: "#D97706" },
  { key: "motivos",      label: "Motivos",          cor: "#6C63FF" },
  { key: "cargos",       label: "Cargos",           cor: "#E02424" },
  { key: "ccList",       label: "Centros de Custo", cor: "#0891B2" },
  { key: "setores",      label: "Setores",          cor: "#475569" },
];

const Configuracoes = ({
  opcoes,
  setOpcoes,
  registros,
  setRegistros,
  isAdmin,
}: {
  opcoes: Opcoes;
  setOpcoes: (val: Opcoes) => void;
  registros: Registro[];
  setRegistros: (val: Registro[]) => void;
  isAdmin: boolean;
}) => {
  const { t, lang } = useI18n();
  type OpcKey = keyof Opcoes;
  const [inputs, setInputs] = useState<Record<OpcKey, string>>({
    turnos: "", unidades: "", fornecedores: "", motivos: "", cargos: "", ccList: "", setores: "", nomes: ""
  });
  const [nomesBulk, setNomesBulk] = useState("");
  const [nomeBusca, setNomeBusca] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState("");

  // ── Estado de edição inline e busca por card ──
  const emptyByKey = { turnos: "", unidades: "", fornecedores: "", motivos: "", cargos: "", ccList: "", setores: "", nomes: "" };
  const [editing, setEditing] = useState<{ key: OpcKey; idx: number; value: string } | null>(null);
  const [cardSearch, setCardSearch] = useState<Record<OpcKey, string>>(emptyByKey);
  const [bulkCategory, setBulkCategory] = useState<OpcKey>("nomes");

  // ── Config de Turnos (horas padrão) ──
  const [turnosConfig, setTurnosConfig] = useState<TurnoConfig[]>([]);
  const [turnosConfigSaved, setTurnosConfigSaved] = useState(false);

  // ── Config de Diárias (fornecedor + turno → valor) ──
  const [diariasConfig, setDiariasConfig] = useState<DiariaConfig[]>([]);
  const [newDiaria, setNewDiaria] = useState({ fornecedor: "", turno: "", valor: "250" });

  useEffect(() => {
    authReady.then(async () => {
      // Carregar turnos_config
      const { data: tData } = await supabase.from("turnos_config").select("*").order("turno");
      if (tData) setTurnosConfig(tData.map(dbToTurnoConfig));
      // Carregar diarias_config
      const { data: dData } = await supabase.from("diarias_config").select("*").order("fornecedor");
      if (dData) setDiariasConfig(dData.map(dbToDiariaConfig));
    });
  }, []);

  const saveTurnosConfig = async () => {
    for (const tc of turnosConfig) {
      await supabase.from("turnos_config").upsert({
        turno: tc.turno,
        hora_inicio: tc.horaInicio,
        hora_fim: tc.horaFim,
        hora_padrao: tc.horaPadrao,
      }, { onConflict: "turno" });
    }
    setTurnosConfigSaved(true);
    setTimeout(() => setTurnosConfigSaved(false), 2000);
  };

  const addDiaria = async () => {
    const forn = newDiaria.fornecedor.trim();
    const turno = newDiaria.turno.trim() || null;
    const valor = parseFloat(newDiaria.valor);
    if (!forn || isNaN(valor)) return;
    const { data, error } = await supabase.from("diarias_config")
      .upsert({ fornecedor: forn, turno, valor_diaria: valor }, { onConflict: "fornecedor,turno" })
      .select();
    if (!error && data) {
      const updated = data.map(dbToDiariaConfig);
      setDiariasConfig(prev => {
        const filtered = prev.filter(d => !(d.fornecedor === forn && d.turno === turno));
        return [...filtered, ...updated].sort((a, b) => a.fornecedor.localeCompare(b.fornecedor));
      });
      setNewDiaria({ fornecedor: "", turno: "", valor: "250" });
    }
  };

  const removeDiaria = async (d: DiariaConfig) => {
    if (!d.id) return;
    await supabase.from("diarias_config").delete().eq("id", d.id);
    setDiariasConfig(prev => prev.filter(x => x.id !== d.id));
  };

  // ── DPO (Art. 41 LGPD)
  const [dpoNome,       setDpoNome]       = useState("");
  const [dpoEmail,      setDpoEmail]      = useState("");
  const [dpoTelefone,   setDpoTelefone]   = useState("");
  const [dpoSaved,      setDpoSaved]      = useState(false);

  useEffect(() => {
    authReady.then(async () => {
      const { data } = await supabase
        .from("opcoes")
        .select("chave, valor")
        .in("chave", ["dpo_nome", "dpo_email", "dpo_telefone"]);
      if (data) {
        data.forEach((row: { chave: string; valor: string }) => {
          if (row.chave === "dpo_nome")      setDpoNome(row.valor);
          if (row.chave === "dpo_email")     setDpoEmail(row.valor);
          if (row.chave === "dpo_telefone")  setDpoTelefone(row.valor);
        });
      }
    });
  }, []);

  const saveDpo = async () => {
    const fields = [
      { chave: "dpo_nome",      valor: dpoNome.trim() },
      { chave: "dpo_email",     valor: dpoEmail.trim() },
      { chave: "dpo_telefone",  valor: dpoTelefone.trim() },
    ];
    for (const f of fields) {
      await supabase.from("opcoes").delete().eq("chave", f.chave);
      if (f.valor) await supabase.from("opcoes").insert({ chave: f.chave, valor: f.valor });
    }
    setDpoSaved(true);
    setTimeout(() => setDpoSaved(false), 2500);
  };

  // ── Exclusão por Solicitação (Art. 18 LGPD)
  const [titularNome,   setTitularNome]   = useState("");
  const [titularResult, setTitularResult] = useState<Registro[] | null>(null);
  const [exclusaoConfirm, setExclusaoConfirm] = useState(false);
  const [exclusaoFeedback, setExclusaoFeedback] = useState("");

  const buscarTitular = () => {
    const q = titularNome.trim().toUpperCase();
    if (!q) return;
    setTitularResult(registros.filter(r => r.nome === q));
    setExclusaoConfirm(false);
    setExclusaoFeedback("");
  };

  const excluirTitular = () => {
    const q = titularNome.trim().toUpperCase();
    const ids = (titularResult ?? []).map(r => r.id);
    if (!ids.length) return;
    setRegistros(registros.filter(r => r.nome !== q));
    logAudit("EXCLUSAO_TITULAR", "registros", undefined, {
      nome: q,
      registros_removidos: ids.length,
      ids,
      motivo: "Solicitação de exclusão Art. 18 LGPD",
    });
    setTitularResult(null);
    setTitularNome("");
    setExclusaoConfirm(false);
    setExclusaoFeedback(t("lgpd_success").replace("{n}", String(ids.length)).replace(/\{s\}/g, ids.length > 1 ? "s" : "").replace("{name}", q));
    setTimeout(() => setExclusaoFeedback(""), 5000);
  };

  const addItem = (key: OpcKey, value: string) => {
    const v = value.trim().toUpperCase();
    if (!v || opcoes[key].includes(v)) return;
    setOpcoes({ ...opcoes, [key]: [...opcoes[key], v] });
    setInputs(prev => ({ ...prev, [key]: "" }));
  };

  const removeItem = (key: OpcKey, idx: number) => {
    const arr = [...opcoes[key]];
    arr.splice(idx, 1);
    setOpcoes({ ...opcoes, [key]: arr });
  };

  const renameItem = (key: OpcKey, idx: number, newValue: string) => {
    const v = newValue.trim().toUpperCase();
    const oldValue = opcoes[key][idx];
    setEditing(null);
    if (!v || v === oldValue) return;
    if (opcoes[key].includes(v)) return;
    const arr = [...opcoes[key]];
    arr[idx] = v;
    setOpcoes({ ...opcoes, [key]: arr });
    // Propaga renomeação para registros locais + DB (via useStorage.save)
    const field = key === "nomes" ? "nome" : KEY_TO_FIELD[key];
    if (field) {
      setRegistros(registros.map(r => r[field] === oldValue ? { ...r, [field]: v } : r));
    }
    logAudit("UPDATE", key === "nomes" ? "terceiros" : "opcoes", undefined, {
      chave: key, valorAnterior: oldValue, valorNovo: v,
    });
  };

  const importItems = async (key: OpcKey) => {
    const novos = [...new Set(
      nomesBulk.split("\n").map(n => n.trim().toUpperCase()).filter(n => n.length > 0)
    )].filter(n => !opcoes[key].includes(n));

    if (novos.length === 0) {
      setBulkFeedback(t("cfg_import_none"));
      return;
    }

    setBulkFeedback(t("cfg_import_saving"));

    const CHUNK = 100;
    const table = key === "nomes" ? "terceiros" : "opcoes";
    for (let i = 0; i < novos.length; i += CHUNK) {
      const batch = novos.slice(i, i + CHUNK);
      const payload = key === "nomes"
        ? batch.map(nome => ({ nome }))
        : batch.map(valor => ({ chave: key, valor }));
      const conflict = key === "nomes" ? "nome" : "chave,valor";
      const { error } = await supabase.from(table)
        .upsert(payload, { onConflict: conflict, ignoreDuplicates: true });
      if (error) {
        setBulkFeedback(`${t("cfg_import_error")} ${error.message}`);
        return;
      }
    }

    setOpcoes({ ...opcoes, [key]: [...opcoes[key], ...novos] });
    const s = novos.length > 1 ? "s" : "";
    const successMsg = t("cfg_import_success").replace("{n}", String(novos.length)).replace(/\{s\}/g, s);
    setNomesBulk("");
    setBulkFeedback(successMsg);
    setTimeout(() => setBulkFeedback(""), 4000);
  };

  const nomesFiltrados = opcoes.nomes.filter(n => n.toLowerCase().includes(nomeBusca.toLowerCase()));

  const inStyle: CSSProperties = { border:"1.5px solid #E2E6EC", borderRadius:7, padding:"6px 10px", fontSize:12, fontFamily:"inherit", outline:"none", background:"#FAFBFC", flex:1 };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div>
        <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>{t("cfg_section")}</div>
        <div style={{ fontSize:20, fontWeight:800, color:"#0F1C2E" }}>{t("cfg_title")}</div>
        <div style={{ fontSize:12, color:"#64748B", marginTop:4 }}>{t("cfg_desc")}</div>
      </div>

      {/* Grade de listas de opções — CRUD completo */}
      <div className="rsp-grid-autofill" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
        {OPCOES_CONFIG.map(({ key, cor }) => {
          const items = opcoes[key];
          const search = cardSearch[key];
          const filtered = search ? items.filter(v => v.toLowerCase().includes(search.toLowerCase())) : items;
          return (
          <div key={key} style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:18, display:"flex", flexDirection:"column", gap:10 }}>
            {/* Header */}
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:cor, flexShrink:0 }} />
              <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E" }}>{t(("cfg_opt_" + key) as Parameters<typeof t>[0])}</div>
              <div style={{ marginLeft:"auto", fontSize:11, background:cor + "18", color:cor, fontWeight:700, borderRadius:99, padding:"2px 8px" }}>{items.length}</div>
            </div>

            {/* Busca (se >3 itens) */}
            {items.length > 3 && (
              <input value={search} onChange={e => setCardSearch(p => ({ ...p, [key]: e.target.value }))}
                placeholder={t("cfg_opt_search")}
                style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"5px 10px", fontSize:11, fontFamily:"inherit", outline:"none", background:"#FAFBFC" }} />
            )}

            {/* Lista de itens com edição inline */}
            <div style={{ display:"flex", flexDirection:"column", gap:3, maxHeight:200, overflowY:"auto" }}>
              {items.length === 0 && <div style={{ color:"#CBD5E1", fontSize:11, textAlign:"center", padding:"10px 0" }}>{t("cfg_opt_empty")}</div>}
              {filtered.map((item) => {
                const realIdx = items.indexOf(item);
                const isEditing = editing?.key === key && editing?.idx === realIdx;
                return (
                <div key={realIdx} style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 8px", background:"#F8FAFC", borderRadius:6, fontSize:12 }}>
                  {isEditing ? (
                    <input autoFocus value={editing.value}
                      onChange={e => setEditing({ ...editing, value: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === "Enter") renameItem(key, realIdx, editing.value);
                        if (e.key === "Escape") setEditing(null);
                      }}
                      onBlur={() => renameItem(key, realIdx, editing.value)}
                      style={{ ...inStyle, flex:1, padding:"3px 6px", fontSize:12 }} />
                  ) : (
                    <span style={{ color:"#334155", fontWeight:500, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item}</span>
                  )}
                  {!isEditing && (
                    <div style={{ display:"flex", gap:2, flexShrink:0 }}>
                      <button onClick={() => setEditing({ key, idx: realIdx, value: item })}
                        style={{ background:"none", border:"none", cursor:"pointer", color:"#94A3B8", padding:2, display:"flex", lineHeight:1 }}
                        title="Editar">
                        <Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={12} />
                      </button>
                      <button onClick={() => removeItem(key, realIdx)}
                        style={{ background:"none", border:"none", cursor:"pointer", color:"#CBD5E1", padding:2, display:"flex", lineHeight:1 }}>
                        <Icon d="M18 6L6 18M6 6l12 12" size={12} />
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>

            {/* Adicionar item */}
            <div style={{ display:"flex", gap:6 }}>
              <input value={inputs[key]} onChange={e => setInputs(p => ({ ...p, [key]: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addItem(key, inputs[key])}
                placeholder={t("cfg_opt_placeholder")} style={inStyle} />
              <button onClick={() => addItem(key, inputs[key])}
                style={{ background:cor, border:"none", borderRadius:7, padding:"6px 14px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>+</button>
            </div>
          </div>
          );
        })}
      </div>

      {/* Base de Nomes */}
      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#334155", flexShrink:0 }} />
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E" }}>{t("cfg_nomes_title")}</div>
          <div style={{ fontSize:11, background:"#33415518", color:"#334155", fontWeight:700, borderRadius:99, padding:"2px 8px" }}>{opcoes.nomes.length} nomes</div>
          <div style={{ fontSize:12, color:"#94A3B8", marginLeft:4 }}>{t("cfg_nomes_desc")}</div>
        </div>

        <div className="rsp-grid-2" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          {/* Lista de nomes */}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.7 }}>{t("cfg_nomes_list_label")}</div>
            <input value={nomeBusca} onChange={e => setNomeBusca(e.target.value)} placeholder={t("cfg_nomes_search")}
              style={{ ...inStyle, flex:"none" }} />
            <div style={{ border:"1px solid #E2E6EC", borderRadius:8, maxHeight:260, overflowY:"auto" }}>
              {nomesFiltrados.length === 0 && (
                <div style={{ color:"#94A3B8", fontSize:12, textAlign:"center", padding:24 }}>
                  {opcoes.nomes.length === 0 ? t("cfg_nomes_none") : t("cfg_nomes_no_result")}
                </div>
              )}
              {nomesFiltrados.map((nome, idx) => {
                const realIdx = opcoes.nomes.indexOf(nome);
                const isEditing = editing?.key === "nomes" && editing?.idx === realIdx;
                return (
                  <div key={idx} style={{ display:"flex", alignItems:"center", gap:4, padding:"8px 12px", borderBottom: idx < nomesFiltrados.length - 1 ? "1px solid #F1F5F9" : "none", fontSize:12 }}>
                    {isEditing ? (
                      <input autoFocus value={editing.value}
                        onChange={e => setEditing({ ...editing, value: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === "Enter") renameItem("nomes", realIdx, editing.value);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        onBlur={() => renameItem("nomes", realIdx, editing.value)}
                        style={{ ...inStyle, flex:1, padding:"3px 6px", fontSize:12 }} />
                    ) : (
                      <span style={{ color:"#334155", fontWeight:500, flex:1 }}>{nome}</span>
                    )}
                    {!isEditing && (
                      <div style={{ display:"flex", gap:2, flexShrink:0 }}>
                        <button onClick={() => setEditing({ key: "nomes", idx: realIdx, value: nome })}
                          style={{ background:"none", border:"none", cursor:"pointer", color:"#94A3B8", padding:2, display:"flex" }}
                          title="Editar">
                          <Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={12} />
                        </button>
                        <button onClick={() => removeItem("nomes", realIdx)}
                          style={{ background:"none", border:"none", cursor:"pointer", color:"#CBD5E1", padding:2, display:"flex" }}>
                          <Icon d="M18 6L6 18M6 6l12 12" size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <input value={inputs.nomes} onChange={e => setInputs(p => ({ ...p, nomes: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addItem("nomes", inputs.nomes)}
                placeholder={t("cfg_nomes_add_ph")} style={inStyle} />
              <button onClick={() => addItem("nomes", inputs.nomes)}
                style={{ background:"#334155", border:"none", borderRadius:7, padding:"6px 14px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>+</button>
            </div>
          </div>

          {/* Importação em massa — unificada com seletor de categoria */}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.7 }}>{t("cfg_import_label")}</div>
            <select value={bulkCategory} onChange={e => { setBulkCategory(e.target.value as OpcKey); setNomesBulk(""); setBulkFeedback(""); }}
              style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"7px 10px", fontSize:12, fontFamily:"inherit", background:"#FAFBFC", outline:"none", cursor:"pointer" }}>
              <option value="nomes">{t("cfg_nomes_title")}</option>
              {OPCOES_CONFIG.map(({ key }) => (
                <option key={key} value={key}>{t(("cfg_opt_" + key) as Parameters<typeof t>[0])}</option>
              ))}
            </select>
            <textarea value={nomesBulk} onChange={e => setNomesBulk(e.target.value)}
              placeholder={t("cfg_import_ph")}
              style={{ border:"1.5px solid #E2E6EC", borderRadius:8, padding:"9px 11px", fontSize:12, fontFamily:"inherit", background:"#FAFBFC", width:"100%", outline:"none", resize:"vertical", minHeight:220, lineHeight:1.8 }} />
            <button onClick={() => importItems(bulkCategory)}
              style={{ background:"#1A56DB", border:"none", borderRadius:8, padding:"10px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>
              {t("cfg_import_btn")}
            </button>
            {bulkFeedback && (
              <div style={{ fontSize:12, color:"#0E9F6E", fontWeight:600, background:"#E6F9F4", borderRadius:7, padding:"7px 12px" }}>
                {bulkFeedback}
              </div>
            )}
            <div style={{ fontSize:11, color:"#94A3B8" }}>{t("cfg_import_hint")}</div>
          </div>
        </div>
      </div>

      {/* ── Horas Padrão por Turno ── */}
      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#0891B2", flexShrink:0 }} />
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E" }}>{t("cfg_turnos_horas_title")}</div>
        </div>
        <div style={{ fontSize:12, color:"#64748B", marginBottom:14, paddingLeft:20 }}>{t("cfg_turnos_horas_desc")}</div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ background:"#F8FAFC", borderBottom:"1px solid #E2E6EC" }}>
                <th style={{ textAlign:"left", padding:"8px 10px", fontWeight:700, color:"#475569" }}>{t("cfg_turnos_turno")}</th>
                <th style={{ textAlign:"center", padding:"8px 10px", fontWeight:700, color:"#475569" }}>{t("cfg_turnos_inicio")}</th>
                <th style={{ textAlign:"center", padding:"8px 10px", fontWeight:700, color:"#475569" }}>{t("cfg_turnos_fim")}</th>
                <th style={{ textAlign:"center", padding:"8px 10px", fontWeight:700, color:"#475569" }}>{t("cfg_turnos_padrao")}</th>
              </tr>
            </thead>
            <tbody>
              {turnosConfig.map((tc, idx) => (
                <tr key={tc.turno} style={{ borderBottom:"1px solid #F1F5F9" }}>
                  <td style={{ padding:"6px 10px", fontWeight:600, color:"#0F1C2E" }}>{tc.turno}</td>
                  <td style={{ textAlign:"center", padding:"6px 10px" }}>
                    <input type="time" value={tc.horaInicio} onChange={e => { const v = [...turnosConfig]; v[idx] = { ...tc, horaInicio: e.target.value }; setTurnosConfig(v); }}
                      style={{ border:"1.5px solid #E2E6EC", borderRadius:6, padding:"4px 8px", fontSize:12, fontFamily:"'DM Mono',monospace", textAlign:"center", background:"#FAFBFC" }} />
                  </td>
                  <td style={{ textAlign:"center", padding:"6px 10px" }}>
                    <input type="time" value={tc.horaFim} onChange={e => { const v = [...turnosConfig]; v[idx] = { ...tc, horaFim: e.target.value }; setTurnosConfig(v); }}
                      style={{ border:"1.5px solid #E2E6EC", borderRadius:6, padding:"4px 8px", fontSize:12, fontFamily:"'DM Mono',monospace", textAlign:"center", background:"#FAFBFC" }} />
                  </td>
                  <td style={{ textAlign:"center", padding:"6px 10px" }}>
                    <input type="time" value={tc.horaPadrao} onChange={e => { const v = [...turnosConfig]; v[idx] = { ...tc, horaPadrao: e.target.value }; setTurnosConfig(v); }}
                      style={{ border:"1.5px solid #E2E6EC", borderRadius:6, padding:"4px 8px", fontSize:12, fontFamily:"'DM Mono',monospace", textAlign:"center", background:"#FAFBFC", fontWeight:700 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginTop:12 }}>
          <button onClick={saveTurnosConfig} style={{ background:"#0891B2", border:"none", borderRadius:8, padding:"9px 22px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>
            {t("cfg_turnos_salvar")}
          </button>
          {turnosConfigSaved && <span style={{ fontSize:12, color:"#0E9F6E", fontWeight:600 }}>{t("cfg_turnos_salvo")}</span>}
        </div>
      </div>

      {/* ── Valor das Diárias por Fornecedor + Turno ── */}
      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#D97706", flexShrink:0 }} />
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E" }}>{t("cfg_diarias_title")}</div>
        </div>
        <div style={{ fontSize:12, color:"#64748B", marginBottom:14, paddingLeft:20 }}>
          {t("cfg_diarias_desc")} <span style={{ color:"#94A3B8" }}>{t("cfg_diarias_padrao")}</span>
        </div>

        {/* Tabela existente */}
        {diariasConfig.length > 0 && (
          <div style={{ overflowX:"auto", marginBottom:14 }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ background:"#F8FAFC", borderBottom:"1px solid #E2E6EC" }}>
                  <th style={{ textAlign:"left", padding:"8px 10px", fontWeight:700, color:"#475569" }}>{t("cfg_diarias_forn")}</th>
                  <th style={{ textAlign:"left", padding:"8px 10px", fontWeight:700, color:"#475569" }}>{t("cfg_diarias_turno")}</th>
                  <th style={{ textAlign:"right", padding:"8px 10px", fontWeight:700, color:"#475569" }}>{t("cfg_diarias_valor")}</th>
                  <th style={{ width:40 }} />
                </tr>
              </thead>
              <tbody>
                {diariasConfig.map(d => (
                  <tr key={d.id} style={{ borderBottom:"1px solid #F1F5F9" }}>
                    <td style={{ padding:"6px 10px", fontWeight:600, color:"#0F1C2E" }}>{d.fornecedor}</td>
                    <td style={{ padding:"6px 10px", color:"#475569" }}>{d.turno ?? t("cfg_diarias_todos_turnos")}</td>
                    <td style={{ padding:"6px 10px", textAlign:"right", fontFamily:"'DM Mono',monospace", fontWeight:700, color:"#0E9F6E" }}>
                      R$ {d.valorDiaria.toFixed(2)}
                    </td>
                    <td style={{ padding:"6px 4px", textAlign:"center" }}>
                      <button onClick={() => removeDiaria(d)} title="Remover" style={{ background:"none", border:"none", cursor:"pointer", color:"#E02424", fontSize:14, lineHeight:1 }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Adicionar nova diária */}
        <div className="rsp-grid-4" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 100px auto", gap:8, alignItems:"end" }}>
          <div>
            <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, marginBottom:4 }}>{t("cfg_diarias_forn")}</div>
            <select value={newDiaria.fornecedor} onChange={e => setNewDiaria(p => ({ ...p, fornecedor: e.target.value }))}
              style={{ width:"100%", border:"1.5px solid #E2E6EC", borderRadius:7, padding:"8px 10px", fontSize:13, fontFamily:"inherit", background:"#FAFBFC" }}>
              <option value="">{t("fech_selecione_forn")}</option>
              {opcoes.fornecedores.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, marginBottom:4 }}>{t("cfg_diarias_turno")}</div>
            <select value={newDiaria.turno} onChange={e => setNewDiaria(p => ({ ...p, turno: e.target.value }))}
              style={{ width:"100%", border:"1.5px solid #E2E6EC", borderRadius:7, padding:"8px 10px", fontSize:13, fontFamily:"inherit", background:"#FAFBFC" }}>
              <option value="">{t("cfg_diarias_todos_turnos")}</option>
              {opcoes.turnos.map(t_ => <option key={t_} value={t_}>{t_}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, marginBottom:4 }}>{t("cfg_diarias_valor")}</div>
            <input type="number" min="0" step="0.01" value={newDiaria.valor}
              onChange={e => setNewDiaria(p => ({ ...p, valor: e.target.value }))}
              style={{ width:"100%", border:"1.5px solid #E2E6EC", borderRadius:7, padding:"8px 10px", fontSize:13, fontFamily:"'DM Mono',monospace", background:"#FAFBFC" }} />
          </div>
          <button onClick={addDiaria} style={{ background:"#D97706", border:"none", borderRadius:8, padding:"9px 18px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit", alignSelf:"end" }}>
            {t("cfg_diarias_add")}
          </button>
        </div>
      </div>

      {/* ── LGPD: DPO (Art. 41) — somente admin ── */}
      {isAdmin && (
      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#6C63FF", flexShrink:0 }} />
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E" }}>{t("dpo_title")}</div>
          <div style={{ fontSize:11, background:"#6C63FF18", color:"#6C63FF", fontWeight:700, borderRadius:99, padding:"2px 8px" }}>{t("dpo_badge")}</div>
        </div>
        <div className="rsp-grid-3" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:14 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.7 }}>{t("dpo_label_nome")}</label>
            <input value={dpoNome} onChange={e => setDpoNome(e.target.value)} placeholder={t("dpo_ph_nome")}
              style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"7px 10px", fontSize:12, fontFamily:"inherit", background:"#FAFBFC", outline:"none" }} />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.7 }}>{t("dpo_label_email")}</label>
            <input type="email" value={dpoEmail} onChange={e => setDpoEmail(e.target.value)} placeholder={t("dpo_ph_email")}
              style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"7px 10px", fontSize:12, fontFamily:"inherit", background:"#FAFBFC", outline:"none" }} />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.7 }}>{t("dpo_label_tel")}</label>
            <input value={dpoTelefone} onChange={e => setDpoTelefone(e.target.value)} placeholder={t("dpo_ph_tel")}
              style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"7px 10px", fontSize:12, fontFamily:"inherit", background:"#FAFBFC", outline:"none" }} />
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={saveDpo} style={{ background:"#6C63FF", border:"none", borderRadius:8, padding:"9px 22px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>
            {t("dpo_btn_save")}
          </button>
          {dpoSaved && <span style={{ fontSize:12, color:"#0E9F6E", fontWeight:600 }}>{t("dpo_saved")}</span>}
        </div>
        <div style={{ fontSize:11, color:"#94A3B8", marginTop:10 }}>
          {t("dpo_desc")}
        </div>
      </div>
      )}

      {/* ── LGPD: Exclusão por Solicitação (Art. 18) — somente admin ── */}
      {isAdmin && (
      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#E02424", flexShrink:0 }} />
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E" }}>{t("lgpd_title")}</div>
          <div style={{ fontSize:11, background:"#E0242418", color:"#E02424", fontWeight:700, borderRadius:99, padding:"2px 8px" }}>{t("lgpd_badge")}</div>
        </div>
        <div style={{ fontSize:12, color:"#64748B", marginBottom:14 }}>
          {t("lgpd_desc")}
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          <input value={titularNome} onChange={e => setTitularNome(e.target.value)}
            onKeyDown={e => e.key === "Enter" && buscarTitular()}
            placeholder={t("lgpd_placeholder")}
            style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"8px 12px", fontSize:13, fontFamily:"inherit", background:"#FAFBFC", outline:"none", flex:1, textTransform:"uppercase" }} />
          <button onClick={buscarTitular} style={{ background:"#334155", border:"none", borderRadius:8, padding:"8px 20px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit", flexShrink:0 }}>
            {t("lgpd_search_btn")}
          </button>
        </div>

        {titularResult !== null && (
          <div style={{ border:"1px solid #E2E6EC", borderRadius:10, overflow:"hidden", marginBottom:12 }}>
            <div style={{ background:"#F8FAFC", padding:"10px 16px", fontSize:12, color:"#64748B", borderBottom:"1px solid #E2E6EC", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>{t("lgpd_result_for")} <strong style={{ color:"#0F1C2E" }}>{titularNome.trim().toUpperCase()}</strong></span>
              <span style={{ fontWeight:700, color: titularResult.length > 0 ? "#E02424" : "#0E9F6E" }}>
                {t("lgpd_found").replace("{n}", String(titularResult.length)).replace(/\{s\}/g, titularResult.length !== 1 ? "s" : "")}
              </span>
            </div>
            {titularResult.length === 0 ? (
              <div style={{ padding:"20px 16px", fontSize:12, color:"#94A3B8", textAlign:"center" }}>{t("lgpd_not_found")}</div>
            ) : (
              <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:160, overflowY:"auto" }}>
                  {titularResult.slice(0, 5).map(r => (
                    <div key={r.id} style={{ display:"flex", gap:10, fontSize:11, color:"#475569", background:"#FFF5F5", borderRadius:6, padding:"5px 10px" }}>
                      <span style={{ color:"#94A3B8", fontFamily:"monospace" }}>{fmt(r.data, lang)}</span>
                      <span>{r.turno}</span>
                      <span>{r.fornecedor}</span>
                      <span style={{ color:"#64748B" }}>{r.horaEntrada}–{r.horaSaida}</span>
                    </div>
                  ))}
                  {titularResult.length > 5 && <div style={{ fontSize:11, color:"#94A3B8", textAlign:"center" }}>{t("lgpd_hidden").replace("{n}", String(titularResult.length - 5)).replace(/\{s\}/g, titularResult.length - 5 > 1 ? "s" : "")}</div>}
                </div>
                {!exclusaoConfirm ? (
                  <button onClick={() => setExclusaoConfirm(true)}
                    style={{ background:"#FEF2F2", border:"1.5px solid #FECACA", borderRadius:8, padding:"9px 18px", cursor:"pointer", color:"#E02424", fontWeight:700, fontSize:13, fontFamily:"inherit", alignSelf:"flex-start" }}>
                    {t("lgpd_request_btn").replace("{n}", String(titularResult.length)).replace(/\{s\}/g, titularResult.length !== 1 ? "s" : "")}
                  </button>
                ) : (
                  <div style={{ background:"#FFF5F5", border:"1.5px solid #FECACA", borderRadius:10, padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#E02424" }}>{t("lgpd_confirm_title")}</div>
                    <div style={{ fontSize:12, color:"#475569" }}>
                      {t("lgpd_confirm_text")
                        .replace("{n}", String(titularResult.length))
                        .replace(/\{s\}/g, titularResult.length !== 1 ? "s" : "")
                        .replace("{name}", titularNome.trim().toUpperCase())}
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={excluirTitular} style={{ background:"#E02424", border:"none", borderRadius:8, padding:"9px 18px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>
                        {t("lgpd_confirm_btn")}
                      </button>
                      <button onClick={() => setExclusaoConfirm(false)} style={{ background:"#F1F5F9", border:"none", borderRadius:8, padding:"9px 18px", cursor:"pointer", color:"#475569", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>
                        {t("lgpd_cancel_btn")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {exclusaoFeedback && (
          <div style={{ fontSize:12, color:"#0E9F6E", fontWeight:600, background:"#E6F9F4", borderRadius:7, padding:"9px 14px" }}>
            {exclusaoFeedback}
          </div>
        )}
      </div>
      )}
    </div>
  );
};

// ─── TELA: FECHAMENTO ────────────────────────────────────────────
const STATUS_LABEL_KEY: Record<FechamentoStatus, string> = {
  rascunho: "fech_status_rascunho",
  enviado:  "fech_status_enviado",
  revisao:  "fech_status_revisao",
  aprovado: "fech_status_aprovado",
};

const FechamentoTab = ({ registros, opcoes }: { registros: Registro[]; opcoes: Opcoes }) => {
  const { t, lang } = useI18n();

  // ── Filtros ──
  const [mes, setMes] = useState(mesAtual());
  const [periodoIdx, setPeriodoIdx] = useState(0); // 0,1,2 = padrão; 3 = custom
  const [customInicio, setCustomInicio] = useState("");
  const [customFim, setCustomFim] = useState("");
  const [fornecedor, setFornecedor] = useState("");

  // ── Dados calculados ──
  const [itens, setItens] = useState<FechamentoItem[]>([]);
  const [resumoPessoas, setResumoPessoas] = useState<ResumoPessoa[]>([]);
  const [total, setTotal] = useState(0);
  const [calculado, setCalculado] = useState(false);

  // ── Fechamento salvo ──
  const [fechamento, setFechamento] = useState<Fechamento | null>(null);
  const [historico, setHistorico] = useState<Fechamento[]>([]);
  const [feedback, setFeedback] = useState("");

  // ── Configs (carregar do DB) ──
  const [turnosConfig, setTurnosConfig] = useState<TurnoConfig[]>([]);
  const [diariasConfig, setDiariasConfig] = useState<DiariaConfig[]>([]);

  // ── Edição inline ──
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editValor, setEditValor] = useState("");
  const [editObs, setEditObs] = useState("");

  // Carregar configs + histórico
  useEffect(() => {
    authReady.then(async () => {
      const { data: tData } = await supabase.from("turnos_config").select("*").order("turno");
      if (tData) setTurnosConfig(tData.map(dbToTurnoConfig));
      const { data: dData } = await supabase.from("diarias_config").select("*").order("fornecedor");
      if (dData) setDiariasConfig(dData.map(dbToDiariaConfig));
      const { data: hData } = await supabase.from("fechamentos").select("*").order("created_at", { ascending: false }).limit(50);
      if (hData) setHistorico(hData.map(dbToFechamento));
    });
  }, []);

  // Períodos do mês selecionado
  const periodos = useMemo(() => periodosPadrao(mes), [mes]);

  // Intervalo de datas ativo
  const intervalo = useMemo(() => {
    if (periodoIdx === 3) return { inicio: customInicio, fim: customFim };
    const p = periodos[periodoIdx];
    return p ? { inicio: p.inicio, fim: p.fim } : { inicio: "", fim: "" };
  }, [periodoIdx, periodos, customInicio, customFim]);

  // ── Calcular fechamento ──
  const calcular = useCallback(() => {
    if (!fornecedor || !intervalo.inicio || !intervalo.fim) return;
    const regs = registros.filter(r =>
      r.fornecedor === fornecedor &&
      r.data >= intervalo.inicio &&
      r.data <= intervalo.fim
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
    setCalculado(true);
    setFechamento(null);
    setEditIdx(null);
    setFeedback("");
  }, [fornecedor, intervalo, registros, diariasConfig, turnosConfig]);

  // ── Aplicar edição inline ──
  const aplicarEdicao = (idx: number) => {
    const val = parseFloat(editValor);
    if (isNaN(val)) return;
    setItens(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], valorCalculado: val, ajusteManual: true, obs: editObs };
      const newTotal = calcularTotal(next);
      setTotal(newTotal);
      setResumoPessoas(agruparPorPessoa(next));
      return next;
    });
    setEditIdx(null);
  };

  // ── Salvar ──
  const salvar = async () => {
    if (!fornecedor || itens.length === 0) return;
    const fech: Fechamento = fechamento ?? {
      fornecedor,
      dataInicio: intervalo.inicio,
      dataFim: intervalo.fim,
      status: "rascunho",
      valorTotal: total,
    };
    fech.valorTotal = total;
    const dbFech = fechamentoToDb(fech);
    const { data: savedFech, error } = fech.id
      ? await supabase.from("fechamentos").update(dbFech).eq("id", fech.id).select().single()
      : await supabase.from("fechamentos").insert(dbFech).select().single();
    if (error || !savedFech) {
      setFeedback(t("fech_erro_salvar"));
      return;
    }
    const fechId = savedFech.id as string;
    // Deletar itens antigos e inserir novos
    await supabase.from("fechamento_itens").delete().eq("fechamento_id", fechId);
    const dbItens = itens.map(i => fechamentoItemToDb(i, fechId));
    await supabase.from("fechamento_itens").insert(dbItens);
    const savedObj = dbToFechamento(savedFech);
    setFechamento(savedObj);
    logAudit(fech.id ? "UPDATE" : "INSERT", "fechamentos", fechId, { fornecedor, total });
    // Atualizar histórico
    setHistorico(prev => {
      const filtered = prev.filter(h => h.id !== fechId);
      return [savedObj, ...filtered];
    });
    setFeedback(t("fech_salvo_sucesso"));
    setTimeout(() => setFeedback(""), 3000);
  };

  // ── Avançar status ──
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

  // ── Abrir fechamento salvo ──
  const abrirFechamento = async (f: Fechamento) => {
    if (!f.id) return;
    setFornecedor(f.fornecedor);
    // Ajustar mes e período
    setMes(f.dataInicio.slice(0, 7));
    setPeriodoIdx(3);
    setCustomInicio(f.dataInicio);
    setCustomFim(f.dataFim);
    // Carregar itens
    const { data } = await supabase.from("fechamento_itens").select("*").eq("fechamento_id", f.id).order("nome").order("data");
    if (data) {
      const items = data.map(dbToFechamentoItem);
      setItens(items);
      setResumoPessoas(agruparPorPessoa(items));
      setTotal(calcularTotal(items));
    }
    setFechamento(f);
    setCalculado(true);
    setEditIdx(null);
    setFeedback("");
  };

  // ── Excluir fechamento ──
  const excluirFechamento = async (f: Fechamento) => {
    if (!f.id || !confirm(t("fech_confirmar_excluir"))) return;
    await supabase.from("fechamento_itens").delete().eq("fechamento_id", f.id);
    await supabase.from("fechamentos").delete().eq("id", f.id);
    logAudit("DELETE", "fechamentos", f.id);
    setHistorico(prev => prev.filter(h => h.id !== f.id));
    if (fechamento?.id === f.id) {
      setFechamento(null);
      setItens([]);
      setCalculado(false);
    }
  };

  // ── Exportar XLSX ──
  const exportarXlsx = async () => {
    const XLSX = await import("xlsx");
    const rows = itens.map(i => ({
      [t("fech_col_nome")]: i.nome,
      [t("fech_col_data")]: i.data,
      [t("fech_col_turno")]: i.turno,
      [t("fech_col_horas")]: i.horas,
      [t("fech_col_diaria")]: i.valorDiaria,
      [t("fech_col_vlr_hora")]: i.valorHora,
      [t("fech_col_vlr_dia")]: i.valorCalculado,
      [t("fech_col_obs")]: i.obs,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fechamento");
    XLSX.writeFile(wb, `fechamento_${fornecedor}_${intervalo.inicio}_${intervalo.fim}.xlsx`);
  };

  const fmtCurrency = (v: number) => v.toLocaleString(lang, { style: "currency", currency: "BRL" });

  const periodoBtns = [
    { label: t("fech_periodo_1"), idx: 0 },
    { label: t("fech_periodo_2"), idx: 1 },
    { label: t("fech_periodo_3"), idx: 2 },
    { label: t("fech_periodo_custom"), idx: 3 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div>
        <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{t("fech_section")}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#0F1C2E" }}>{t("fech_title")}</div>
        <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{t("fech_desc")}</div>
      </div>

      {/* ── Barra de Filtros ── */}
      <div style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, padding: 16, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        {/* Mês */}
        <div>
          <label style={{ fontSize: 11, color: "#64748B", fontWeight: 600, display: "block", marginBottom: 4 }}>{t("fech_mes")}</label>
          <input type="month" value={mes} onChange={e => { setMes(e.target.value); setCalculado(false); }}
            style={{ border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC", outline: "none" }} />
        </div>
        {/* Período */}
        <div>
          <label style={{ fontSize: 11, color: "#64748B", fontWeight: 600, display: "block", marginBottom: 4 }}>{t("fech_periodo")}</label>
          <div style={{ display: "flex", gap: 4 }}>
            {periodoBtns.map(pb => (
              <button key={pb.idx} onClick={() => { setPeriodoIdx(pb.idx); setCalculado(false); }}
                style={{
                  padding: "6px 12px", borderRadius: 7, border: "1.5px solid", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  background: periodoIdx === pb.idx ? "#1A56DB" : "#fff",
                  color: periodoIdx === pb.idx ? "#fff" : "#64748B",
                  borderColor: periodoIdx === pb.idx ? "#1A56DB" : "#E2E6EC",
                }}>
                {pb.label}
              </button>
            ))}
          </div>
        </div>
        {/* Range custom */}
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
        {/* Fornecedor */}
        <div>
          <label style={{ fontSize: 11, color: "#64748B", fontWeight: 600, display: "block", marginBottom: 4 }}>{t("fech_fornecedor")}</label>
          <select value={fornecedor} onChange={e => { setFornecedor(e.target.value); setCalculado(false); }}
            style={{ border: "1.5px solid #E2E6EC", borderRadius: 7, padding: "7px 10px", fontSize: 13, fontFamily: "inherit", background: "#FAFBFC", outline: "none", minWidth: 180 }}>
            <option value="">{t("fech_selecione_forn")}</option>
            {opcoes.fornecedores.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        {/* Botão calcular */}
        <button onClick={calcular} disabled={!fornecedor || !intervalo.inicio || !intervalo.fim}
          style={{
            background: "#1A56DB", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer",
            color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit", opacity: !fornecedor ? 0.5 : 1,
          }}>
          {calculado ? t("fech_recalcular") : t("fech_calcular")}
        </button>
      </div>

      {/* ── Resumo ── */}
      {calculado && (
        <div style={{ background: "#fff", border: "1px solid #E2E6EC", borderRadius: 12, padding: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
            <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 20px", flex: 1, minWidth: 120, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: .6, marginBottom: 4 }}>{t("fech_presencas")}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#1A56DB" }}>{itens.length}</div>
            </div>
            <div style={{ background: "#F8FAFC", borderRadius: 10, padding: "12px 20px", flex: 1, minWidth: 120, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: .6, marginBottom: 4 }}>{t("fech_horas")}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#334155" }}>
                {decimalToHoras(itens.reduce((acc, i) => acc + horasToDecimal(i.horas), 0))}
              </div>
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
              {/* ── Resumo por pessoa ── */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0F1C2E", marginBottom: 8 }}>{t("fech_resumo_pessoa")}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {resumoPessoas.map(rp => (
                    <div key={rp.nome} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F8FAFC", borderRadius: 8, padding: "8px 14px", fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: "#0F1C2E", flex: 1 }}>{rp.nome}</span>
                      <span style={{ color: "#64748B", minWidth: 60, textAlign: "center" }}>{rp.dias} {t("fech_dias")}</span>
                      <span style={{ color: "#64748B", fontFamily: "monospace", minWidth: 60, textAlign: "center" }}>{decimalToHoras(rp.totalHoras)}</span>
                      <span style={{ fontWeight: 700, color: "#0E9F6E", minWidth: 100, textAlign: "right" }}>{fmtCurrency(rp.valorTotal)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Tabela detalhada ── */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#F1F5F9", textAlign: "left" }}>
                      {[t("fech_col_nome"), t("fech_col_data"), t("fech_col_turno"), t("fech_col_horas"), t("fech_col_diaria"), t("fech_col_vlr_hora"), t("fech_col_vlr_dia"), t("fech_col_obs"), t("fech_col_acoes")].map(h => (
                        <th key={h} style={{ padding: "8px 10px", fontWeight: 700, color: "#475569", borderBottom: "2px solid #E2E6EC", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: "1px solid #F1F5F9", background: item.ajusteManual ? "#FFFBEB" : "transparent" }}>
                        <td style={{ padding: "7px 10px", fontWeight: 600, color: "#0F1C2E", whiteSpace: "nowrap" }}>{item.nome}</td>
                        <td style={{ padding: "7px 10px", color: "#64748B", fontFamily: "monospace" }}>{fmt(item.data, lang)}</td>
                        <td style={{ padding: "7px 10px", color: "#64748B" }}>{item.turno}</td>
                        <td style={{ padding: "7px 10px", color: "#64748B", fontFamily: "monospace" }}>{item.horas}</td>
                        <td style={{ padding: "7px 10px", color: "#64748B" }}>{fmtCurrency(item.valorDiaria)}</td>
                        <td style={{ padding: "7px 10px", color: "#64748B" }}>{fmtCurrency(item.valorHora)}</td>
                        {editIdx === idx ? (
                          <>
                            <td style={{ padding: "4px 6px" }}>
                              <input type="number" step="0.01" value={editValor} onChange={e => setEditValor(e.target.value)}
                                style={{ width: 80, border: "1.5px solid #1A56DB", borderRadius: 5, padding: "4px 6px", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
                            </td>
                            <td style={{ padding: "4px 6px" }}>
                              <input value={editObs} onChange={e => setEditObs(e.target.value)} placeholder={t("fech_col_obs")}
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
                      <td colSpan={6} style={{ padding: "8px 10px", fontWeight: 800, color: "#0F1C2E", textAlign: "right" }}>{t("fech_total")}</td>
                      <td style={{ padding: "8px 10px", fontWeight: 800, color: "#0E9F6E" }}>{fmtCurrency(total)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* ── Barra de ações ── */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16, alignItems: "center" }}>
                <button onClick={salvar}
                  style={{ background: "#1A56DB", border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                  {t("fech_salvar")}
                </button>
                {fechamento && NEXT_STATUS[fechamento.status] && (
                  <button onClick={avancarStatus}
                    style={{ background: STATUS_COLORS[NEXT_STATUS[fechamento.status]!], border: "none", borderRadius: 8, padding: "8px 20px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                    {t("fech_avancar_status")}
                  </button>
                )}
                {fechamento?.status === "enviado" && (
                  <button onClick={voltarRevisao}
                    style={{ background: "#E02424", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                    {t("fech_voltar_revisao")}
                  </button>
                )}
                <button onClick={exportarXlsx}
                  style={{ background: "#0E9F6E", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "inherit" }}>
                  {t("fech_exportar_xlsx")}
                </button>
                {feedback && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: feedback === t("fech_salvo_sucesso") ? "#0E9F6E" : "#E02424", background: feedback === t("fech_salvo_sucesso") ? "#E6F9F4" : "#FEF2F2", borderRadius: 7, padding: "6px 14px" }}>
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
                  <button onClick={() => abrirFechamento(h)}
                    style={{ background: "#1A56DB18", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", color: "#1A56DB", fontWeight: 700, fontSize: 11, fontFamily: "inherit" }}>
                    {t("fech_abrir")}
                  </button>
                  <button onClick={() => excluirFechamento(h)}
                    style={{ background: "#FEF2F2", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", color: "#E02424", fontWeight: 700, fontSize: 11, fontFamily: "inherit" }}>
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

// ═══════════════════════════════════════════════════════════════
// INDEX
// ═══════════════════════════════════════════════════════════════
type TabId = "dashboard" | "lancamentos" | "fornecedores" | "fechamento" | "configuracoes";
interface NavItem { id: TabId; label: string; icon: string; }

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

  useEffect(() => {
    authReady.then(() => {
      supabase.from("opcoes").select("chave,valor")
        .in("chave", ["dpo_nome", "dpo_email"])
        .then(({ data }) => {
          if (!data) return;
          const m: Record<string, string> = {};
          data.forEach((r: { chave: string; valor: string }) => { m[r.chave] = r.valor; });
          setDpoCfg({ nome: m["dpo_nome"] ?? "", email: m["dpo_email"] ?? "" });
        });
      supabase.from("profiles").select("is_admin").maybeSingle()
        .then(({ data }) => { if (data?.is_admin) setIsAdmin(true); });
    });
  }, []);

  const wrap = (fn: (val: Registro[]) => void) => (val: Registro[]) => {
    fn(val); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const hoje_ = registros.filter(r => r.data === hoje()).length;
  const mes_  = registros.filter(r => r.data.startsWith(mesAtual())).length;

  const NAV: NavItem[] = [
    { id: "dashboard",      label: t("nav_tab_dashboard"), icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" },
    { id: "lancamentos",    label: t("nav_tab_lanc"),      icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" },
    { id: "fornecedores",   label: t("nav_tab_forn"),      icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
    { id: "fechamento",     label: t("nav_tab_fech"),      icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
    { id: "configuracoes",  label: t("nav_tab_cfg"),       icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.94 11a8 8 0 0 0-15.88 0H2v2h2.06a8 8 0 0 0 15.88 0H22v-2h-2.06z" },
  ];

  return (
    <>
      {!privacyAccepted && (
        <PrivacyNotice dpoNome={dpoCfg.nome} dpoEmail={dpoCfg.email} onAccept={acceptPrivacy} />
      )}
    <div style={{ minHeight:"100vh", background:"#F0F2F5", fontFamily:"'DM Sans',system-ui,sans-serif", display:"flex", flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
      `}</style>

      <header className="rsp-header" style={{ background:"#0B1628", borderBottom:"1px solid #1E293B", height:58, display:"flex", alignItems:"center", padding:"0 24px", gap:0, position:"sticky", top:0, zIndex:200 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, paddingRight:28, borderRight:"1px solid #1E293B", marginRight:20 }}>
          <div style={{ width:34, height:34, background:"linear-gradient(135deg,#1A56DB,#3B82F6)", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Icon d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" size={18} />
          </div>
          <div>
            <div style={{ color:"#F8FAFC", fontWeight:800, fontSize:14, letterSpacing:-.4, lineHeight:1.1 }}>Controle de</div>
            <div style={{ color:"#3B82F6", fontWeight:800, fontSize:14, letterSpacing:-.4, lineHeight:1.1 }}>Terceiros</div>
          </div>
        </div>

        <nav style={{ display:"flex", gap:2, flex:1 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} style={{
              display:"flex", alignItems:"center", gap:7, padding:"7px 15px", borderRadius:8, border:"none", cursor:"pointer",
              fontFamily:"inherit", fontWeight:600, fontSize:13,
              background: tab === n.id ? "#1A56DB" : "transparent",
              color: tab === n.id ? "#fff" : "#64748B",
            }}>
              <Icon d={n.icon} size={15} /><span className="rsp-nav-label">{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="rsp-header-right" style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div className="rsp-header-stats" style={{ display:"flex", gap:12, fontSize:11 }}>
            <div style={{ color:"#64748B" }}>{t("nav_hoje")} <strong style={{ color:"#F8FAFC" }}>{hoje_}</strong></div>
            <div style={{ color:"#64748B" }}>{t("nav_mes")} <strong style={{ color:"#F8FAFC" }}>{mes_}</strong></div>
          </div>
          {loading && (
            <div style={{ display:"flex", alignItems:"center", gap:6, background:"#1A56DB18", border:"1px solid #1A56DB33", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#1A56DB", fontWeight:600 }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              {t("nav_loading")}
            </div>
          )}
          {saved && !loading && (
            <div style={{ display:"flex", alignItems:"center", gap:5, background:"#0E9F6E22", border:"1px solid #0E9F6E44", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#0E9F6E", fontWeight:600 }}>
              <Icon d="M5 13l4 4L19 7" size={12} /> {t("nav_saved")}
            </div>
          )}
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#475569", fontFamily:"'DM Mono',monospace" }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:"#0E9F6E", boxShadow:"0 0 0 3px #0E9F6E30" }} />
            {new Date().toLocaleTimeString(lang, { hour:"2-digit", minute:"2-digit" })}
          </div>
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              title="Painel de administração"
              style={{ display:"flex", alignItems:"center", gap:5, background:"#1A56DB18", border:"1px solid #1A56DB44", borderRadius:8, padding:"4px 10px", cursor:"pointer", color:"#1A56DB", fontSize:11, fontFamily:"inherit", fontWeight:600 }}
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              {t("nav_admin")}
            </button>
          )}
          <button
            onClick={() => supabase.auth.signOut()}
            title="Sair do sistema"
            style={{ display:"flex", alignItems:"center", gap:5, background:"transparent", border:"1px solid #1E293B", borderRadius:8, padding:"4px 10px", cursor:"pointer", color:"#64748B", fontSize:11, fontFamily:"inherit", fontWeight:600 }}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            {t("nav_logout")}
          </button>        </div>
      </header>

      <main className="rsp-main" style={{ flex:1, padding:"24px", maxWidth:1440, width:"100%", margin:"0 auto" }}>
        {loading ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh", gap:16 }}>
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#1A56DB" strokeWidth={2} style={{ animation:"spin 1s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            <div style={{ fontSize:14, color:"#64748B", fontWeight:600 }}>{t("nav_loading_data")}</div>
            <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
          </div>
        ) : (
          <>
            {tab === "dashboard"     && <Dashboard    registros={registros} opcoes={opcoes} />}
            {tab === "lancamentos"   && <Lancamentos  registros={registros} setRegistros={wrap(setRegistros)} opcoes={opcoes} />}
            {tab === "fornecedores"  && <Fornecedores registros={registros} opcoes={opcoes} />}
            {tab === "fechamento"    && <FechamentoTab registros={registros} opcoes={opcoes} />}
            {tab === "configuracoes" && <Configuracoes opcoes={opcoes} setOpcoes={setOpcoes} registros={registros} setRegistros={setRegistros} isAdmin={isAdmin} />}
          </>
        )}
      </main>
    </div>
    </>
  );
};

export default Index;
