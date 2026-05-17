import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Registro } from "@/types/attendance";
import type { Opcoes } from "@/types/attendance";
import { supabase, authReady } from "@/lib/supabase";
import { sanitize, logAudit } from "@/lib/audit";
import { hoje, dataLimiteRetencao, dbToRegistro, registroToDb, WA_DEFAULT_TEMPLATE } from "@/lib/format-utils";
import type { WhatsAppTemplate, WhatsAppField } from "@/lib/format-utils";
import { dbToTurnoConfig } from "@/lib/fechamento-utils";
import type { TurnoConfig } from "@/lib/fechamento-utils";
import type { MobileFiltrosState } from "@/components/mobile/MobileFiltros";

const OPCOES_DEFAULT: Opcoes = {
  turnos: [], unidades: [], fornecedores: [], motivos: [], cargos: [], ccList: [], nomes: [],
};

export function useMobileLancamentos() {
  const [registros, setRegistrosState] = useState<Registro[]>([]);
  const [opcoes, setOpcoes] = useState<Opcoes>(OPCOES_DEFAULT);
  const [turnosConfig, setTurnosConfig] = useState<TurnoConfig[]>([]);
  const [waTemplate, setWaTemplate] = useState<WhatsAppTemplate>(WA_DEFAULT_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const prevRef = useRef<Registro[]>([]);

  const [filtros, setFiltros] = useState<MobileFiltrosState>({ data: hoje(), turno: "", fornecedor: "" });

  useEffect(() => {
    authReady.then(() =>
      supabase.from("registros").select("*").order("created_at", { ascending: true })
        .then(({ data: rows, error }) => {
          if (error) { if (import.meta.env.DEV) console.error("Erro ao carregar registros:", error.message); }
          else if (rows && rows.length > 0) {
            const parsed = (rows as unknown[]).map(r => dbToRegistro(r as Parameters<typeof dbToRegistro>[0]));
            setRegistrosState(parsed);
            prevRef.current = parsed;
          }
          setLoading(false);

          const limite = dataLimiteRetencao();
          void supabase.from("registros").delete().lt("data", limite).select("id")
            .then(({ data: purged, error: pe }) => {
              if (pe) { if (import.meta.env.DEV) console.error("Erro ao purgar:", pe.message); return; }
              if (purged && purged.length > 0) {
                logAudit("PURGE", "registros", undefined, {
                  motivo: `Retenção LGPD — anteriores a ${limite}`,
                  registros_removidos: purged.length,
                });
                setRegistrosState(prev => prev.filter(r => r.data >= limite));
                prevRef.current = prevRef.current.filter(r => r.data >= limite);
              }
            });
        }),
    ).catch((err: unknown) => {
      if (import.meta.env.DEV) console.error("Erro ao carregar registros:", err);
      setLoading(false);
    });
  }, []);

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

      if (!tcRes.error && tcRes.data) setTurnosConfig(tcRes.data.map(dbToTurnoConfig));

      if (waRes.data?.valor) {
        try {
          const parsed = JSON.parse(waRes.data.valor) as { header?: string; campos?: WhatsAppField[] };
          if (parsed.header && Array.isArray(parsed.campos) && parsed.campos.length > 0) {
            setWaTemplate({ header: parsed.header, campos: parsed.campos });
          }
        } catch { /* ignore bad JSON */ }
      }
    }).catch((err: unknown) => { if (import.meta.env.DEV) console.error("Erro ao carregar opções:", err); });
  }, []);

  const setRegistros = useCallback((newValRaw: Registro[]) => {
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
          if (error) { if (import.meta.env.DEV) console.error("Erro ao deletar:", error.message); }
          else deletedIds.forEach(id => logAudit("DELETE", "registros", id));
        });
    }
    if (toUpsert.length > 0) {
      supabase.from("registros").upsert(toUpsert.map(registroToDb))
        .then(({ error }) => {
          if (error) { if (import.meta.env.DEV) console.error("Erro ao salvar:", error.message); }
          else toUpsert.forEach(r => logAudit(prevMap.has(r.id) ? "UPDATE" : "INSERT", "registros", r.id));
        });
    }
  }, []);

  const filtered = useMemo(() => registros.filter(r => {
    if (filtros.data && r.data !== filtros.data) return false;
    if (filtros.turno && r.turno !== filtros.turno) return false;
    if (filtros.fornecedor && r.fornecedor !== filtros.fornecedor) return false;
    return true;
  }), [registros, filtros]);

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

  const addOpcao = useCallback(async (key: keyof Opcoes, valor: string) => {
    const v = sanitize(valor.trim()).toUpperCase();
    if (!v || opcoes[key].includes(v)) return;
    await authReady;
    if (key === "nomes") {
      await supabase.from("terceiros").upsert({ nome: v }, { onConflict: "nome", ignoreDuplicates: true });
      logAudit("INSERT", "terceiros", undefined, { nome: v });
    } else {
      await supabase.from("opcoes").upsert({ chave: key, valor: v }, { onConflict: "chave,valor", ignoreDuplicates: true });
      logAudit("INSERT", "opcoes", undefined, { chave: key, valor: v });
    }
    setOpcoes(prev => ({ ...prev, [key]: [...prev[key], v] }));
  }, [opcoes]);

  const removeOpcao = useCallback(async (key: keyof Opcoes, valor: string) => {
    await authReady;
    if (key === "nomes") {
      await supabase.from("terceiros").delete().eq("nome", valor);
      logAudit("DELETE", "terceiros", undefined, { nome: valor });
    } else {
      await supabase.from("opcoes").delete().eq("chave", key).eq("valor", valor);
      logAudit("DELETE", "opcoes", undefined, { chave: key, valor });
    }
    setOpcoes(prev => ({ ...prev, [key]: prev[key].filter(v => v !== valor) }));
  }, []);

  return {
    registros, setRegistros,
    opcoes, turnosConfig, waTemplate,
    loading,
    filtros, setFiltros,
    filtered, grupos,
    addOpcao, removeOpcao,
  };
}
