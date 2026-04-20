import { useState, useEffect, CSSProperties } from "react";
import type { Registro } from "@/types/attendance";
import type { Opcoes } from "@/types/attendance";
import { sanitize, logAudit } from "@/lib/audit";
import {
  buildWhatsAppMessage, WHATSAPP_FIELDS, WA_DEFAULT_TEMPLATE, KEY_TO_FIELD,
} from "@/lib/format-utils";
import type { WhatsAppTemplate, WhatsAppField } from "@/lib/format-utils";
import { dbToTurnoConfig, dbToDiariaConfig, dbToTurnoCapacidade, turnoCapacidadeToDb } from "@/lib/fechamento-utils";
import type { TurnoConfig, DiariaConfig, TurnoCapacidade } from "@/lib/fechamento-utils";
import { useI18n } from "@/hooks/use-i18n";
import { supabase, authReady } from "@/lib/supabase";
import { Icon, BlockHeader } from "@/components/atoms";
import { fmt } from "@/lib/format-utils";

export const OPCOES_CONFIG: { key: keyof Omit<Opcoes, "nomes">; label: string; cor: string }[] = [
  { key: "turnos",       label: "Turnos",          cor: "#1A56DB" },
  { key: "unidades",     label: "Unidades",         cor: "#0E9F6E" },
  { key: "fornecedores", label: "Fornecedores",     cor: "#D97706" },
  { key: "motivos",      label: "Motivos",          cor: "#6C63FF" },
  { key: "cargos",       label: "Cargos",           cor: "#E02424" },
  { key: "ccList",       label: "Centros de Custo", cor: "#0891B2" },
];

interface ConfiguracoesProps {
  opcoes: Opcoes;
  setOpcoes: (val: Opcoes) => void;
  registros: Registro[];
  setRegistros: (val: Registro[]) => void;
  isAdmin: boolean;
  isAdminOrMod: boolean;
  setWaTemplate: (t: WhatsAppTemplate) => void;
  capacidadeConfig: TurnoCapacidade[];
  setCapacidadeConfig: (val: TurnoCapacidade[]) => void;
}

export const Configuracoes = ({
  opcoes,
  setOpcoes,
  registros,
  setRegistros,
  isAdmin,
  isAdminOrMod,
  setWaTemplate,
  capacidadeConfig,
  setCapacidadeConfig,
}: ConfiguracoesProps) => {
  const { t, lang } = useI18n();
  type OpcKey = keyof Opcoes;
  const [inputs, setInputs] = useState<Record<OpcKey, string>>({
    turnos: "", unidades: "", fornecedores: "", motivos: "", cargos: "", ccList: "", nomes: ""
  });
  const [nomesBulk, setNomesBulk] = useState("");
  const [nomeBusca, setNomeBusca] = useState("");
  const [bulkFeedback, setBulkFeedback] = useState("");

  const emptyByKey = { turnos: "", unidades: "", fornecedores: "", motivos: "", cargos: "", ccList: "", nomes: "" };
  const [editing, setEditing] = useState<{ key: OpcKey; idx: number; value: string } | null>(null);
  const [cardSearch, setCardSearch] = useState<Record<OpcKey, string>>(emptyByKey);
  const [bulkCategory, setBulkCategory] = useState<OpcKey>("nomes");

  // ── Config de Turnos ──
  const [turnosConfig, setTurnosConfig] = useState<TurnoConfig[]>([]);
  const [turnosConfigSaved, setTurnosConfigSaved] = useState(false);

  // ── Config de Diárias ──
  const [diariasConfig, setDiariasConfig] = useState<DiariaConfig[]>([]);
  const [newDiaria, setNewDiaria] = useState({ fornecedor: "", turno: "", valor: "250", vigenciaInicio: "", vigenciaFim: "" });

  // ── Capacidade por Turno ──
  const [newCapacidade, setNewCapacidade] = useState({ turno: "", qtdPadrao: "10", vigenciaInicio: "", vigenciaFim: "" });
  const [capacidadeSaved, setCapacidadeSaved] = useState(false);

  useEffect(() => {
    authReady.then(async () => {
      const { data: tData, error: tErr } = await supabase.from("turnos_config").select("*").order("turno");
      if (tErr) console.error("Erro ao carregar turnos_config:", tErr.message);
      if (tData) setTurnosConfig(tData.map(dbToTurnoConfig));
      const { data: dData, error: dErr } = await supabase.from("diarias_config").select("*").order("fornecedor");
      if (dErr) console.error("Erro ao carregar diarias_config:", dErr.message);
      if (dData) setDiariasConfig(dData.map(dbToDiariaConfig));
    }).catch((err: unknown) => console.error("Erro ao carregar configs:", err));
  }, []);

  const saveTurnosConfig = async () => {
    let hasError = false;
    for (const tc of turnosConfig) {
      const { error } = await supabase.from("turnos_config").upsert({
        turno: tc.turno,
        hora_inicio: tc.horaInicio,
        hora_fim: tc.horaFim,
        hora_padrao: tc.horaPadrao,
      }, { onConflict: "turno" });
      if (error) { console.error("Erro ao salvar turno:", error.message); hasError = true; }
    }
    if (!hasError) {
      setTurnosConfigSaved(true);
      setTimeout(() => setTurnosConfigSaved(false), 2000);
    }
  };

  const addDiaria = async () => {
    const forn = newDiaria.fornecedor.trim();
    const turno = newDiaria.turno.trim() || null;
    const valor = parseFloat(newDiaria.valor);
    const vigIni = newDiaria.vigenciaInicio.trim() || null;
    const vigFim = newDiaria.vigenciaFim.trim() || null;
    if (!forn || isNaN(valor)) return;
    if (vigIni && vigFim && vigFim < vigIni) return;
    const { data, error } = await supabase.from("diarias_config")
      .insert({ fornecedor: forn, turno, valor_diaria: valor, vigencia_inicio: vigIni, vigencia_fim: vigFim })
      .select();
    if (!error && data) {
      const updated = data.map(dbToDiariaConfig);
      setDiariasConfig(prev =>
        [...prev, ...updated].sort((a, b) => a.fornecedor.localeCompare(b.fornecedor)),
      );
      setNewDiaria({ fornecedor: "", turno: "", valor: "250", vigenciaInicio: "", vigenciaFim: "" });
    } else if (error) {
      if (import.meta.env.DEV) console.error("Erro ao salvar diária:", error.message);
    }
  };

  const removeDiaria = async (d: DiariaConfig) => {
    if (!d.id) return;
    const { error } = await supabase.from("diarias_config").delete().eq("id", d.id);
    if (error) { if (import.meta.env.DEV) console.error("Erro ao remover diária:", error.message); return; }
    setDiariasConfig(prev => prev.filter(x => x.id !== d.id));
  };

  const addCapacidade = async () => {
    const turno = newCapacidade.turno.trim();
    const qtd = parseInt(newCapacidade.qtdPadrao, 10);
    const ini = newCapacidade.vigenciaInicio;
    const fim = newCapacidade.vigenciaFim;
    if (!turno || isNaN(qtd) || qtd <= 0 || !ini || !fim || fim < ini) return;
    const payload = turnoCapacidadeToDb({ turno, qtdPadrao: qtd, vigenciaInicio: ini, vigenciaFim: fim });
    const { data, error } = await supabase.from("turnos_capacidade").insert(payload).select();
    if (error) { if (import.meta.env.DEV) console.error("Erro ao salvar capacidade:", error.message); return; }
    if (data) {
      const novas = data.map(dbToTurnoCapacidade);
      setCapacidadeConfig([...capacidadeConfig, ...novas].sort((a, b) => a.turno.localeCompare(b.turno) || a.vigenciaInicio.localeCompare(b.vigenciaInicio)));
      setNewCapacidade({ turno: "", qtdPadrao: "10", vigenciaInicio: "", vigenciaFim: "" });
      setCapacidadeSaved(true);
      setTimeout(() => setCapacidadeSaved(false), 2000);
    }
  };

  const removeCapacidade = async (c: TurnoCapacidade) => {
    if (!c.id) return;
    const { error } = await supabase.from("turnos_capacidade").delete().eq("id", c.id);
    if (error) { if (import.meta.env.DEV) console.error("Erro ao remover capacidade:", error.message); return; }
    setCapacidadeConfig(prev => prev.filter(x => x.id !== c.id));
    logAudit("DELETE", "turnos_capacidade", c.id, { turno: c.turno });
  };

  // ── WhatsApp Template ──
  const [waHeader, setWaHeader] = useState(WA_DEFAULT_TEMPLATE.header);
  const [waCampos, setWaCampos] = useState<WhatsAppField[]>(WA_DEFAULT_TEMPLATE.campos);
  const [waSaved, setWaSaved]       = useState(false);
  const [waSaveError, setWaSaveError] = useState("");
  const [waDragOver, setWaDragOver] = useState<WhatsAppField | null>(null);

  useEffect(() => {
    authReady.then(async () => {
      const { data } = await supabase.from("opcoes").select("valor").eq("chave", "whatsapp_template").maybeSingle();
      if (data?.valor) {
        try {
          const parsed = JSON.parse(data.valor) as { header?: string; campos?: WhatsAppField[] };
          if (parsed.header) setWaHeader(parsed.header);
          if (Array.isArray(parsed.campos) && parsed.campos.length > 0) setWaCampos(parsed.campos);
        } catch { /* ignore bad JSON */ }
      }
    }).catch((err: unknown) => { if (import.meta.env.DEV) console.error("Erro ao carregar WA template:", err); });
  }, []);

  const saveWaTemplate = async () => {
    const payload: WhatsAppTemplate = { header: waHeader.trim() || WA_DEFAULT_TEMPLATE.header, campos: waCampos };
    const valor = JSON.stringify(payload);
    setWaSaveError("");
    const { error: delErr } = await supabase.from("opcoes").delete().eq("chave", "whatsapp_template");
    if (delErr) { setWaSaveError("Erro ao salvar. Tente novamente."); return; }
    const { error: insErr } = await supabase.from("opcoes").insert({ chave: "whatsapp_template", valor });
    if (insErr) { setWaSaveError("Erro ao salvar. Tente novamente."); return; }
    setWaTemplate(payload);
    setWaSaved(true);
    setTimeout(() => setWaSaved(false), 2500);
  };

  const toggleWaCampo = (key: WhatsAppField) => {
    setWaCampos(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  // ── DPO (Art. 41 LGPD)
  const [dpoNome,       setDpoNome]       = useState("");
  const [dpoEmail,      setDpoEmail]      = useState("");
  const [dpoTelefone,   setDpoTelefone]   = useState("");
  const [dpoSaved,      setDpoSaved]      = useState(false);

  const setDpoNomeSafe     = (v: string) => setDpoNome(sanitize(v));
  const setDpoEmailSafe    = (v: string) => setDpoEmail(sanitize(v));
  const setDpoTelefoneSafe = (v: string) => setDpoTelefone(sanitize(v));

  useEffect(() => {
    authReady.then(async () => {
      const { data, error } = await supabase
        .from("opcoes")
        .select("chave, valor")
        .in("chave", ["dpo_nome", "dpo_email", "dpo_telefone"]);
      if (error) { if (import.meta.env.DEV) console.error("Erro ao carregar DPO:", error.message); return; }
      if (data) {
        data.forEach((row: { chave: string; valor: string }) => {
          if (row.chave === "dpo_nome")      setDpoNome(row.valor);
          if (row.chave === "dpo_email")     setDpoEmail(row.valor);
          if (row.chave === "dpo_telefone")  setDpoTelefone(row.valor);
        });
      }
    }).catch((err: unknown) => { if (import.meta.env.DEV) console.error("Erro ao carregar DPO:", err); });
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
    const q = sanitize(titularNome.trim().toUpperCase());
    if (!q) return;
    setTitularResult(registros.filter(r => r.nome === q));
    setExclusaoConfirm(false);
    setExclusaoFeedback("");
  };

  const excluirTitular = () => {
    const q = sanitize(titularNome.trim().toUpperCase());
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
    const v = sanitize(value.trim().toUpperCase());
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
    const v = sanitize(newValue.trim().toUpperCase());
    const oldValue = opcoes[key][idx];
    setEditing(null);
    if (!v || v === oldValue) return;
    if (opcoes[key].includes(v)) return;
    const arr = [...opcoes[key]];
    arr[idx] = v;
    setOpcoes({ ...opcoes, [key]: arr });
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
      nomesBulk.split("\n").map(n => sanitize(n.trim().toUpperCase())).filter(n => n.length > 0)
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
        <BlockHeader section={t("cfg_section")} title={t("cfg_title")} />
        <div style={{ fontSize:12, color:"#64748B", marginTop:4 }}>{t("cfg_desc")}</div>
      </div>

      {/* Grade de listas de opções — CRUD completo */}
      {isAdminOrMod && <div className="rsp-grid-autofill" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:14 }}>
        {OPCOES_CONFIG.map(({ key, cor }) => {
          const items = opcoes[key];
          const search = cardSearch[key];
          const filtered = search ? items.filter(v => v.toLowerCase().includes(search.toLowerCase())) : items;
          return (
          <div key={key} style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:18, display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:cor, flexShrink:0 }} />
              <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E" }}>{t(("cfg_opt_" + key) as Parameters<typeof t>[0])}</div>
              <div style={{ marginLeft:"auto", fontSize:11, background:cor + "18", color:cor, fontWeight:700, borderRadius:99, padding:"2px 8px" }}>{items.length}</div>
            </div>

            {items.length > 3 && (
              <input value={search} onChange={e => setCardSearch(p => ({ ...p, [key]: e.target.value }))}
                placeholder={t("cfg_opt_search")}
                style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"5px 10px", fontSize:11, fontFamily:"inherit", outline:"none", background:"#FAFBFC" }} />
            )}

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
      </div>}

      {/* Base de Nomes */}
      <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#334155", flexShrink:0 }} />
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E" }}>{t("cfg_nomes_title")}</div>
          <div style={{ fontSize:11, background:"#33415518", color:"#334155", fontWeight:700, borderRadius:99, padding:"2px 8px" }}>{opcoes.nomes.length} nomes</div>
          <div style={{ fontSize:12, color:"#94A3B8", marginLeft:4 }}>{t("cfg_nomes_desc")}</div>
        </div>

        <div className="rsp-grid-2" style={{ display:"grid", gridTemplateColumns: isAdminOrMod ? "1fr 1fr" : "1fr", gap:20 }}>
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

          {isAdminOrMod && <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
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
          </div>}
        </div>
      </div>

      {/* ── Horas Padrão por Turno ── */}
      {isAdminOrMod && <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
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
      </div>}

      {/* ── Valor das Diárias por Fornecedor + Turno ── */}
      {isAdminOrMod && <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#D97706", flexShrink:0 }} />
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E" }}>{t("cfg_diarias_title")}</div>
        </div>
        <div style={{ fontSize:12, color:"#64748B", marginBottom:14, paddingLeft:20 }}>
          {t("cfg_diarias_desc")} <span style={{ color:"#94A3B8" }}>{t("cfg_diarias_padrao")}</span>
        </div>

        {diariasConfig.length > 0 && (
          <div style={{ overflowX:"auto", marginBottom:14 }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ background:"#F8FAFC", borderBottom:"1px solid #E2E6EC" }}>
                  <th style={{ textAlign:"left", padding:"8px 10px", fontWeight:700, color:"#475569" }}>{t("cfg_diarias_forn")}</th>
                  <th style={{ textAlign:"left", padding:"8px 10px", fontWeight:700, color:"#475569" }}>{t("cfg_diarias_turno")}</th>
                  <th style={{ textAlign:"right", padding:"8px 10px", fontWeight:700, color:"#475569" }}>{t("cfg_diarias_valor")}</th>
                  <th style={{ textAlign:"center", padding:"8px 10px", fontWeight:700, color:"#475569" }}>Vigência</th>
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
                    <td style={{ padding:"6px 10px", textAlign:"center", fontFamily:"'DM Mono',monospace", fontSize:11, color:"#475569", whiteSpace:"nowrap" }}>
                      {d.vigenciaInicio
                        ? `${d.vigenciaInicio} → ${d.vigenciaFim ?? "…"}`
                        : <span style={{ color:"#CBD5E1" }}>—</span>}
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

        <div className="rsp-grid-4" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 100px 130px 130px auto", gap:8, alignItems:"end" }}>
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
          <div>
            <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, marginBottom:4 }}>De (opcional)</div>
            <input type="date" value={newDiaria.vigenciaInicio}
              onChange={e => setNewDiaria(p => ({ ...p, vigenciaInicio: e.target.value }))}
              style={{ width:"100%", border:"1.5px solid #E2E6EC", borderRadius:7, padding:"8px 10px", fontSize:13, fontFamily:"inherit", background:"#FAFBFC" }} />
          </div>
          <div>
            <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, marginBottom:4 }}>Até (opcional)</div>
            <input type="date" value={newDiaria.vigenciaFim}
              onChange={e => setNewDiaria(p => ({ ...p, vigenciaFim: e.target.value }))}
              style={{ width:"100%", border:"1.5px solid #E2E6EC", borderRadius:7, padding:"8px 10px", fontSize:13, fontFamily:"inherit", background:"#FAFBFC" }} />
          </div>
          <button onClick={addDiaria} style={{ background:"#D97706", border:"none", borderRadius:8, padding:"9px 18px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit", alignSelf:"end" }}>
            {t("cfg_diarias_add")}
          </button>
        </div>
      </div>}

      {/* ── Capacidade por Turno ── */}
      {isAdmin && <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#6C63FF", flexShrink:0 }} />
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E" }}>Capacidade por Turno</div>
          {capacidadeSaved && <span style={{ fontSize:12, color:"#0E9F6E", fontWeight:600, marginLeft:8 }}>✓ Salvo</span>}
        </div>
        <div style={{ fontSize:12, color:"#64748B", marginBottom:14, paddingLeft:20 }}>
          Define a quantidade padrão de pessoas por turno em um período. Usado para calcular excedentes na tela de lançamentos.
        </div>

        {capacidadeConfig.length > 0 && (
          <div style={{ overflowX:"auto", marginBottom:14 }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
              <thead>
                <tr style={{ background:"#F8FAFC", borderBottom:"1px solid #E2E6EC" }}>
                  <th style={{ textAlign:"left", padding:"8px 10px", fontWeight:700, color:"#475569" }}>Turno</th>
                  <th style={{ textAlign:"center", padding:"8px 10px", fontWeight:700, color:"#475569" }}>Qtd. Padrão</th>
                  <th style={{ textAlign:"center", padding:"8px 10px", fontWeight:700, color:"#475569" }}>Vigência Início</th>
                  <th style={{ textAlign:"center", padding:"8px 10px", fontWeight:700, color:"#475569" }}>Vigência Fim</th>
                  <th style={{ width:40 }} />
                </tr>
              </thead>
              <tbody>
                {capacidadeConfig.map(c => (
                  <tr key={c.id} style={{ borderBottom:"1px solid #F1F5F9" }}>
                    <td style={{ padding:"6px 10px", fontWeight:600, color:"#0F1C2E" }}>{c.turno}</td>
                    <td style={{ padding:"6px 10px", textAlign:"center", fontFamily:"'DM Mono',monospace", fontWeight:700, color:"#6C63FF" }}>{c.qtdPadrao}</td>
                    <td style={{ padding:"6px 10px", textAlign:"center", fontFamily:"'DM Mono',monospace", color:"#475569" }}>{c.vigenciaInicio}</td>
                    <td style={{ padding:"6px 10px", textAlign:"center", fontFamily:"'DM Mono',monospace", color:"#475569" }}>{c.vigenciaFim}</td>
                    <td style={{ padding:"6px 4px", textAlign:"center" }}>
                      <button onClick={() => removeCapacidade(c)} title="Remover" style={{ background:"none", border:"none", cursor:"pointer", color:"#E02424", fontSize:14, lineHeight:1 }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="rsp-grid-4" style={{ display:"grid", gridTemplateColumns:"1fr 100px 140px 140px auto", gap:8, alignItems:"end" }}>
          <div>
            <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, marginBottom:4 }}>Turno</div>
            <select value={newCapacidade.turno} onChange={e => setNewCapacidade(p => ({ ...p, turno: e.target.value }))}
              style={{ width:"100%", border:"1.5px solid #E2E6EC", borderRadius:7, padding:"8px 10px", fontSize:13, fontFamily:"inherit", background:"#FAFBFC" }}>
              <option value="">Selecione…</option>
              {opcoes.turnos.map(t_ => <option key={t_} value={t_}>{t_}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, marginBottom:4 }}>Qtd. Padrão</div>
            <input type="number" min="1" step="1" value={newCapacidade.qtdPadrao}
              onChange={e => setNewCapacidade(p => ({ ...p, qtdPadrao: e.target.value }))}
              style={{ width:"100%", border:"1.5px solid #E2E6EC", borderRadius:7, padding:"8px 10px", fontSize:13, fontFamily:"'DM Mono',monospace", background:"#FAFBFC" }} />
          </div>
          <div>
            <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, marginBottom:4 }}>Vigência Início</div>
            <input type="date" value={newCapacidade.vigenciaInicio}
              onChange={e => setNewCapacidade(p => ({ ...p, vigenciaInicio: e.target.value }))}
              style={{ width:"100%", border:"1.5px solid #E2E6EC", borderRadius:7, padding:"8px 10px", fontSize:13, fontFamily:"inherit", background:"#FAFBFC" }} />
          </div>
          <div>
            <div style={{ fontSize:11, color:"#94A3B8", fontWeight:600, marginBottom:4 }}>Vigência Fim</div>
            <input type="date" value={newCapacidade.vigenciaFim}
              onChange={e => setNewCapacidade(p => ({ ...p, vigenciaFim: e.target.value }))}
              style={{ width:"100%", border:"1.5px solid #E2E6EC", borderRadius:7, padding:"8px 10px", fontSize:13, fontFamily:"inherit", background:"#FAFBFC" }} />
          </div>
          <button onClick={addCapacidade} style={{ background:"#6C63FF", border:"none", borderRadius:8, padding:"9px 18px", cursor:"pointer", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit", alignSelf:"end" }}>
            Adicionar
          </button>
        </div>
      </div>}

      {/* ── WhatsApp: Template de Mensagem ── */}
      {isAdminOrMod && <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#25D366", flexShrink:0 }} />
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E" }}>Template WhatsApp</div>
          <div style={{ fontSize:11, background:"#25D36618", color:"#25D366", fontWeight:700, borderRadius:99, padding:"2px 8px" }}>Mensagem</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:14 }}>
          <label style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.7 }}>Título da mensagem</label>
          <input value={waHeader} onChange={e => setWaHeader(sanitize(e.target.value))}
            placeholder="REGISTRO DE PRESENÇA"
            style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"7px 10px", fontSize:12, fontFamily:"inherit", background:"#FAFBFC", outline:"none", maxWidth:340 }} />
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.7 }}>Campos incluídos na mensagem</label>
            {waCampos.length > 1 && <span style={{ fontSize:10, color:"#94A3B8", fontStyle:"italic" }}>⠿ arraste para reordenar</span>}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
            {[
              ...waCampos.map(k => WHATSAPP_FIELDS.find(f => f.key === k)!).filter(Boolean),
              ...WHATSAPP_FIELDS.filter(f => !waCampos.includes(f.key)),
            ].map(f => {
              const included = waCampos.includes(f.key);
              return (
                <div
                  key={f.key}
                  onDragOver={included ? (e) => { e.preventDefault(); setWaDragOver(f.key); } : undefined}
                  onDragLeave={included ? (e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setWaDragOver(null); } : undefined}
                  onDrop={included ? (e) => {
                    e.preventDefault();
                    const src = e.dataTransfer.getData("text/plain") as WhatsAppField;
                    if (src !== f.key && waCampos.includes(src)) {
                      setWaCampos(prev => {
                        const arr = [...prev];
                        const fi = arr.indexOf(src);
                        arr.splice(fi, 1);
                        arr.splice(arr.indexOf(f.key), 0, src);
                        return arr;
                      });
                    }
                    setWaDragOver(null);
                  } : undefined}
                  style={{
                    display:"flex", alignItems:"center",
                    borderRadius:6,
                    background: waDragOver === f.key ? "#BBF7D0" : included ? "#25D36614" : "#F8FAFC",
                    border: waDragOver === f.key ? "1.5px dashed #16A34A" : included ? "1px solid #25D366" : "1px solid #E2E6EC",
                    transition:"all .15s",
                  }}
                >
                  {included && (
                    <span
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", f.key); }}
                      onDragEnd={() => setWaDragOver(null)}
                      style={{ padding:"0 2px 0 8px", cursor:"grab", color:"#94A3B8", fontSize:13, userSelect:"none", lineHeight:"1.9" }}
                    >⠿</span>
                  )}
                  <label style={{
                    display:"flex", alignItems:"center", gap:6, fontSize:12, cursor:"pointer",
                    padding: included ? "4px 10px 4px 4px" : "4px 10px",
                  }}>
                    <input type="checkbox" checked={included} onChange={() => toggleWaCampo(f.key)}
                      style={{ accentColor:"#25D366" }} />
                    <span style={{ fontWeight: included ? 600 : 400, color: included ? "#166534" : "#64748B" }}>{f.label}</span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
        {waCampos.length > 0 && (
          <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:8, padding:"12px 16px", marginBottom:14, fontFamily:"monospace", fontSize:11, whiteSpace:"pre-wrap", color:"#166534", lineHeight:1.6 }}>
            {buildWhatsAppMessage([{
              id: "preview", data: "2026-03-15", turno: "Dia", horaEntrada: "08:00", horaSaida: "17:00",
              totalHoras: "09:00", nome: "João Silva", cargo: "Operador", setor: "",
              unidade: "SP-001", cc: "1234", motivo: "Demanda operacional",
              fornecedor: "ABC Serviços", obs: "Exemplo de observação",
            }], { header: waHeader || WA_DEFAULT_TEMPLATE.header, campos: waCampos })}
          </div>
        )}
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={saveWaTemplate} disabled={waCampos.length === 0}
            style={{ background: waCampos.length > 0 ? "#25D366" : "#94A3B8", border:"none", borderRadius:8, padding:"9px 22px", cursor: waCampos.length > 0 ? "pointer" : "not-allowed", color:"#fff", fontWeight:700, fontSize:13, fontFamily:"inherit" }}>
            Salvar Template
          </button>
          {waSaved && <span style={{ fontSize:12, color:"#0E9F6E", fontWeight:600 }}>✓ Salvo!</span>}
          {waSaveError && <span style={{ fontSize:12, color:"#E02424", fontWeight:600 }}>{waSaveError}</span>}
        </div>
        <div style={{ fontSize:11, color:"#94A3B8", marginTop:10 }}>
          Configure quais campos aparecem na mensagem do WhatsApp ao compartilhar registros.
        </div>
      </div>}

      {/* ── LGPD: DPO (Art. 41) — visível só para admins ── */}
      {isAdmin && <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <div style={{ width:10, height:10, borderRadius:"50%", background:"#6C63FF", flexShrink:0 }} />
          <div style={{ fontWeight:700, fontSize:13, color:"#0F1C2E" }}>{t("dpo_title")}</div>
          <div style={{ fontSize:11, background:"#6C63FF18", color:"#6C63FF", fontWeight:700, borderRadius:99, padding:"2px 8px" }}>{t("dpo_badge")}</div>
        </div>
        <div className="rsp-grid-3" style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:14 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.7 }}>{t("dpo_label_nome")}</label>
            <input value={dpoNome} onChange={e => setDpoNomeSafe(e.target.value)} placeholder={t("dpo_ph_nome")}
              style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"7px 10px", fontSize:12, fontFamily:"inherit", background:"#FAFBFC", outline:"none" }} />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.7 }}>{t("dpo_label_email")}</label>
            <input type="email" value={dpoEmail} onChange={e => setDpoEmailSafe(e.target.value)} placeholder={t("dpo_ph_email")}
              style={{ border:"1.5px solid #E2E6EC", borderRadius:7, padding:"7px 10px", fontSize:12, fontFamily:"inherit", background:"#FAFBFC", outline:"none" }} />
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
            <label style={{ fontSize:11, fontWeight:600, color:"#64748B", textTransform:"uppercase", letterSpacing:.7 }}>{t("dpo_label_tel")}</label>
            <input value={dpoTelefone} onChange={e => setDpoTelefoneSafe(e.target.value)} placeholder={t("dpo_ph_tel")}
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
      </div>}

      {/* ── LGPD: Exclusão por Solicitação (Art. 18) — visível só para admins ── */}
      {isAdmin && <div style={{ background:"#fff", border:"1px solid #E2E6EC", borderRadius:12, padding:20 }}>
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
      </div>}
    </div>
  );
};
