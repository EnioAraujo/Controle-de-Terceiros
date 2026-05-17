import { useState, useMemo } from "react";
import type { Registro } from "@/types/attendance";
import type { TurnoCapacidade } from "@/lib/fechamento-utils";
import { calcExcedentePorTurnoDia } from "@/lib/excedente-utils";
import { hoje, mesAtual } from "@/lib/format-utils";
import {
  type LancamentosPeriodoFiltroState,
  passaFiltroDataPeriodo,
  resolverIntervaloLancamentos,
} from "@/lib/lancamentos-filtros-utils";

export interface Filtros { data: string; turno: string; fornecedor: string; unidade: string; busca: string; }

export interface ImportFeedbackState {
  importedIds: string[];
  importados: number;
  rejeitados: number;
  fonte: string;
}

export interface ConflitoState {
  novos: Registro[];
  nomes: string[];
  justificativa: string;
}

type ModalState = null | "new" | Registro | Registro[];

const findConflitoDeTurno = (
  r: Registro,
  registros: Registro[],
  editIds: Set<string>,
): Registro | undefined =>
  registros.find(e =>
    !editIds.has(e.id) &&
    e.nome.toLowerCase() === r.nome.toLowerCase() &&
    e.data === r.data &&
    e.turno.toLowerCase() !== r.turno.toLowerCase()
  );

const passaFiltrosLancamentos = (
  r: Registro,
  filtros: Filtros,
  intervaloPeriodo: { inicio: string; fim: string },
): boolean => {
  if (!passaFiltroDataPeriodo(r.data, filtros.data, intervaloPeriodo)) return false;
  if (filtros.turno && r.turno !== filtros.turno) return false;
  if (filtros.fornecedor && r.fornecedor !== filtros.fornecedor) return false;
  if (filtros.unidade && r.unidade !== filtros.unidade) return false;
  if (filtros.busca && !r.nome.toLowerCase().includes(filtros.busca.toLowerCase())) return false;
  return true;
};

interface UseLancamentosParams {
  registros: Registro[];
  setRegistros: (val: Registro[]) => void;
  capacidadeConfig: TurnoCapacidade[];
}

export function useLancamentos({ registros, setRegistros, capacidadeConfig }: UseLancamentosParams) {
  const [filtros, setFiltros] = useState<Filtros>({ data: hoje(), turno: "", fornecedor: "", unidade: "", busca: "" });
  const [filtroPeriodo, setFiltroPeriodo] = useState<LancamentosPeriodoFiltroState>({
    mes: mesAtual(),
    periodoIdx: null,
    customInicio: "",
    customFim: "",
  });
  const [modal, setModal] = useState<ModalState>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<string[] | null>(null);
  const [detalhe, setDetalhe] = useState<Registro | Registro[] | null>(null);
  const [conflito, setConflito] = useState<ConflitoState | null>(null);
  const [importFeedback, setImportFeedback] = useState<ImportFeedbackState | null>(null);

  const setFiltro = (k: keyof Filtros, v: string) => setFiltros(f => ({ ...f, [k]: v }));

  const intervaloPeriodo = useMemo(() => resolverIntervaloLancamentos(filtroPeriodo), [filtroPeriodo]);

  const excedenteMap = useMemo(
    () => calcExcedentePorTurnoDia(registros, capacidadeConfig),
    [registros, capacidadeConfig],
  );

  const filtered = useMemo(
    () => registros.filter(r => passaFiltrosLancamentos(r, filtros, intervaloPeriodo)),
    [registros, filtros, intervaloPeriodo],
  );

  const importadosVisiveis = useMemo(() => {
    if (!importFeedback) return 0;
    const idsVisiveis = new Set(filtered.map(r => r.id));
    return importFeedback.importedIds.filter(id => idsVisiveis.has(id)).length;
  }, [filtered, importFeedback]);

  const importadosOcultos = importFeedback ? Math.max(importFeedback.importados - importadosVisiveis, 0) : 0;

  const grupos = useMemo<(Registro | Registro[])[]>(() => {
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

  const salvar = (novos: Registro[], forceComJustificativa = "") => {
    const nomesLote = novos.map(r => r.nome.toLowerCase());
    const semDup = novos.filter((r, idx) => nomesLote.indexOf(r.nome.toLowerCase()) === idx);

    const editIds = new Set(
      Array.isArray(modal) ? (modal as Registro[]).map(r => r.id)
      : modal && modal !== "new" ? [(modal as Registro).id]
      : []
    );
    const conflitosNome: string[] = [];
    for (const r of semDup) {
      const existente = findConflitoDeTurno(r, registros, editIds);
      if (existente) conflitosNome.push(`${r.nome} (já no ${existente.turno})`);
    }

    if (conflitosNome.length > 0 && !forceComJustificativa) {
      setConflito({ novos: semDup, nomes: conflitosNome, justificativa: "" });
      return;
    }

    const registrosFinais = forceComJustificativa
      ? semDup.map(r => {
          const temConflito = registros.some(e =>
            !editIds.has(e.id) &&
            e.nome.toLowerCase() === r.nome.toLowerCase() &&
            e.data === r.data &&
            e.turno.toLowerCase() !== r.turno.toLowerCase()
          );
          if (temConflito) {
            const obsAtual = r.obs || "";
            return { ...r, obs: `[DUPLO TURNO] ${forceComJustificativa}${obsAtual ? ` | ${obsAtual}` : ""}` };
          }
          return r;
        })
      : semDup;

    if (modal === "new") {
      setRegistros([...registros, ...registrosFinais]);
    } else if (Array.isArray(modal)) {
      const ids = new Set((modal as Registro[]).map(r => r.id));
      setRegistros([...registros.filter(r => !ids.has(r.id)), ...registrosFinais]);
    } else {
      setRegistros(registros.map(r => r.id === registrosFinais[0].id ? registrosFinais[0] : r));
    }
    setModal(null);
    setConflito(null);
  };

  const excluir = (ids: string[]) => {
    setRegistros(registros.filter(r => !ids.includes(r.id)));
    setSelectedIds([]);
    setConfirm(null);
  };

  return {
    filtros, setFiltros, setFiltro,
    filtroPeriodo, setFiltroPeriodo,
    modal, setModal,
    selectedIds, setSelectedIds,
    confirm, setConfirm,
    detalhe, setDetalhe,
    conflito, setConflito,
    importFeedback, setImportFeedback,
    intervaloPeriodo,
    excedenteMap,
    filtered,
    importadosOcultos,
    grupos,
    salvar,
    excluir,
  };
}
