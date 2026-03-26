import { useState, useCallback, useRef, useEffect } from "react";
import { Registro } from "@/types/attendance";
import { supabase, authReady } from "@/lib/supabase";
import { dataLimiteRetencao, dbToRegistro, registroToDb, type DbRegistro } from "@/lib/format-utils";
import { logAudit } from "@/lib/audit";

export const useStorage = (): [Registro[], (val: Registro[]) => void, boolean] => {
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
            })
            .catch((err: unknown) => console.error("Erro na purga LGPD:", err));
        })
    ).catch((err: unknown) => {
      console.error("Erro no carregamento de registros:", err);
      setLoading(false);
    });
  }, []);

  const save = useCallback((newValRaw: Registro[]) => {
    // Última defesa: remove duplicatas intra-lote antes de persistir no Supabase
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
