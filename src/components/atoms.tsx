import { useState, useMemo, useRef, useEffect, ReactNode, InputHTMLAttributes, SelectHTMLAttributes, CSSProperties } from "react";

// ─── ICON ─────────────────────────────────────────────────────────
export const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>
);

// ─── CHIP ─────────────────────────────────────────────────────────
export interface ChipProps { label: string; color?: string; bg?: string; size?: "sm" | "lg"; }
export const Chip = ({ label, color = "#1A56DB", bg, size = "sm" }: ChipProps) => (
  <span style={{ display:"inline-flex", alignItems:"center", padding: size === "lg" ? "4px 12px" : "2px 8px", borderRadius:99, fontSize: size === "lg" ? 12 : 11, fontWeight:700, color, background: bg || color + "1A", whiteSpace:"nowrap", letterSpacing:.2 }}>{label}</span>
);

// ─── INPUT ────────────────────────────────────────────────────────
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> { label?: string; }
export const Input = ({ label, ...props }: InputProps) => (
  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
    {label && <label style={LABEL_STYLE}>{label}</label>}
    <input {...props} style={{ border:"1.5px solid #E2E6EC", borderRadius:8, padding:"8px 11px", fontSize:13, fontFamily:"inherit", background:"#FAFBFC", width:"100%", outline:"none", transition:"border .15s", ...props.style }} />
  </div>
);

// ─── SELECT ───────────────────────────────────────────────────────
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { label?: string; children: ReactNode; }
export const Select = ({ label, children, ...props }: SelectProps) => (
  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
    {label && <label style={LABEL_STYLE}>{label}</label>}
    <select {...props} style={{ border:"1.5px solid #E2E6EC", borderRadius:8, padding:"8px 11px", fontSize:13, fontFamily:"inherit", background:"#FAFBFC", width:"100%", outline:"none", ...props.style }}>
      {children}
    </select>
  </div>
);

// ─── BTN ──────────────────────────────────────────────────────────
export type BtnVariant = "primary" | "ghost" | "danger" | "success" | "warning";
export interface BtnProps { children: ReactNode; onClick?: () => void; variant?: BtnVariant; small?: boolean; icon?: ReactNode; disabled?: boolean; full?: boolean; style?: CSSProperties; }
export const Btn = ({ children, onClick, variant = "primary", small, icon, disabled, full, style: s }: BtnProps) => {
  const V: Record<BtnVariant, { bg: string; c: string; border?: string }> = {
    primary: { bg:"#1A56DB", c:"#fff" },
    ghost:   { bg:"#F1F5F9", c:"#334155" },
    danger:  { bg:"#FDE8E8", c:"#E02424" },
    success: { bg:"#E6F9F4", c:"#0E9F6E" },
    warning: { bg:"#FEF3C7", c:"#B45309" },
  };
  const v = V[variant] || V.primary;
  return (
    <button onClick={onClick} disabled={disabled} style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6, padding: small ? "5px 11px" : "9px 16px", borderRadius:8, border: v.border || "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily:"inherit", fontWeight:600, fontSize: small ? 12 : 13, background: v.bg, color: v.c, opacity: disabled ? .5 : 1, transition:"all .15s", width: full ? "100%" : "auto", whiteSpace:"nowrap", ...s }}>
      {icon}{children}
    </button>
  );
};

// ─── MODAL ────────────────────────────────────────────────────────
export interface ModalProps { title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean; xl?: boolean; }
export const Modal = ({ title, subtitle, onClose, children, wide, xl }: ModalProps) => (
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

// ─── AUTOCOMPLETE DE NOME ─────────────────────────────────────────
export interface AutocompleteNomeProps { value: string; onChange: (val: string) => void; suggestions: string[]; placeholder?: string; style?: CSSProperties; }
export const AutocompleteNome = ({ value, onChange, suggestions, placeholder, style }: AutocompleteNomeProps) => {
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

// ─── GRID ─────────────────────────────────────────────────────────
export const G = ({ children, cols = 2 }: { children: ReactNode; cols?: number }) => {
  const cls = cols >= 4 ? "rsp-grid-4" : cols === 3 ? "rsp-grid-3" : "rsp-grid-2";
  return <div className={cls} style={{ display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`, gap:14 }}>{children}</div>;
};

// ─── LABEL_STYLE ─────────────────────────────────────────────────
/** Estilo padronizado para labels de campos. */
export const LABEL_STYLE: CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "#64748B",
  textTransform: "uppercase", letterSpacing: .7,
};

// ─── BLOCK HEADER ─────────────────────────────────────────────────
/** Cabeçalho padronizado de seção (seção, título, descrição). */
export const BlockHeader = ({ section, title, desc }: { section: string; title: string; desc?: string }) => (
  <div>
    <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, textTransform:"uppercase", letterSpacing:1 }}>{section}</div>
    <div style={{ fontSize:20, fontWeight:800, color:"#0F1C2E" }}>{title}</div>
    {desc && <div style={{ fontSize:12, color:"#64748B", marginTop:2 }}>{desc}</div>}
  </div>
);
