import { useState, useMemo, useCallback, useRef, useEffect, ReactNode, InputHTMLAttributes, SelectHTMLAttributes, CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Registro } from "@/types/attendance";
import { supabase, authReady } from "@/lib/supabase";

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

// ─── UTILITÁRIOS ─────────────────────────────────────────────────
const hoje     = () => new Date().toISOString().slice(0, 10);
const fmt      = (d: string) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
const fmtMes   = (ym: string) => { const [y, m] = ym.split("-"); return ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][+m-1] + "/" + y; };
const mesAtual = () => new Date().toISOString().slice(0, 7);
const calcHoras = (e: string, s: string) => {
  if (!e || !s) return "";
  const [eh, em] = e.split(":").map(Number);
  const [sh, sm] = s.split(":").map(Number);
  let m = (sh * 60 + sm) - (eh * 60 + em);
  if (m < 0) m += 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const uuid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

// ─── LGPD ─────────────────────────────────────────────────────────
const RETENCAO_ANOS = 5;
const dataLimiteRetencao = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - RETENCAO_ANOS);
  return d.toISOString().slice(0, 10);
};

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

const FORN_PALETTE = ["#D97706","#1A56DB","#0E9F6E","#6C63FF","#E02424","#0891B2","#CA8A04","#7C3AED","#0F766E","#64748B"];
const fornCor = (forn: string, lista: string[]) => FORN_PALETTE[lista.indexOf(forn) % FORN_PALETTE.length] || "#64748B";

// ─── SEED ────────────────────────────────────────────────────────
const SEED: Registro[] = [
  { id: uuid(), data: hoje(), turno: "1ª TURNO", horaEntrada: "05:20", horaSaida: "13:40", totalHoras: "08:20", nome: "WILSON CERQUEIRA", cargo: "AUXILIAR DE DEPÓSITO", setor: "RECEBIMENTO", unidade: "HUB", cc: "100002 - SOUZA CRUZ-HUB", motivo: "OPERAÇÃO BAT HUB BRASIL", fornecedor: "LIDER MASTER", obs: "" },
  { id: uuid(), data: hoje(), turno: "1ª TURNO", horaEntrada: "05:30", horaSaida: "13:50", totalHoras: "08:20", nome: "PATRICIA SOUZA LIMA", cargo: "CONFERENTE JR", setor: "EXPEDIÇÃO", unidade: "HUB", cc: "100002 - SOUZA CRUZ-HUB", motivo: "REFORÇO TURNO", fornecedor: "TRANSLOG", obs: "" },
  { id: uuid(), data: hoje(), turno: "2ª TURNO", horaEntrada: "13:50", horaSaida: "22:10", totalHoras: "08:20", nome: "ROBERTO ALVES NETO", cargo: "OPERADOR DE EMPILHADEIRA", setor: "SEPARAÇÃO", unidade: "COD DIURNO", cc: "100001 - SOUZA CRUZ-COD", motivo: "COBERTURA FALTA", fornecedor: "SERVILOG", obs: "" },
];

// ─── MAPEAMENTO DB ↔ MODELO ─────────────────────────────────────
type DbRegistro = Record<string, unknown>;

const dbToRegistro = (row: DbRegistro): Registro => ({
  id:          row.id as string,
  loteId:      (row.lote_id as string | null) ?? undefined,
  data:        row.data as string,
  turno:       row.turno as string,
  horaEntrada: row.hora_entrada as string,
  horaSaida:   row.hora_saida as string,
  totalHoras:  row.total_horas as string,
  nome:        row.nome as string,
  cargo:       row.cargo as string,
  setor:       row.setor as string,
  unidade:     row.unidade as string,
  cc:          row.cc as string,
  motivo:      row.motivo as string,
  fornecedor:  row.fornecedor as string,
  obs:         row.obs as string,
});

const registroToDb = (r: Registro) => ({
  id:           r.id,
  lote_id:      r.loteId ?? null,
  data:         r.data,
  turno:        r.turno,
  hora_entrada: r.horaEntrada,
  hora_saida:   r.horaSaida,
  total_horas:  r.totalHoras,
  nome:         r.nome,
  cargo:        r.cargo,
  setor:        r.setor,
  unidade:      r.unidade,
  cc:           r.cc,
  motivo:       r.motivo,
  fornecedor:   r.fornecedor,
  obs:          r.obs,
});

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
            const isNew = !prevRef.current.find(p => p.id === r.id);
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
    authReady.then(() =>
      supabase
        .from("opcoes")
        .select("chave, valor")
        .order("id", { ascending: true })
        .then(({ data: rows, error }) => {
          if (error) {
            console.error("Erro ao carregar opções:", error.message);
          } else if (rows) {
            // Agrupar valores do DB por chave
            const byKey = new Map<string, string[]>();
            (rows as { chave: string; valor: string }[]).forEach(row => {
              if (!byKey.has(row.chave)) byKey.set(row.chave, []);
              byKey.get(row.chave)!.push(row.valor);
            });

            // Partir dos defaults e sobrescrever apenas as chaves que existem no DB.
            // Chaves sem registro no DB mantêm os valores default automaticamente.
            const built: Opcoes = { ...OPCOES_DEFAULT };
            byKey.forEach((vals, k) => {
              if (k in built) (built as Record<string, string[]>)[k] = vals;
            });

            setData(built);
            prevRef.current = built;
          }
          setLoading(false);
        })
    );
  }, []);

  const save = useCallback((newVal: Opcoes) => {
    const prev = prevRef.current;
    setData(newVal);
    prevRef.current = newVal;

    const KEYS = Object.keys(newVal) as (keyof Opcoes)[];
    for (const key of KEYS) {
      const prevList = prev[key] as string[];
      const nextList = newVal[key] as string[];
      if (JSON.stringify(prevList) === JSON.stringify(nextList)) continue;

      // Abordagem diff: insere apenas itens realmente novos, deleta apenas os removidos.
      // Evita deletar tudo e reinserir tudo — previne perda de dados se o insert falhar.
      const toAdd    = nextList.filter(v => !prevList.includes(v));
      const toRemove = prevList.filter(v => !nextList.includes(v));

      if (toAdd.length > 0) {
        // Batches de 100 para evitar timeout em listas grandes.
        // Usa upsert com ignoreDuplicates para ser idempotente.
        const CHUNK = 100;
        (async () => {
          for (let i = 0; i < toAdd.length; i += CHUNK) {
            const batch = toAdd.slice(i, i + CHUNK);
            const { error } = await supabase
              .from("opcoes")
              .upsert(
                batch.map(valor => ({ chave: key, valor })),
                { onConflict: "chave,valor", ignoreDuplicates: true }
              );
            if (error) console.error(`Erro ao inserir opções [${key}]:`, error.message);
          }
        })();
      }

      if (toRemove.length > 0) {
        supabase
          .from("opcoes")
          .delete()
          .eq("chave", key)
          .in("valor", toRemove)
          .then(({ error }) => {
            if (error) console.error(`Erro ao remover opções [${key}]:`, error.message);
          });
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

const PrivacyNotice = ({ dpoNome, dpoEmail, onAccept }: { dpoNome: string; dpoEmail: string; onAccept: () => void }) => (
  <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(11,22,40,.92)", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
    <div style={{ background:"#fff", borderRadius:16, maxWidth:620, width:"100%", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 80px rgba(0,0,0,.4)" }}>
      <div style={{ background:"linear-gradient(135deg,#0B1628,#1A2C4A)", padding:"24px 28px", borderRadius:"16px 16px 0 0", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:40, height:40, background:"#1A56DB", borderRadius:10, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div>
          <div style={{ color:"#F8FAFC", fontWeight:800, fontSize:16 }}>Aviso de Privacidade e Proteção de Dados</div>
          <div style={{ color:"#64748B", fontSize:12, marginTop:2 }}>Lei Geral de Proteção de Dados Pessoais — Lei nº 13.709/2018</div>
        </div>
      </div>

      <div style={{ padding:"24px 28px", display:"flex", flexDirection:"column", gap:18, fontSize:13, color:"#334155", lineHeight:1.7 }}>
        <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:10, padding:"12px 16px", fontSize:12, color:"#1A56DB", fontWeight:600 }}>
          Este sistema trata dados pessoais de trabalhadores terceirizados. Leia as informações abaixo antes de continuar.
        </div>

        <section>
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>📋 Quais dados são coletados</div>
          <ul style={{ paddingLeft:18, margin:0, display:"flex", flexDirection:"column", gap:3, fontSize:12 }}>
            <li>Nome completo do colaborador</li>
            <li>Cargo e empresa fornecedora</li>
            <li>Data, horário de entrada/saída e total de horas trabalhadas</li>
            <li>Setor, unidade e centro de custo de lotação</li>
            <li>Motivo do acionamento</li>
          </ul>
        </section>

        <section>
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>⚖️ Base legal e finalidade (Art. 7º, II e V)</div>
          <p style={{ margin:0, fontSize:12 }}>
            O tratamento se baseia no <strong>cumprimento de obrigação legal</strong> (controle trabalhista, fiscal e de segurança) e na <strong>execução de contrato</strong> com as empresas fornecedoras de mão de obra. Os dados são usados exclusivamente para controle de presença e gestão operacional.
          </p>
        </section>

        <section>
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>🗓️ Retenção de dados (Art. 15 e 16)</div>
          <p style={{ margin:0, fontSize:12 }}>
            Os registros são mantidos por <strong>até {RETENCAO_ANOS} anos</strong> a partir da data do lançamento, após os quais são excluídos automaticamente.
          </p>
        </section>

        <section>
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>🔒 Segurança</div>
          <p style={{ margin:0, fontSize:12 }}>
            Os dados são armazenados com Row Level Security (RLS) no Supabase. Todas as operações de escrita requerem sessão autenticada e são registradas em log de auditoria.
          </p>
        </section>

        <section>
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>📌 Direitos do titular (Art. 18)</div>
          <p style={{ margin:0, fontSize:12 }}>
            O titular pode solicitar acesso, correção ou exclusão de seus dados a qualquer momento, mediante requisição ao Encarregado de Dados (DPO).
          </p>
        </section>

        {(dpoNome || dpoEmail) && (
          <section style={{ background:"#F8FAFC", border:"1px solid #E2E6EC", borderRadius:10, padding:"12px 16px" }}>
            <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E", marginBottom:6 }}>👤 Encarregado de Dados (DPO) — Art. 41</div>
            {dpoNome  && <div style={{ fontSize:12 }}><strong>Nome:</strong> {dpoNome}</div>}
            {dpoEmail && <div style={{ fontSize:12 }}><strong>E-mail:</strong> {dpoEmail}</div>}
          </section>
        )}

        <button onClick={onAccept} style={{ background:"#1A56DB", border:"none", borderRadius:10, padding:"14px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:14, fontFamily:"inherit", marginTop:4 }}>
          Entendi e aceito — Continuar
        </button>
        <div style={{ fontSize:11, color:"#94A3B8", textAlign:"center", marginTop:-8 }}>
          Ao continuar, você confirma que está ciente das práticas de tratamento de dados descritas acima.
        </div>
      </div>
    </div>
  </div>
);

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
    setComum(prev => {
      if (k === "horaEntrada") setPessoas(ps => ps.map(p => p.horaEntrada === prev.horaEntrada ? { ...p, horaEntrada: v } : p));
      if (k === "horaSaida")   setPessoas(ps => ps.map(p => p.horaSaida   === prev.horaSaida   ? { ...p, horaSaida: v }   : p));
      return { ...prev, [k]: v };
    });
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

  const G = ({ children, cols = 2 }: { children: ReactNode; cols?: number }) => (
    <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`, gap:14 }}>{children}</div>
  );

  const totalPadrao = calcHoras(comum.horaEntrada, comum.horaSaida);
  const btnLabel = (isEdit || isLoteEdit) ? "Salvar Alterações" : validCount > 1 ? `Salvar ${validCount} Lançamentos` : "Salvar Lançamento";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Bloco 0 — Quantidade */}
      {!isEdit && !isLoteEdit && (
        <div style={{ background:"#F0F6FF", border:"1.5px solid #BFDBFE", borderRadius:12, padding:"12px 18px", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#1A56DB", textTransform:"uppercase", letterSpacing:.8 }}>Quantidade de Pessoas</div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <button onClick={() => handleQtd(pessoas.length - 1)} style={{ width:28, height:28, borderRadius:7, border:"1.5px solid #BFDBFE", background:"#fff", cursor:"pointer", fontWeight:800, fontSize:15, color:"#1A56DB", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
            <input type="number" min={1} max={20} value={pessoas.length} onChange={e => handleQtd(Number(e.target.value))}
              style={{ width:48, textAlign:"center", border:"1.5px solid #BFDBFE", borderRadius:7, padding:"5px 6px", fontSize:15, fontWeight:800, color:"#1A56DB", fontFamily:"inherit", background:"#fff", outline:"none" }} />
            <button onClick={() => handleQtd(pessoas.length + 1)} style={{ width:28, height:28, borderRadius:7, border:"none", background:"#1A56DB", cursor:"pointer", fontWeight:800, fontSize:15, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
          </div>
          <div style={{ fontSize:12, color:"#64748B" }}>pessoa{pessoas.length !== 1 ? "s" : ""} neste lançamento</div>
        </div>
      )}

      {/* Bloco 1 — Identificação */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:20, height:20, borderRadius:6, background:"#1A56DB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:800 }}>1</div>
          Identificação
        </div>
        <G cols={2}>
          <Select label="Cargo" value={comum.cargo} onChange={e => setC("cargo", e.target.value)}>{opcoes.cargos.map(c => <option key={c}>{c}</option>)}</Select>
          <Select label="Fornecedor" value={comum.fornecedor} onChange={e => setC("fornecedor", e.target.value)}>{opcoes.fornecedores.map(c => <option key={c}>{c}</option>)}</Select>
        </G>
      </div>

      {/* Bloco 2 — Lotação */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:20, height:20, borderRadius:6, background:"#0E9F6E", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:800 }}>2</div>
          Lotação
        </div>
        <G cols={3}>
          <Select label="Unidade" value={comum.unidade} onChange={e => setC("unidade", e.target.value)}>{opcoes.unidades.map(c => <option key={c}>{c}</option>)}</Select>
          <Select label="Setor" value={comum.setor} onChange={e => setC("setor", e.target.value)}>{opcoes.setores.map(c => <option key={c}>{c}</option>)}</Select>
          <Select label="Centro de Custo" value={comum.cc} onChange={e => setC("cc", e.target.value)}>{opcoes.ccList.map(c => <option key={c}>{c}</option>)}</Select>
        </G>
      </div>

      {/* Bloco 3 — Jornada */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:20, height:20, borderRadius:6, background:"#D97706", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:800 }}>3</div>
          Jornada
          {!isEdit && <span style={{ fontSize:10, color:"#94A3B8", fontWeight:400, letterSpacing:.3, marginLeft:4 }}>— horários padrão (altere individualmente abaixo se necessário)</span>}
        </div>
        <G cols={4}>
          <Input label="Data" type="date" value={comum.data} onChange={e => setC("data", e.target.value)} />
          <Select label="Turno" value={comum.turno} onChange={e => setC("turno", e.target.value)}>{opcoes.turnos.map(c => <option key={c}>{c}</option>)}</Select>
          <Input label={isEdit ? "Hora Entrada" : "Entrada Padrão"} type="time" value={comum.horaEntrada} onChange={e => setC("horaEntrada", e.target.value)} />
          <Input label={isEdit ? "Hora Saída" : "Saída Padrão"} type="time" value={comum.horaSaida} onChange={e => setC("horaSaida", e.target.value)} />
        </G>
        {totalPadrao && (
          <div style={{ marginTop:10, display:"inline-flex", alignItems:"center", gap:8, background:"#E6F9F4", borderRadius:8, padding:"8px 14px" }}>
            <Icon d="M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" size={14} />
            <span style={{ fontSize:13, fontWeight:700, color:"#0E9F6E", fontFamily:"monospace" }}>{isEdit ? "Total:" : "Padrão:"} {totalPadrao}</span>
          </div>
        )}
      </div>

      {/* Bloco 4 — Motivo */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:20, height:20, borderRadius:6, background:"#6C63FF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:800 }}>4</div>
          Motivo e Observações
        </div>
        <G cols={1}>
          <Select label="Motivo" value={comum.motivo} onChange={e => setC("motivo", e.target.value)}>{opcoes.motivos.map(c => <option key={c}>{c}</option>)}</Select>
          <Input label="Observação" value={comum.obs} onChange={e => setC("obs", e.target.value)} placeholder="Informações adicionais (opcional)" />
        </G>
      </div>

      {/* Bloco 5 — Colaboradores */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:20, height:20, borderRadius:6, background:"#0891B2", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:800 }}>5</div>
          {isEdit ? "Colaborador" : `Colaboradores — ${pessoas.length} pessoa${pessoas.length !== 1 ? "s" : ""}`}
        </div>
        <div style={{ border:"1px solid #E2E6EC", borderRadius:10, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"36px 1fr 124px 124px 72px", background:"#F8FAFC", borderBottom:"1px solid #E2E6EC", padding:"9px 14px", gap:8 }}>
            {["#", "Nome Completo *", "Hora Entrada", "Hora Saída", "Total"].map(h => (
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
                  placeholder="NOME COMPLETO"
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

      <div style={{ display:"flex", justifyContent:"flex-end", gap:8, paddingTop:16, borderTop:"1px solid #F1F5F9" }}>
        <Btn variant="ghost" onClick={onCancel}>Cancelar</Btn>
        <Btn onClick={handleSave} disabled={!valid} icon={<Icon d="M5 13l4 4L19 7" />}>{btnLabel}</Btn>
      </div>
    </div>
  );
};

// ─── TELA: LANÇAMENTOS ──────────────────────────────────────────
interface Filtros { data: string; turno: string; fornecedor: string; unidade: string; setor: string; busca: string; }

const Lancamentos = ({ registros, setRegistros, opcoes }: { registros: Registro[]; setRegistros: (val: Registro[]) => void; opcoes: Opcoes }) => {
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
          <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>Registros</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#0F1C2E" }}>Lançamentos de Terceiros</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <Btn variant="ghost" onClick={exportCSV} icon={<Icon d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />}>Exportar CSV</Btn>
          <Btn onClick={() => setModal("new")} icon={<Icon d="M12 5v14M5 12h14" />}>Novo Lançamento</Btn>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:"14px 18px", display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
        <Input label="Data" type="date" value={filtros.data} onChange={e => set("data", e.target.value)} style={{ width:150 }} />
        <Select label="Turno" value={filtros.turno} onChange={e => set("turno", e.target.value)} style={{ width:150 }}>
          <option value="">Todos</option>{opcoes.turnos.map(t => <option key={t}>{t}</option>)}
        </Select>
        <Select label="Fornecedor" value={filtros.fornecedor} onChange={e => set("fornecedor", e.target.value)} style={{ width:150 }}>
          <option value="">Todos</option>{opcoes.fornecedores.map(t => <option key={t}>{t}</option>)}
        </Select>
        <Select label="Unidade" value={filtros.unidade} onChange={e => set("unidade", e.target.value)} style={{ width:150 }}>
          <option value="">Todas</option>{opcoes.unidades.map(t => <option key={t}>{t}</option>)}
        </Select>
        <Select label="Setor" value={filtros.setor} onChange={e => set("setor", e.target.value)} style={{ width:150 }}>
          <option value="">Todos</option>{opcoes.setores.map(t => <option key={t}>{t}</option>)}
        </Select>
        <Input label="Buscar nome" value={filtros.busca} onChange={e => set("busca", e.target.value)} placeholder="Nome…" style={{ width:180 }} />
        <div style={{ marginLeft:"auto", alignSelf:"flex-end" }}>
          <Btn variant="ghost" small onClick={() => setFiltros({ data:"", turno:"", fornecedor:"", unidade:"", setor:"", busca:"" })}>Limpar filtros</Btn>
        </div>
      </div>

      {/* Contador */}
      <div style={{ fontSize:12, color:"#94A3B8", paddingLeft:2 }}>
        Exibindo <strong style={{ color:"#0F1C2E" }}>{filtered.length}</strong> de <strong style={{ color:"#0F1C2E" }}>{registros.length}</strong> registros
      </div>

      {/* Tabela */}
      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
            <thead>
              <tr style={{ background:"#F8FAFC" }}>
                {["Data","Turno","Nome","Cargo","Fornecedor","Setor","Unidade","Entrada","Saída","Horas","Motivo","Ações"].map(h => (
                  <th key={h} style={{ padding:"10px 12px", textAlign:"left", color:"#64748B", fontWeight:700, fontSize:10, textTransform:"uppercase", letterSpacing:.7, whiteSpace:"nowrap", borderBottom:"2px solid #E2E6EC" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grupos.length === 0 && (
                <tr><td colSpan={12} style={{ textAlign:"center", padding:48, color:"#94A3B8" }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
                  Nenhum registro encontrado
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
                    <td style={{ padding:"10px 12px", fontFamily:"monospace", fontSize:11, color:"#64748B" }}>{fmt(r.data)}</td>
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
          title={modal === "new" ? "Novo Lançamento" : Array.isArray(modal) ? `Editar Lote — ${modal.length} pessoas` : "Editar Lançamento"}
          subtitle="Controle de Terceiros" onClose={() => setModal(null)} xl>
          <FormLancamento
            inicial={modal === "new" || Array.isArray(modal) ? null : modal as Registro}
            loteInicial={Array.isArray(modal) ? modal : undefined}
            onSave={salvar} onCancel={() => setModal(null)} opcoes={opcoes} />
        </Modal>
      )}

      {detalhe && (
        <Modal
          title={Array.isArray(detalhe) ? `Lote — ${detalhe.length} colaboradores` : "Detalhes do Lançamento"}
          subtitle={Array.isArray(detalhe) ? `${fmt(detalhe[0].data)} · ${detalhe[0].turno}` : detalhe.nome}
          onClose={() => setDetalhe(null)} wide={!Array.isArray(detalhe)} xl={Array.isArray(detalhe)}>
          {Array.isArray(detalhe) ? (
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {/* Campos comuns */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {([
                  ["Data", fmt(detalhe[0].data)], ["Turno", detalhe[0].turno],
                  ["Cargo", detalhe[0].cargo], ["Fornecedor", detalhe[0].fornecedor],
                  ["Unidade", detalhe[0].unidade], ["Setor", detalhe[0].setor],
                  ["Centro de Custo", detalhe[0].cc], ["Motivo", detalhe[0].motivo],
                ] as [string, string][]).map(([k, v]) => (
                  <div key={k} style={{ background:"#F8FAFC", borderRadius:8, padding:"10px 14px" }}>
                    <div style={{ fontSize:10, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:.7, marginBottom:4 }}>{k}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:"#0F1C2E" }}>{v || "—"}</div>
                  </div>
                ))}
              </div>
              {/* Lista de colaboradores */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Colaboradores ({detalhe.length})</div>
                <div style={{ border:"1px solid #E2E6EC", borderRadius:8, overflow:"hidden" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 96px 96px 72px", background:"#F8FAFC", padding:"8px 14px", gap:8, borderBottom:"1px solid #E2E6EC" }}>
                    {["Nome","Entrada","Saída","Total"].map(h => <div key={h} style={{ fontSize:10, fontWeight:700, color:"#64748B", textTransform:"uppercase" }}>{h}</div>)}
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
              {detalhe[0].obs && (
                <div style={{ background:"#FEF3C7", borderRadius:8, padding:"10px 14px" }}>
                  <div style={{ fontSize:10, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:.7, marginBottom:4 }}>Observação</div>
                  <div style={{ fontSize:13, color:"#0F1C2E" }}>{detalhe[0].obs}</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              {([
                ["Nome", detalhe.nome], ["Cargo", detalhe.cargo], ["Fornecedor", detalhe.fornecedor],
                ["Data", fmt(detalhe.data)], ["Turno", detalhe.turno], ["Setor", detalhe.setor],
                ["Unidade", detalhe.unidade], ["Centro de Custo", detalhe.cc],
                ["Hora Entrada", detalhe.horaEntrada], ["Hora Saída", detalhe.horaSaida],
                ["Total de Horas", detalhe.totalHoras], ["Motivo", detalhe.motivo],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ background:"#F8FAFC", borderRadius:8, padding:"10px 14px" }}>
                  <div style={{ fontSize:10, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:.7, marginBottom:4 }}>{k}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#0F1C2E" }}>{v || "—"}</div>
                </div>
              ))}
              {detalhe.obs && (
                <div style={{ gridColumn:"span 2", background:"#FEF3C7", borderRadius:8, padding:"10px 14px" }}>
                  <div style={{ fontSize:10, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:.7, marginBottom:4 }}>Observação</div>
                  <div style={{ fontSize:13, color:"#0F1C2E" }}>{detalhe.obs}</div>
                </div>
              )}
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:16, paddingTop:16, borderTop:"1px solid #F1F5F9" }}>
            <Btn variant="ghost" onClick={() => setDetalhe(null)}>Fechar</Btn>
            <Btn onClick={() => { setModal(detalhe); setDetalhe(null); }}>Editar</Btn>
          </div>
        </Modal>
      )}

      {confirm && (
        <Modal title="Confirmar exclusão" onClose={() => setConfirm(null)}>
          <p style={{ color:"#475569", fontSize:13, lineHeight:1.6 }}>
            {confirm.length > 1
              ? `Tem certeza que deseja excluir este lote (${confirm.length} registros)? Esta ação não poderá ser desfeita.`
              : "Tem certeza que deseja excluir este lançamento? Esta ação não poderá ser desfeita."}
          </p>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:20 }}>
            <Btn variant="ghost" onClick={() => setConfirm(null)}>Cancelar</Btn>
            <Btn variant="danger" onClick={() => excluir(confirm)}>Excluir</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── TELA: DASHBOARD ────────────────────────────────────────────
const Dashboard = ({ registros, opcoes }: { registros: Registro[]; opcoes: Opcoes }) => {
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
          <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>Visão Analítica</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#0F1C2E" }}>Dashboard de Terceiros</div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <button onClick={() => { const d = new Date(periodo + "-01"); d.setMonth(d.getMonth() - 1); setPeriodo(d.toISOString().slice(0, 7)); }}
            style={{ background:"#F1F5F9", border:"none", borderRadius:8, padding:"8px 12px", cursor:"pointer", fontWeight:700 }}>‹</button>
          <span style={{ fontSize:14, fontWeight:800, minWidth:100, textAlign:"center", color:"#0F1C2E" }}>{fmtMes(periodo)}</span>
          <button onClick={() => { const d = new Date(periodo + "-01"); d.setMonth(d.getMonth() + 1); setPeriodo(d.toISOString().slice(0, 7)); }}
            style={{ background:"#F1F5F9", border:"none", borderRadius:8, padding:"8px 12px", cursor:"pointer", fontWeight:700 }}>›</button>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        <KPI label="Registros no Mês" value={doMes.length} sub={`${deHoje.length} hoje`} color="#1A56DB"
          icon={<Icon d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />} />
        <KPI label="Fornecedores Ativos" value={porFornecedor.length} sub="no período" color="#D97706"
          icon={<Icon d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />} />
        <KPI label="Total de Horas" value={totalHorasMes} sub="horas trabalhadas" color="#0E9F6E"
          icon={<Icon d="M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" />} />
        <KPI label="Setores Cobertos" value={porSetor.length} sub="no período" color="#6C63FF"
          icon={<Icon d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:16, color:"#0F1C2E" }}>Registros por Fornecedor</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {porFornecedor.length === 0 && <div style={{ color:"#94A3B8", fontSize:12, textAlign:"center", padding:20 }}>Sem dados no período</div>}
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
          <div style={{ fontWeight:700, fontSize:13, marginBottom:16, color:"#0F1C2E" }}>Registros por Setor</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {porSetor.length === 0 && <div style={{ color:"#94A3B8", fontSize:12, textAlign:"center", padding:20 }}>Sem dados no período</div>}
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
        <div style={{ fontWeight:700, fontSize:13, marginBottom:14, color:"#0F1C2E" }}>Distribuição por Turno</div>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
          {opcoes.turnos.map((t, i) => {
            const doMes_t  = doMes.filter(r => r.turno === t);
            const n        = doMes_t.length;
            const pct      = doMes.length ? (n / doMes.length * 100).toFixed(0) : 0;
            const cor      = CHART_CORES[i % CHART_CORES.length];
            const diasTurno = new Set(doMes_t.map(r => r.data)).size;
            const mediaDia  = diasTurno > 0 ? (n / diasTurno).toFixed(1) : "—";
            const allTurno  = registros.filter(r => r.turno === t);
            const mesesTurno = new Set(allTurno.map(r => r.data.slice(0, 7))).size;
            const mediaMes  = mesesTurno > 0 ? (allTurno.length / mesesTurno).toFixed(1) : "—";
            return (
              <div key={t} style={{ flex:1, minWidth:140, background: cor + "0F", border:`1.5px solid ${cor}33`, borderRadius:10, padding:"12px 16px" }}>
                <div style={{ fontSize:11, color:cor, fontWeight:700, marginBottom:8 }}>{t}</div>
                <div style={{ fontSize:26, fontWeight:800, color:cor, lineHeight:1 }}>{n}</div>
                <div style={{ fontSize:11, color:"#94A3B8", marginTop:2, marginBottom:10 }}>{pct}% do período</div>
                <div style={{ display:"flex", flexDirection:"column", gap:4, borderTop:`1px solid ${cor}22`, paddingTop:8 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                    <span style={{ color:"#94A3B8" }}>Média/dia</span>
                    <span style={{ fontWeight:700, color:cor, fontFamily:"monospace" }}>{mediaDia}</span>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
                    <span style={{ color:"#94A3B8" }}>Média/mês</span>
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
        <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>Visão</div>
        <div style={{ fontSize:20, fontWeight:800, color:"#0F1C2E" }}>Painel de Fornecedores</div>
      </div>
      {resumo.length === 0 && (
        <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:48, textAlign:"center", color:"#94A3B8" }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🏢</div>
          Nenhum lançamento registrado ainda
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:14 }}>
        {resumo.map(({ forn, total, hoje: hj, mes, horas, setores, ultimos }) => {
          const cor = fornCor(forn, opcoes.fornecedores);
          return (
            <div key={forn} style={{ background:"#fff", border:`1px solid ${cor}33`, borderRadius:12, overflow:"hidden", boxShadow:"0 1px 4px rgba(15,28,46,.06)" }}>
              <div style={{ background:cor, padding:"14px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ fontWeight:800, fontSize:14, color:"#fff" }}>{forn}</div>
                <div style={{ background:"rgba(255,255,255,.2)", borderRadius:8, padding:"4px 10px", fontSize:12, fontWeight:700, color:"#fff" }}>{total} registros</div>
              </div>
              <div style={{ padding:"14px 18px" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
                  {([["Hoje", hj, cor], ["Este Mês", mes, "#334155"], ["Total Horas", horas, "#0E9F6E"]] as [string, string | number, string][]).map(([l, v, c]) => (
                    <div key={l} style={{ background:"#F8FAFC", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                      <div style={{ fontSize:10, color:"#94A3B8", textTransform:"uppercase", letterSpacing:.6, marginBottom:3 }}>{l}</div>
                      <div style={{ fontSize:14, fontWeight:800, color:c }}>{v}</div>
                    </div>
                  ))}
                </div>
                {setores.length > 0 && (
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:10, color:"#94A3B8", textTransform:"uppercase", letterSpacing:.6, marginBottom:6 }}>Setores atendidos</div>
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                      {setores.map(s => <Chip key={s} label={s} color={cor} size="sm" />)}
                    </div>
                  </div>
                )}
                {ultimos.length > 0 && (
                  <div>
                    <div style={{ fontSize:10, color:"#94A3B8", textTransform:"uppercase", letterSpacing:.6, marginBottom:6 }}>Últimos lançamentos</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                      {ultimos.map(r => (
                        <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:11, padding:"4px 0", borderBottom:"1px solid #F1F5F9" }}>
                          <span style={{ fontWeight:600, color:"#334155", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:160 }}>{r.nome}</span>
                          <span style={{ color:"#94A3B8", fontFamily:"monospace", flexShrink:0, marginLeft:8 }}>{fmt(r.data)}</span>
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
}: {
  opcoes: Opcoes;
  setOpcoes: (val: Opcoes) => void;
  registros: Registro[];
  setRegistros: (val: Registro[]) => void;
}) => {
  type OpcKey = keyof Opcoes;
  const [inputs, setInputs] = useState<Record<OpcKey, string>>({
    turnos: "", unidades: "", fornecedores: "", motivos: "", cargos: "", ccList: "", setores: "", nomes: ""
  });
  const [nomesBulk, setNomesBulk] = useState("");
  const [nomeBusca, setNomeBusca] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState("");

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
    setExclusaoFeedback(`✓ ${ids.length} registro${ids.length > 1 ? "s" : ""} de "${q}" excluído${ids.length > 1 ? "s" : ""} com sucesso.`);
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

  const importNomes = async () => {
    // Deduplica internamente E filtra já existentes
    const novos = [...new Set(
      nomesBulk
        .split("\n")
        .map(n => n.trim().toUpperCase())
        .filter(n => n.length > 2)
    )].filter(n => !opcoes.nomes.includes(n));

    if (novos.length === 0) { setBulkFeedback("Nenhum nome novo para importar."); return; }

    setBulkFeedback("Salvando…");

    // Insere direto no DB em batches de 100 (com feedback real de erro)
    const CHUNK = 100;
    let erroMsg = "";
    for (let i = 0; i < novos.length; i += CHUNK) {
      const batch = novos.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("opcoes")
        .insert(batch.map(valor => ({ chave: "nomes", valor })));
      if (error) { erroMsg = error.message; break; }
    }

    if (erroMsg) {
      setBulkFeedback(`Erro ao salvar: ${erroMsg}`);
      return;
    }

    // Atualiza estado local (sem re-disparar save no DB — já fizemos acima)
    const novaLista = [...opcoes.nomes, ...novos];
    setOpcoes({ ...opcoes, nomes: novaLista });
    setNomesBulk("");
    setBulkFeedback(`${novos.length} nome${novos.length > 1 ? "s" : ""} importado${novos.length > 1 ? "s" : ""} com sucesso!`);
    setTimeout(() => setBulkFeedback(""), 4000);
  };

  const nomesFiltrados = opcoes.nomes.filter(n => n.toLowerCase().includes(nomeBusca.toLowerCase()));

  const inStyle: CSSProperties = { border:"1.5px solid #E2E6EC", borderRadius:7, padding:"6px 10px", fontSize:12, fontFamily:"inherit", outline:"none", background:"#FAFBFC", flex:1 };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      <div>
        <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>Personalização</div>
        <div style={{ fontSize:20, fontWeight:800, color:"#0F1C2E" }}>Configurações</div>
        <div style={{ fontSize:12, color:"#64748B", marginTop:4 }}>Gerencie as opções dos campos e a base de colaboradores.</div>
      </div>

      {/* Grade de listas de opções */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
        {OPCOES_CONFIG.map(({ key, label, cor }) => (
          <div key={key} style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:18, display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:cor, flexShrink:0 }} />
              <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E" }}>{label}</div>
              <div style={{ marginLeft:"auto", fontSize:11, background:cor + "18", color:cor, fontWeight:700, borderRadius:99, padding:"2px 8px" }}>{opcoes[key].length}</div>
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:3, maxHeight:160, overflowY:"auto" }}>
              {opcoes[key].length === 0 && <div style={{ color:"#CBD5E1", fontSize:11, textAlign:"center", padding:"10px 0" }}>Nenhum item</div>}
              {opcoes[key].map((item, idx) => (
                <div key={idx} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 8px", background:"#F8FAFC", borderRadius:6, fontSize:12 }}>
                  <span style={{ color:"#334155", fontWeight:500 }}>{item}</span>
                  <button onClick={() => removeItem(key, idx)} style={{ background:"none", border:"none", cursor:"pointer", color:"#CBD5E1", padding:2, display:"flex", lineHeight:1, flexShrink:0 }}>
                    <Icon d="M18 6L6 18M6 6l12 12" size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display:"flex", gap:6 }}>
              <input value={inputs[key]} onChange={e => setInputs(p => ({ ...p, [key]: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addItem(key, inputs[key])}
                placeholder="Novo item..." style={inStyle} />
              <button onClick={() => addItem(key, inputs[key])}
                style={{ background:cor, border:"none", borderRadius:7, padding:"6px 14px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>+</button>
            </div>
          </div>
        ))}
      </div>

      {/* Base de Nomes */}
      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#334155", flexShrink:0 }} />
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E" }}>Base de Colaboradores</div>
          <div style={{ fontSize:11, background:"#33415518", color:"#334155", fontWeight:700, borderRadius:99, padding:"2px 8px" }}>{opcoes.nomes.length} nomes</div>
          <div style={{ fontSize:12, color:"#94A3B8", marginLeft:4 }}>— usados para autocompletar o campo de nome nos lançamentos</div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
          {/* Lista de nomes */}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.7 }}>Colaboradores cadastrados</div>
            <input value={nomeBusca} onChange={e => setNomeBusca(e.target.value)} placeholder="Buscar nome..."
              style={{ ...inStyle, flex:"none" }} />
            <div style={{ border:"1px solid #E2E6EC", borderRadius:8, maxHeight:260, overflowY:"auto" }}>
              {nomesFiltrados.length === 0 && (
                <div style={{ color:"#94A3B8", fontSize:12, textAlign:"center", padding:24 }}>
                  {opcoes.nomes.length === 0 ? "Nenhum colaborador cadastrado" : "Nenhum resultado"}
                </div>
              )}
              {nomesFiltrados.map((nome, idx) => {
                const realIdx = opcoes.nomes.indexOf(nome);
                return (
                  <div key={idx} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", borderBottom: idx < nomesFiltrados.length - 1 ? "1px solid #F1F5F9" : "none", fontSize:12 }}>
                    <span style={{ color:"#334155", fontWeight:500 }}>{nome}</span>
                    <button onClick={() => removeItem("nomes", realIdx)} style={{ background:"none", border:"none", cursor:"pointer", color:"#CBD5E1", padding:2, display:"flex" }}>
                      <Icon d="M18 6L6 18M6 6l12 12" size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              <input value={inputs.nomes} onChange={e => setInputs(p => ({ ...p, nomes: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && addItem("nomes", inputs.nomes)}
                placeholder="Adicionar nome individual..." style={inStyle} />
              <button onClick={() => addItem("nomes", inputs.nomes)}
                style={{ background:"#334155", border:"none", borderRadius:7, padding:"6px 14px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>+</button>
            </div>
          </div>

          {/* Importação em massa */}
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.7 }}>Importar lista (um nome por linha)</div>
            <textarea value={nomesBulk} onChange={e => setNomesBulk(e.target.value)}
              placeholder={"JOÃO DA SILVA\nMARIA OLIVEIRA\nCARLOS SANTOS\n..."}
              style={{ border:"1.5px solid #E2E6EC", borderRadius:8, padding:"9px 11px", fontSize:12, fontFamily:"inherit", background:"#FAFBFC", width:"100%", outline:"none", resize:"vertical", minHeight:220, lineHeight:1.8 }} />
            <button onClick={importNomes}
              style={{ background:"#1A56DB", border:"none", borderRadius:8, padding:"10px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>
              Importar Nomes
            </button>
            {bulkFeedback && (
              <div style={{ fontSize:12, color:"#0E9F6E", fontWeight:600, background:"#E6F9F4", borderRadius:7, padding:"7px 12px" }}>
                {bulkFeedback}
              </div>
            )}
            <div style={{ fontSize:11, color:"#94A3B8" }}>Nomes duplicados são ignorados automaticamente. Cole diretamente de uma planilha Excel (uma coluna de nomes).</div>
          </div>
        </div>
      </div>

      {/* ── LGPD: DPO (Art. 41) ── */}
      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#6C63FF", flexShrink:0 }} />
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E" }}>Encarregado de Dados (DPO)</div>
          <div style={{ fontSize:11, background:"#6C63FF18", color:"#6C63FF", fontWeight:700, borderRadius:99, padding:"2px 8px" }}>Art. 41 LGPD</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:14 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.7 }}>Nome</label>
            <input value={dpoNome} onChange={e => setDpoNome(e.target.value)} placeholder="Nome do responsável"
              style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"7px 10px", fontSize:12, fontFamily:"inherit", background:"#FAFBFC", outline:"none" }} />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.7 }}>E-mail</label>
            <input type="email" value={dpoEmail} onChange={e => setDpoEmail(e.target.value)} placeholder="dpo@empresa.com.br"
              style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"7px 10px", fontSize:12, fontFamily:"inherit", background:"#FAFBFC", outline:"none" }} />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.7 }}>Telefone</label>
            <input value={dpoTelefone} onChange={e => setDpoTelefone(e.target.value)} placeholder="(00) 00000-0000"
              style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"7px 10px", fontSize:12, fontFamily:"inherit", background:"#FAFBFC", outline:"none" }} />
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={saveDpo} style={{ background:"#6C63FF", border:"none", borderRadius:8, padding:"9px 22px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>
            Salvar DPO
          </button>
          {dpoSaved && <span style={{ fontSize:12, color:"#0E9F6E", fontWeight:600 }}>✓ Salvo com sucesso</span>}
        </div>
        <div style={{ fontSize:11, color:"#94A3B8", marginTop:10 }}>
          As informações do DPO são exibidas no aviso de privacidade apresentado ao usuário no primeiro acesso. Obrigatório pela Lei nº 13.709/2018 (LGPD).
        </div>
      </div>

      {/* ── LGPD: Exclusão por Solicitação (Art. 18) ── */}
      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#E02424", flexShrink:0 }} />
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E" }}>Direitos do Titular — Exclusão por Solicitação</div>
          <div style={{ fontSize:11, background:"#E0242418", color:"#E02424", fontWeight:700, borderRadius:99, padding:"2px 8px" }}>Art. 18 LGPD</div>
        </div>
        <div style={{ fontSize:12, color:"#64748B", marginBottom:14 }}>
          Para atender a uma solicitação de exclusão de dados de um colaborador, busque pelo nome exato abaixo. Todos os registros deste colaborador serão removidos permanentemente e o evento será registrado no log de auditoria.
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:14 }}>
          <input value={titularNome} onChange={e => setTitularNome(e.target.value)}
            onKeyDown={e => e.key === "Enter" && buscarTitular()}
            placeholder="NOME COMPLETO DO COLABORADOR"
            style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"8px 12px", fontSize:13, fontFamily:"inherit", background:"#FAFBFC", outline:"none", flex:1, textTransform:"uppercase" }} />
          <button onClick={buscarTitular} style={{ background:"#334155", border:"none", borderRadius:8, padding:"8px 20px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit", flexShrink:0 }}>
            Buscar
          </button>
        </div>

        {titularResult !== null && (
          <div style={{ border:"1px solid #E2E6EC", borderRadius:10, overflow:"hidden", marginBottom:12 }}>
            <div style={{ background:"#F8FAFC", padding:"10px 16px", fontSize:12, color:"#64748B", borderBottom:"1px solid #E2E6EC", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>Resultado para: <strong style={{ color:"#0F1C2E" }}>{titularNome.trim().toUpperCase()}</strong></span>
              <span style={{ fontWeight:700, color: titularResult.length > 0 ? "#E02424" : "#0E9F6E" }}>
                {titularResult.length} registro{titularResult.length !== 1 ? "s" : ""} encontrado{titularResult.length !== 1 ? "s" : ""}
              </span>
            </div>
            {titularResult.length === 0 ? (
              <div style={{ padding:"20px 16px", fontSize:12, color:"#94A3B8", textAlign:"center" }}>Nenhum registro encontrado para este nome.</div>
            ) : (
              <div style={{ padding:"12px 16px", display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:160, overflowY:"auto" }}>
                  {titularResult.slice(0, 5).map(r => (
                    <div key={r.id} style={{ display:"flex", gap:10, fontSize:11, color:"#475569", background:"#FFF5F5", borderRadius:6, padding:"5px 10px" }}>
                      <span style={{ color:"#94A3B8", fontFamily:"monospace" }}>{fmt(r.data)}</span>
                      <span>{r.turno}</span>
                      <span>{r.fornecedor}</span>
                      <span style={{ color:"#64748B" }}>{r.horaEntrada}–{r.horaSaida}</span>
                    </div>
                  ))}
                  {titularResult.length > 5 && <div style={{ fontSize:11, color:"#94A3B8", textAlign:"center" }}>+{titularResult.length - 5} registro{titularResult.length - 5 > 1 ? "s" : ""} não exibido{titularResult.length - 5 > 1 ? "s" : ""}</div>}
                </div>
                {!exclusaoConfirm ? (
                  <button onClick={() => setExclusaoConfirm(true)}
                    style={{ background:"#FEF2F2", border:"1.5px solid #FECACA", borderRadius:8, padding:"9px 18px", cursor:"pointer", color:"#E02424", fontWeight:700, fontSize:13, fontFamily:"inherit", alignSelf:"flex-start" }}>
                    Solicitar exclusão de {titularResult.length} registro{titularResult.length !== 1 ? "s" : ""}
                  </button>
                ) : (
                  <div style={{ background:"#FFF5F5", border:"1.5px solid #FECACA", borderRadius:10, padding:"14px 16px", display:"flex", flexDirection:"column", gap:10 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:"#E02424" }}>⚠️ Confirmação de Exclusão Irreversível</div>
                    <div style={{ fontSize:12, color:"#475569" }}>
                      Esta ação removerá <strong>{titularResult.length} registro{titularResult.length !== 1 ? "s" : ""}</strong> de <strong>{titularNome.trim().toUpperCase()}</strong> permanentemente. O evento será registrado no log de auditoria para fins de compliance com a LGPD.
                    </div>
                    <div style={{ display:"flex", gap:8 }}>
                      <button onClick={excluirTitular} style={{ background:"#E02424", border:"none", borderRadius:8, padding:"9px 18px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>
                        Confirmar Exclusão
                      </button>
                      <button onClick={() => setExclusaoConfirm(false)} style={{ background:"#F1F5F9", border:"none", borderRadius:8, padding:"9px 18px", cursor:"pointer", color:"#475569", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>
                        Cancelar
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
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// INDEX
// ═══════════════════════════════════════════════════════════════
type TabId = "dashboard" | "lancamentos" | "fornecedores" | "configuracoes";
interface NavItem { id: TabId; label: string; icon: string; }

const Index = () => {
  const navigate = useNavigate();
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
    { id: "dashboard",      label: "Dashboard",      icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" },
    { id: "lancamentos",    label: "Lançamentos",    icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" },
    { id: "fornecedores",   label: "Fornecedores",   icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
    { id: "configuracoes",  label: "Configurações",  icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.94 11a8 8 0 0 0-15.88 0H2v2h2.06a8 8 0 0 0 15.88 0H22v-2h-2.06z" },
  ];

  return (
    <>
      {!privacyAccepted && (
        <PrivacyNotice dpoNome={dpoCfg.nome} dpoEmail={dpoCfg.email} onAccept={acceptPrivacy} />
      )}
    <div style={{ minHeight:"100vh", background:"#F0F2F5", fontFamily:"'DM Sans',system-ui,sans-serif", display:"flex", flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box}
        input:focus,select:focus,textarea:focus{border-color:#1A56DB!important;box-shadow:0 0 0 3px #1A56DB1A!important;outline:none!important}
        button{transition:all .15s}
        button:hover:not(:disabled){opacity:.88}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#F1F5F9}
        ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:99px}
      `}</style>

      <header style={{ background:"#0B1628", borderBottom:"1px solid #1E293B", height:58, display:"flex", alignItems:"center", padding:"0 24px", gap:0, position:"sticky", top:0, zIndex:200 }}>
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
              <Icon d={n.icon} size={15} />{n.label}
            </button>
          ))}
        </nav>

        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ display:"flex", gap:12, fontSize:11 }}>
            <div style={{ color:"#64748B" }}>Hoje: <strong style={{ color:"#F8FAFC" }}>{hoje_}</strong></div>
            <div style={{ color:"#64748B" }}>Mês: <strong style={{ color:"#F8FAFC" }}>{mes_}</strong></div>
          </div>
          {loading && (
            <div style={{ display:"flex", alignItems:"center", gap:6, background:"#1A56DB18", border:"1px solid #1A56DB33", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#1A56DB", fontWeight:600 }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              Carregando…
            </div>
          )}
          {saved && !loading && (
            <div style={{ display:"flex", alignItems:"center", gap:5, background:"#0E9F6E22", border:"1px solid #0E9F6E44", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#0E9F6E", fontWeight:600 }}>
              <Icon d="M5 13l4 4L19 7" size={12} /> Salvo
            </div>
          )}
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#475569", fontFamily:"'DM Mono',monospace" }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:"#0E9F6E", boxShadow:"0 0 0 3px #0E9F6E30" }} />
            {new Date().toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}
          </div>
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              title="Painel de administração"
              style={{ display:"flex", alignItems:"center", gap:5, background:"#1A56DB18", border:"1px solid #1A56DB44", borderRadius:8, padding:"4px 10px", cursor:"pointer", color:"#1A56DB", fontSize:11, fontFamily:"inherit", fontWeight:600 }}
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Admin
            </button>
          )}
          <button
            onClick={() => supabase.auth.signOut()}
            title="Sair do sistema"
            style={{ display:"flex", alignItems:"center", gap:5, background:"transparent", border:"1px solid #1E293B", borderRadius:8, padding:"4px 10px", cursor:"pointer", color:"#64748B", fontSize:11, fontFamily:"inherit", fontWeight:600 }}
          >
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            Sair
          </button>        </div>
      </header>

      <main style={{ flex:1, padding:"24px", maxWidth:1440, width:"100%", margin:"0 auto" }}>
        {loading ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"60vh", gap:16 }}>
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#1A56DB" strokeWidth={2} style={{ animation:"spin 1s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
            <div style={{ fontSize:14, color:"#64748B", fontWeight:600 }}>Carregando dados do servidor…</div>
            <style>{"@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}"}</style>
          </div>
        ) : (
          <>
            {tab === "dashboard"     && <Dashboard    registros={registros} opcoes={opcoes} />}
            {tab === "lancamentos"   && <Lancamentos  registros={registros} setRegistros={wrap(setRegistros)} opcoes={opcoes} />}
            {tab === "fornecedores"  && <Fornecedores registros={registros} opcoes={opcoes} />}
            {tab === "configuracoes" && <Configuracoes opcoes={opcoes} setOpcoes={setOpcoes} registros={registros} setRegistros={setRegistros} />}
          </>
        )}
      </main>
    </div>
    </>
  );
};

export default Index;
