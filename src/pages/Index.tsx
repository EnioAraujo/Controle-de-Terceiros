import { useState, useMemo, useCallback, ReactNode, InputHTMLAttributes, SelectHTMLAttributes, CSSProperties } from "react";
import { Registro } from "@/types/attendance";

// ─── CONSTANTES ──────────────────────────────────────────────────
const TURNOS       = ["1ª TURNO", "2ª TURNO", "3ª TURNO", "INTERMEDIÁRIO"];
const UNIDADES     = ["HUB", "COD DIURNO", "COD NOTURNO", "Administrativo"];
const FORNECEDORES = ["LIDER MASTER", "TRANSLOG", "SERVILOG", "LOGFLEX", "OUTRO"];
const MOTIVOS      = ["OPERAÇÃO BAT HUB BRASIL", "REFORÇO TURNO", "COBERTURA FALTA", "PROJETO ESPECIAL", "OUTRO"];
const CARGOS       = ["AUXILIAR DE DEPÓSITO", "CONFERENTE JR", "CONFERENTE SR", "OPERADOR DE EMPILHADEIRA", "LÍDER OPERACIONAL", "SUPERVISOR", "ANALISTA", "COORDENADOR"];
const CC_LIST      = ["100001 - SOUZA CRUZ-COD", "100002 - SOUZA CRUZ-HUB", "100003 - ADMINISTRATIVO"];
const SETORES      = ["RECEBIMENTO", "EXPEDIÇÃO", "SEPARAÇÃO", "CONFERÊNCIA", "ENDEREÇAMENTO", "ADMINISTRATIVO", "PÁTIO"];

const hoje    = () => new Date().toISOString().slice(0, 10);
const fmt     = (d: string) => d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "—";
const fmtMes  = (ym: string) => { const [y, m] = ym.split("-"); return ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][+m-1] + "/" + y; };
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

// Seed
const SEED: Registro[] = [
  { id: uuid(), data: hoje(), turno: "1ª TURNO", horaEntrada: "05:20", horaSaida: "13:40", totalHoras: "08:20", nome: "WILSON CERQUEIRA", cargo: "AUXILIAR DE DEPÓSITO", setor: "RECEBIMENTO", unidade: "HUB", cc: "100002 - SOUZA CRUZ-HUB", motivo: "OPERAÇÃO BAT HUB BRASIL", fornecedor: "LIDER MASTER", obs: "" },
  { id: uuid(), data: hoje(), turno: "1ª TURNO", horaEntrada: "05:30", horaSaida: "13:50", totalHoras: "08:20", nome: "PATRICIA SOUZA LIMA", cargo: "CONFERENTE JR", setor: "EXPEDIÇÃO", unidade: "HUB", cc: "100002 - SOUZA CRUZ-HUB", motivo: "REFORÇO TURNO", fornecedor: "TRANSLOG", obs: "" },
  { id: uuid(), data: hoje(), turno: "2ª TURNO", horaEntrada: "13:50", horaSaida: "22:10", totalHoras: "08:20", nome: "ROBERTO ALVES NETO", cargo: "OPERADOR DE EMPILHADEIRA", setor: "SEPARAÇÃO", unidade: "COD DIURNO", cc: "100001 - SOUZA CRUZ-COD", motivo: "COBERTURA FALTA", fornecedor: "SERVILOG", obs: "" },
];

// ─── STORAGE ────────────────────────────────────────────────────
const useStorage = (key: string, seed: Registro[]): [Registro[], (val: Registro[]) => void] => {
  const [data, setData] = useState<Registro[]>(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : seed; }
    catch { return seed; }
  });
  const save = useCallback((val: Registro[]) => {
    setData(val);
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }, [key]);
  return [data, save];
};

// ─── UI ATOMS ────────────────────────────────────────────────────
const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
);

interface ChipProps { label: string; color?: string; bg?: string; size?: "sm" | "lg"; }
const Chip = ({ label, color = "#1A56DB", bg, size = "sm" }: ChipProps) => (
  <span style={{ display:"inline-flex", alignItems:"center", padding: size === "lg" ? "4px 12px" : "2px 8px", borderRadius:99, fontSize: size === "lg" ? 12 : 11, fontWeight:700, color, background: bg || color + "1A", whiteSpace:"nowrap", letterSpacing:.2 }}>{label}</span>
);

const Badge = ({ n, color = "#E02424" }: { n: number; color?: string }) => n > 0 ? (
  <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:18, height:18, borderRadius:"50%", background:color, color:"#fff", fontSize:10, fontWeight:800, marginLeft:4 }}>{n}</span>
) : null;

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
interface BtnProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  small?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
  full?: boolean;
  style?: CSSProperties;
}
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

// ─── FORM DE LANÇAMENTO ─────────────────────────────────────────
interface PessoaRow { nome: string; horaEntrada: string; horaSaida: string; }
interface FormLancamentoProps { inicial?: Registro | null; onSave: (registros: Registro[]) => void; onCancel: () => void; }

const FormLancamento = ({ inicial, onSave, onCancel }: FormLancamentoProps) => {
  const isEdit = !!inicial;

  const [comum, setComum] = useState({
    data:       inicial?.data       || hoje(),
    turno:      inicial?.turno      || TURNOS[0],
    horaEntrada: inicial?.horaEntrada || "05:00",
    horaSaida:  inicial?.horaSaida  || "13:20",
    cargo:      inicial?.cargo      || CARGOS[0],
    setor:      inicial?.setor      || SETORES[0],
    unidade:    inicial?.unidade    || UNIDADES[0],
    cc:         inicial?.cc         || CC_LIST[0],
    motivo:     inicial?.motivo     || MOTIVOS[0],
    fornecedor: inicial?.fornecedor || FORNECEDORES[0],
    obs:        inicial?.obs        || "",
  });

  const [pessoas, setPessoas] = useState<PessoaRow[]>([
    { nome: inicial?.nome || "", horaEntrada: inicial?.horaEntrada || "05:00", horaSaida: inicial?.horaSaida || "13:20" }
  ]);

  // Atualiza campo comum; se for horaEntrada/horaSaida propaga para linhas que ainda usam o valor anterior
  const setC = (k: string, v: string) => {
    setComum(prev => {
      if (k === "horaEntrada") setPessoas(ps => ps.map(p => p.horaEntrada === prev.horaEntrada ? { ...p, horaEntrada: v } : p));
      if (k === "horaSaida")   setPessoas(ps => ps.map(p => p.horaSaida   === prev.horaSaida   ? { ...p, horaSaida: v }   : p));
      return { ...prev, [k]: v };
    });
  };

  // Ajusta quantidade de linhas
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
      onSave(pessoas
        .filter(p => p.nome.trim().length > 2)
        .map(p => ({ id: uuid(), ...comum, nome: p.nome.trim(), horaEntrada: p.horaEntrada, horaSaida: p.horaSaida, totalHoras: calcHoras(p.horaEntrada, p.horaSaida) }))
      );
    }
  };

  const G = ({ children, cols = 2 }: { children: ReactNode; cols?: number }) => (
    <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`, gap:14 }}>{children}</div>
  );

  const totalPadrao = calcHoras(comum.horaEntrada, comum.horaSaida);
  const btnLabel = isEdit ? "Salvar Alterações" : validCount > 1 ? `Salvar ${validCount} Lançamentos` : "Salvar Lançamento";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Bloco 0 — Quantidade (apenas no modo novo) */}
      {!isEdit && (
        <div style={{ background:"#F0F6FF", border:"1.5px solid #BFDBFE", borderRadius:12, padding:"12px 18px", display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#1A56DB", textTransform:"uppercase", letterSpacing:.8 }}>Quantidade de Pessoas</div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <button onClick={() => handleQtd(pessoas.length - 1)}
              style={{ width:28, height:28, borderRadius:7, border:"1.5px solid #BFDBFE", background:"#fff", cursor:"pointer", fontWeight:800, fontSize:15, color:"#1A56DB", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}>−</button>
            <input type="number" min={1} max={20} value={pessoas.length}
              onChange={e => handleQtd(Number(e.target.value))}
              style={{ width:48, textAlign:"center", border:"1.5px solid #BFDBFE", borderRadius:7, padding:"5px 6px", fontSize:15, fontWeight:800, color:"#1A56DB", fontFamily:"inherit", background:"#fff", outline:"none" }} />
            <button onClick={() => handleQtd(pessoas.length + 1)}
              style={{ width:28, height:28, borderRadius:7, border:"none", background:"#1A56DB", cursor:"pointer", fontWeight:800, fontSize:15, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", lineHeight:1 }}>+</button>
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
          <Select label="Cargo" value={comum.cargo} onChange={e => setC("cargo", e.target.value)}>{CARGOS.map(c => <option key={c}>{c}</option>)}</Select>
          <Select label="Fornecedor" value={comum.fornecedor} onChange={e => setC("fornecedor", e.target.value)}>{FORNECEDORES.map(c => <option key={c}>{c}</option>)}</Select>
        </G>
      </div>

      {/* Bloco 2 — Lotação */}
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textTransform:"uppercase", letterSpacing:1, marginBottom:12, display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:20, height:20, borderRadius:6, background:"#0E9F6E", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#fff", fontWeight:800 }}>2</div>
          Lotação
        </div>
        <G cols={3}>
          <Select label="Unidade" value={comum.unidade} onChange={e => setC("unidade", e.target.value)}>{UNIDADES.map(c => <option key={c}>{c}</option>)}</Select>
          <Select label="Setor" value={comum.setor} onChange={e => setC("setor", e.target.value)}>{SETORES.map(c => <option key={c}>{c}</option>)}</Select>
          <Select label="Centro de Custo" value={comum.cc} onChange={e => setC("cc", e.target.value)}>{CC_LIST.map(c => <option key={c}>{c}</option>)}</Select>
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
          <Select label="Turno" value={comum.turno} onChange={e => setC("turno", e.target.value)}>{TURNOS.map(c => <option key={c}>{c}</option>)}</Select>
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
          <Select label="Motivo" value={comum.motivo} onChange={e => setC("motivo", e.target.value)}>{MOTIVOS.map(c => <option key={c}>{c}</option>)}</Select>
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
          {/* Cabeçalho */}
          <div style={{ display:"grid", gridTemplateColumns:"36px 1fr 124px 124px 72px", background:"#F8FAFC", borderBottom:"1px solid #E2E6EC", padding:"9px 14px", gap:8 }}>
            {["#", "Nome Completo *", "Hora Entrada", "Hora Saída", "Total"].map(h => (
              <div key={h} style={{ fontSize:10, fontWeight:700, color:"#64748B", textTransform:"uppercase", letterSpacing:.6 }}>{h}</div>
            ))}
          </div>
          {/* Linhas */}
          {pessoas.map((p, i) => {
            const total = calcHoras(p.horaEntrada, p.horaSaida);
            return (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"36px 1fr 124px 124px 72px", gap:8, padding:"8px 14px", borderBottom: i < pessoas.length - 1 ? "1px solid #F1F5F9" : "none", alignItems:"center", background: i % 2 === 0 ? "#fff" : "#FAFBFC" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#94A3B8", textAlign:"center" }}>{i + 1}</div>
                <input value={p.nome} onChange={e => setP(i, "nome", e.target.value.toUpperCase())} placeholder="NOME COMPLETO"
                  style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"7px 10px", fontSize:12, fontFamily:"inherit", background:"#FAFBFC", width:"100%", outline:"none", fontWeight:600 }} />
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

const Lancamentos = ({ registros, setRegistros }: { registros: Registro[]; setRegistros: (val: Registro[]) => void }) => {
  const [filtros, setFiltros] = useState<Filtros>({ data: hoje(), turno: "", fornecedor: "", unidade: "", setor: "", busca: "" });
  const [modal, setModal]     = useState<null | "new" | Registro>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<Registro | null>(null);

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

  const salvar = (novos: Registro[]) => {
    if (modal === "new") setRegistros([...registros, ...novos]);
    else setRegistros(registros.map(r => r.id === novos[0].id ? novos[0] : r));
    setModal(null);
  };

  const excluir = (id: string) => { setRegistros(registros.filter(r => r.id !== id)); setConfirm(null); };

  const exportCSV = () => {
    const h = ["Data","Turno","Hora Entrada","Hora Saída","Total Horas","Nome","Cargo","Setor","Unidade","CC","Motivo","Fornecedor","Obs"];
    const rows = filtered.map(r => [r.data,r.turno,r.horaEntrada,r.horaSaida,r.totalHoras,r.nome,r.cargo,r.setor||"",r.unidade,r.cc,r.motivo,r.fornecedor,r.obs].join(";"));
    const blob = new Blob([[h.join(";"), ...rows].join("\n")], { type:"text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `terceiros_${filtros.data || "todos"}.csv`; a.click();
  };

  const FORN_CORES: Record<string, string> = { "LIDER MASTER":"#D97706", "TRANSLOG":"#1A56DB", "SERVILOG":"#0E9F6E", "LOGFLEX":"#6C63FF", "OUTRO":"#64748B" };

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
          <option value="">Todos</option>{TURNOS.map(t => <option key={t}>{t}</option>)}
        </Select>
        <Select label="Fornecedor" value={filtros.fornecedor} onChange={e => set("fornecedor", e.target.value)} style={{ width:150 }}>
          <option value="">Todos</option>{FORNECEDORES.map(t => <option key={t}>{t}</option>)}
        </Select>
        <Select label="Unidade" value={filtros.unidade} onChange={e => set("unidade", e.target.value)} style={{ width:150 }}>
          <option value="">Todas</option>{UNIDADES.map(t => <option key={t}>{t}</option>)}
        </Select>
        <Select label="Setor" value={filtros.setor} onChange={e => set("setor", e.target.value)} style={{ width:150 }}>
          <option value="">Todos</option>{SETORES.map(t => <option key={t}>{t}</option>)}
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
              {filtered.length === 0 && (
                <tr><td colSpan={12} style={{ textAlign:"center", padding:48, color:"#94A3B8" }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>📋</div>
                  Nenhum registro encontrado
                </td></tr>
              )}
              {filtered.map((r, i) => (
                <tr key={r.id} style={{ borderBottom:"1px solid #F1F5F9", background: i % 2 === 0 ? "#fff" : "#FAFBFC", cursor:"pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#F0F6FF")}
                  onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#FAFBFC")}>
                  <td style={{ padding:"10px 12px", fontFamily:"monospace", fontSize:11, color:"#64748B" }}>{fmt(r.data)}</td>
                  <td style={{ padding:"10px 12px" }}><Chip label={r.turno} color="#1A56DB" /></td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ fontWeight:700, color:"#0F1C2E", whiteSpace:"nowrap" }}>{r.nome}</div>
                  </td>
                  <td style={{ padding:"10px 12px", color:"#475569", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.cargo}</td>
                  <td style={{ padding:"10px 12px" }}><Chip label={r.fornecedor} color={FORN_CORES[r.fornecedor] || "#64748B"} /></td>
                  <td style={{ padding:"10px 12px" }}><Chip label={r.setor || "—"} color="#6C63FF" /></td>
                  <td style={{ padding:"10px 12px" }}><Chip label={r.unidade} color="#0E9F6E" /></td>
                  <td style={{ padding:"10px 12px", fontFamily:"monospace", color:"#475569" }}>{r.horaEntrada}</td>
                  <td style={{ padding:"10px 12px", fontFamily:"monospace", color:"#475569" }}>{r.horaSaida}</td>
                  <td style={{ padding:"10px 12px", fontFamily:"monospace", fontWeight:800, color:"#0E9F6E" }}>{r.totalHoras}</td>
                  <td style={{ padding:"10px 12px", color:"#64748B", maxWidth:150, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.motivo}</td>
                  <td style={{ padding:"10px 12px" }}>
                    <div style={{ display:"flex", gap:5 }}>
                      <button onClick={() => setDetalhe(r)} title="Ver detalhes" style={{ background:"#F1F5F9", border:"none", borderRadius:6, padding:"5px 8px", cursor:"pointer", color:"#64748B", display:"flex" }}><Icon d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" size={14} /></button>
                      <button onClick={() => setModal(r)} title="Editar" style={{ background:"#EBF0FD", border:"none", borderRadius:6, padding:"5px 8px", cursor:"pointer", color:"#1A56DB", display:"flex" }}><Icon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={14} /></button>
                      <button onClick={() => setConfirm(r.id)} title="Excluir" style={{ background:"#FDE8E8", border:"none", borderRadius:6, padding:"5px 8px", cursor:"pointer", color:"#E02424", display:"flex" }}><Icon d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modais */}
      {modal && (
        <Modal title={modal === "new" ? "Novo Lançamento" : "Editar Lançamento"} subtitle="Controle de Terceiros" onClose={() => setModal(null)} xl>
          <FormLancamento inicial={modal === "new" ? null : modal as Registro} onSave={salvar} onCancel={() => setModal(null)} />
        </Modal>
      )}

      {detalhe && (
        <Modal title="Detalhes do Lançamento" subtitle={detalhe.nome} onClose={() => setDetalhe(null)} wide>
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
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:16, paddingTop:16, borderTop:"1px solid #F1F5F9" }}>
            <Btn variant="ghost" onClick={() => setDetalhe(null)}>Fechar</Btn>
            <Btn onClick={() => { setModal(detalhe); setDetalhe(null); }}>Editar</Btn>
          </div>
        </Modal>
      )}

      {confirm && (
        <Modal title="Confirmar exclusão" onClose={() => setConfirm(null)}>
          <p style={{ color:"#475569", fontSize:13, lineHeight:1.6 }}>Tem certeza que deseja excluir este lançamento? Esta ação não poderá ser desfeita.</p>
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
const Dashboard = ({ registros }: { registros: Registro[] }) => {
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
    doMes.forEach(r => { m[r.fornecedor] = (m[r.fornecedor] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [doMes]);

  const porSetor = useMemo(() => {
    const m: Record<string, number> = {};
    doMes.forEach(r => { const k = r.setor || "SEM SETOR"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [doMes]);

  const porTurno = useMemo(() => {
    const m: Record<string, number> = {};
    doMes.forEach(r => { m[r.turno] = (m[r.turno] || 0) + 1; });
    return Object.entries(m);
  }, [doMes]);

  const porDia = useMemo(() => {
    const m: Record<string, number> = {};
    doMes.forEach(r => { m[r.data] = (m[r.data] || 0) + 1; });
    return Object.entries(m).sort((a, b) => a[0] > b[0] ? 1 : -1).slice(-15);
  }, [doMes]);

  const maxDia = Math.max(...porDia.map(([, v]) => v), 1);
  const FORN_CORES = ["#1A56DB","#0E9F6E","#D97706","#6C63FF","#E02424","#0891B2"];

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

      {/* KPIs */}
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
        {/* Por Fornecedor */}
        <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:16, color:"#0F1C2E" }}>Registros por Fornecedor</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {porFornecedor.length === 0 && <div style={{ color:"#94A3B8", fontSize:12, textAlign:"center", padding:20 }}>Sem dados no período</div>}
            {porFornecedor.map(([forn, n], i) => {
              const pct = doMes.length ? (n / doMes.length * 100) : 0;
              const cor = FORN_CORES[i % FORN_CORES.length];
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

        {/* Por Setor */}
        <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
          <div style={{ fontWeight:700, fontSize:13, marginBottom:16, color:"#0F1C2E" }}>Registros por Setor</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {porSetor.length === 0 && <div style={{ color:"#94A3B8", fontSize:12, textAlign:"center", padding:20 }}>Sem dados no período</div>}
            {porSetor.map(([setor, n], i) => {
              const pct = doMes.length ? (n / doMes.length * 100) : 0;
              const cor = FORN_CORES[(i + 2) % FORN_CORES.length];
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

      {/* Volume por dia */}
      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:16, color:"#0F1C2E" }}>Volume Diário — últimos 15 dias do período</div>
        {porDia.length === 0
          ? <div style={{ color:"#94A3B8", fontSize:12, textAlign:"center", padding:24 }}>Sem dados no período selecionado</div>
          : (
            <div style={{ display:"flex", gap:6, alignItems:"flex-end", height:120 }}>
              {porDia.map(([data, n]) => {
                const h = Math.max((n / maxDia) * 100, 6);
                const isHoje = data === hoje();
                return (
                  <div key={data} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <div style={{ fontSize:10, fontWeight:700, color: isHoje ? "#1A56DB" : "#94A3B8" }}>{n}</div>
                    <div style={{ width:"100%", height:`${h}%`, background: isHoje ? "#1A56DB" : "#E2E6EC", borderRadius:"4px 4px 0 0", minHeight:4, transition:"height .4s" }} />
                    <div style={{ fontSize:9, color: isHoje ? "#1A56DB" : "#94A3B8", fontFamily:"monospace", fontWeight: isHoje ? 700 : 400 }}>
                      {data.slice(8)}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>

      {/* Por turno */}
      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ fontWeight:700, fontSize:13, marginBottom:14, color:"#0F1C2E" }}>Distribuição por Turno</div>
        <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
          {TURNOS.map((t, i) => {
            const n = doMes.filter(r => r.turno === t).length;
            const pct = doMes.length ? (n / doMes.length * 100).toFixed(0) : 0;
            const cor = FORN_CORES[i % FORN_CORES.length];
            return (
              <div key={t} style={{ flex:1, minWidth:120, background: cor + "0F", border:`1.5px solid ${cor}33`, borderRadius:10, padding:"12px 16px" }}>
                <div style={{ fontSize:11, color:cor, fontWeight:700, marginBottom:6 }}>{t}</div>
                <div style={{ fontSize:24, fontWeight:800, color:cor }}>{n}</div>
                <div style={{ fontSize:11, color:"#94A3B8", marginTop:2 }}>{pct}% do mês</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── TELA: FORNECEDORES ─────────────────────────────────────────
const Fornecedores = ({ registros }: { registros: Registro[] }) => {
  const resumo = useMemo(() => {
    return FORNECEDORES.map(forn => {
      const regs    = registros.filter(r => r.fornecedor === forn);
      const hoje_   = regs.filter(r => r.data === hoje()).length;
      const mes_    = regs.filter(r => r.data.startsWith(mesAtual())).length;
      const mins    = regs.reduce((acc, r) => { if (!r.totalHoras) return acc; const [h, m] = r.totalHoras.split(":").map(Number); return acc + h * 60 + m; }, 0);
      const horas   = `${Math.floor(mins / 60)}h ${mins % 60}min`;
      const setores = [...new Set(regs.map(r => r.setor).filter(Boolean))];
      const ultimos = [...regs].sort((a, b) => a.data > b.data ? -1 : 1).slice(0, 5);
      return { forn, total: regs.length, hoje: hoje_, mes: mes_, horas, setores, ultimos };
    }).filter(f => f.total > 0);
  }, [registros]);

  const FORN_CORES: Record<string, string> = { "LIDER MASTER":"#D97706", "TRANSLOG":"#1A56DB", "SERVILOG":"#0E9F6E", "LOGFLEX":"#6C63FF", "OUTRO":"#64748B" };

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
          const cor = FORN_CORES[forn] || "#64748B";
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

// ═══════════════════════════════════════════════════════════════
// INDEX (APP ROOT)
// ═══════════════════════════════════════════════════════════════
type TabId = "dashboard" | "lancamentos" | "fornecedores";
interface NavItem { id: TabId; label: string; icon: string; }

const Index = () => {
  const [tab, setTab]               = useState<TabId>("lancamentos");
  const [registros, setRegistros]   = useStorage("ct-registros-v1", SEED);
  const [saved, setSaved]           = useState(false);

  const wrap = (fn: (val: Registro[]) => void) => (val: Registro[]) => {
    fn(val);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const hoje_ = registros.filter(r => r.data === hoje()).length;
  const mes_  = registros.filter(r => r.data.startsWith(mesAtual())).length;

  const NAV: NavItem[] = [
    { id: "dashboard",    label: "Dashboard",    icon: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" },
    { id: "lancamentos",  label: "Lançamentos",  icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" },
    { id: "fornecedores", label: "Fornecedores", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  ];

  // Avoid unused import warning
  void Badge;

  return (
    <div style={{ minHeight:"100vh", background:"#F0F2F5", fontFamily:"'DM Sans',system-ui,sans-serif", display:"flex", flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box}
        input:focus,select:focus{border-color:#1A56DB!important;box-shadow:0 0 0 3px #1A56DB1A!important;outline:none!important}
        button{transition:all .15s}
        button:hover:not(:disabled){opacity:.88}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#F1F5F9}
        ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:99px}
      `}</style>

      {/* TOP BAR */}
      <header style={{ background:"#0B1628", borderBottom:"1px solid #1E293B", height:58, display:"flex", alignItems:"center", padding:"0 24px", gap:0, position:"sticky", top:0, zIndex:200 }}>
        {/* Logo */}
        <div style={{ display:"flex", alignItems:"center", gap:10, paddingRight:28, borderRight:"1px solid #1E293B", marginRight:20 }}>
          <div style={{ width:34, height:34, background:"linear-gradient(135deg,#1A56DB,#3B82F6)", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Icon d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM18.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" size={18} />
          </div>
          <div>
            <div style={{ color:"#F8FAFC", fontWeight:800, fontSize:14, letterSpacing:-.4, lineHeight:1.1 }}>Controle de</div>
            <div style={{ color:"#3B82F6", fontWeight:800, fontSize:14, letterSpacing:-.4, lineHeight:1.1 }}>Terceiros</div>
          </div>
        </div>

        {/* Nav */}
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

        {/* Status bar */}
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <div style={{ display:"flex", gap:12, fontSize:11 }}>
            <div style={{ color:"#64748B" }}>Hoje: <strong style={{ color:"#F8FAFC" }}>{hoje_}</strong></div>
            <div style={{ color:"#64748B" }}>Mês: <strong style={{ color:"#F8FAFC" }}>{mes_}</strong></div>
          </div>
          {saved && (
            <div style={{ display:"flex", alignItems:"center", gap:5, background:"#0E9F6E22", border:"1px solid #0E9F6E44", borderRadius:8, padding:"4px 10px", fontSize:11, color:"#0E9F6E", fontWeight:600 }}>
              <Icon d="M5 13l4 4L19 7" size={12} /> Salvo
            </div>
          )}
          <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"#475569", fontFamily:"'DM Mono',monospace" }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:"#0E9F6E", boxShadow:"0 0 0 3px #0E9F6E30" }} />
            {new Date().toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" })}
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main style={{ flex:1, padding:"24px", maxWidth:1440, width:"100%", margin:"0 auto" }}>
        {tab === "dashboard"    && <Dashboard   registros={registros} />}
        {tab === "lancamentos"  && <Lancamentos registros={registros} setRegistros={wrap(setRegistros)} />}
        {tab === "fornecedores" && <Fornecedores registros={registros} />}
      </main>
    </div>
  );
};

export default Index;
