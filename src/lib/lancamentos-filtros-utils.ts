import { periodosPadrao } from "@/lib/fechamento-utils";

export interface LancamentosPeriodoFiltroState {
  mes: string;
  periodoIdx: number | null;
  customInicio: string;
  customFim: string;
}

export interface IntervaloData {
  inicio: string;
  fim: string;
}

export const resolverIntervaloLancamentos = (
  filtro: LancamentosPeriodoFiltroState,
): IntervaloData => {
  if (filtro.periodoIdx === null) return { inicio: "", fim: "" };

  if (filtro.periodoIdx === 3) {
    return {
      inicio: filtro.customInicio,
      fim: filtro.customFim,
    };
  }

  if (!filtro.mes) return { inicio: "", fim: "" };
  const periodos = periodosPadrao(filtro.mes);
  const p = periodos[filtro.periodoIdx];
  if (!p) return { inicio: "", fim: "" };

  return { inicio: p.inicio, fim: p.fim };
};

export const passaFiltroDataPeriodo = (
  dataRegistro: string,
  dataExata: string,
  intervalo: IntervaloData,
): boolean => {
  if (dataExata && dataRegistro !== dataExata) return false;
  if (intervalo.inicio && dataRegistro < intervalo.inicio) return false;
  if (intervalo.fim && dataRegistro > intervalo.fim) return false;
  return true;
};
